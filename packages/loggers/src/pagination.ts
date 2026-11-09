/**
 * Normalizes and validates log query pagination. `page: 0` aliases page 1 and
 * `perPage: 0` aliases the default of 100. Throws RangeError for anything that
 * is not a positive safe integer, or whose range would exceed safe integers.
 */
export function normalizePagination(pageInput?: number, perPageInput?: number) {
  const page = pageInput === undefined || pageInput === 0 ? 1 : pageInput;
  const perPage = perPageInput === undefined || perPageInput === 0 ? 100 : perPageInput;

  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError(`Invalid page: ${pageInput}. Expected a positive integer.`);
  }
  if (!Number.isSafeInteger(perPage) || perPage < 1) {
    throw new RangeError(`Invalid perPage: ${perPageInput}. Expected a positive integer.`);
  }

  const start = (page - 1) * perPage;
  const end = start + perPage;
  if (!Number.isSafeInteger(end)) {
    throw new RangeError(`Pagination range too large: page ${page}, perPage ${perPage}.`);
  }

  return { page, perPage, start, end };
}
