const PERIODS: Record<string, number> = { "1j": 1, "7j": 7, "30j": 30 };

export function parsePeriod(period: string): Date {
  const days = PERIODS[period] ?? 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function periodLabel(period: string): string {
  const days = PERIODS[period] ?? 7;
  if (days === 1) return "hier";
  return `${days} derniers jours`;
}
