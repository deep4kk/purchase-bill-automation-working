/**
 * Build a MongoDB filter fragment for a date range on a single field.
 * Returns an empty object when neither bound is supplied so callers can
 * spread it unconditionally into a larger filter.
 */
export function buildDateRangeFilter(
  field: string,
  dateFrom?: string,
  dateTo?: string,
): Record<string, unknown> {
  if (!dateFrom && !dateTo) return {};
  const range: Record<string, unknown> = {};
  if (dateFrom) range["$gte"] = dateFrom;
  if (dateTo) range["$lte"] = dateTo;
  return { [field]: range };
}