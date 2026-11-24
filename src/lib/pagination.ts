// Pagination helpers shared by the paginated ephemeral reports (/veille, /stats).

// Returns the start index of each page. `fitFrom(start)` returns how many items
// fit on a page starting at `start` (pages are sized by rendered length, not by count).
export function computePageStarts(total: number, fitFrom: (start: number) => number): number[] {
  const starts: number[] = [];
  let i = 0;
  while (i < total) {
    starts.push(i);
    const count = fitFrom(i);
    if (count === 0) break;
    i += count;
  }
  return starts;
}

// Previous / Next buttons, or nothing when there is a single page.
export function buildNavButtons(
  page: number,
  totalPages: number,
  customIdFor: (page: number) => string,
): unknown[] {
  if (totalPages <= 1) return [];
  return [
    {
      type: 2, // BUTTON
      style: 2, // SECONDARY
      label: "◀ Précédent",
      custom_id: customIdFor(page - 1),
      disabled: page === 0,
    },
    {
      type: 2,
      style: 2,
      label: "Suivant ▶",
      custom_id: customIdFor(page + 1),
      disabled: page === totalPages - 1,
    },
  ];
}
