import { config } from "@/lib/config";

type DayParts = { year: number; month: number; day: number };

export type DateRange = {
  since: Date; // inclusive
  until: Date; // exclusive
  startLabel: string; // DD/MM/YYYY
  endLabel: string; // DD/MM/YYYY
};

// Accepts DD/MM/YYYY (or D/M/YYYY) and YYYY-MM-DD. Returns null for anything else,
// including impossible dates such as 31/02/2026.
export function parseDateInput(input: string): DayParts | null {
  const text = input.trim();
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  let parts: DayParts;
  if (fr) parts = { day: Number(fr[1]), month: Number(fr[2]), year: Number(fr[3]) };
  else if (iso) parts = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  else return null;

  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const valid =
    check.getUTCFullYear() === parts.year &&
    check.getUTCMonth() === parts.month - 1 &&
    check.getUTCDate() === parts.day;
  return valid ? parts : null;
}

function addDays({ year, month, day }: DayParts, days: number): DayParts {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// Calendar day of `date` in the configured time zone.
function dayInZone(date: Date): DayParts {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.stats.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

// Instant of midnight at the start of `parts`, in the configured time zone.
function midnightInZone(parts: DayParts): Date {
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day);
  const zoned = new Date(
    new Date(utcGuess).toLocaleString("en-US", { timeZone: config.stats.timeZone }),
  );
  const utc = new Date(new Date(utcGuess).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utcGuess - (zoned.getTime() - utc.getTime()));
}

function label({ year, month, day }: DayParts): string {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

// Resolves the /stats date options. The end date is inclusive (whole day) and defaults
// to today; the start date defaults to `defaultDays` before the end date.
export function resolveDateRange(
  startInput: string | undefined,
  endInput: string | undefined,
  now: Date = new Date(),
): DateRange | { error: string } {
  const formats = "Formats acceptés : JJ/MM/AAAA ou AAAA-MM-JJ.";

  const endDay = endInput ? parseDateInput(endInput) : dayInZone(now);
  if (!endDay) return { error: `Date de fin invalide : « ${endInput} ». ${formats}` };

  const startDay = startInput
    ? parseDateInput(startInput)
    : addDays(endDay, -config.stats.defaultDays);
  if (!startDay) return { error: `Date de début invalide : « ${startInput} ». ${formats}` };

  const since = midnightInZone(startDay);
  const until = midnightInZone(addDays(endDay, 1));
  if (since.getTime() >= until.getTime()) {
    return { error: "La date de début doit précéder la date de fin." };
  }
  if (since.getTime() > now.getTime()) {
    return { error: "La date de début est dans le futur." };
  }

  return { since, until, startLabel: label(startDay), endLabel: label(endDay) };
}
