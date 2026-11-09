export type PaginationRangeItem = { kind: 'page'; page: number } | { kind: 'ellipsis'; key: 'start' | 'end' };

const pageItem = (page: number): PaginationRangeItem => ({ kind: 'page', page });

function windowStart(page: number, pageCount: number) {
  const start = Math.max(1, Math.min(page - 1, pageCount - 5));
  if (start === 2) return 1;
  return start;
}

function windowEnd(page: number, pageCount: number) {
  const end = Math.min(pageCount - 2, Math.max(page + 1, 4));
  if (end === pageCount - 3) return pageCount - 2;
  return end;
}

export function getPaginationRange(page: number, pageCount: number): PaginationRangeItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => pageItem(index));
  const first = windowStart(page, pageCount);
  const last = windowEnd(page, pageCount);
  const items: PaginationRangeItem[] = [pageItem(0)];
  if (first > 1) items.push({ kind: 'ellipsis', key: 'start' });
  for (let index = first; index <= last; index += 1) items.push(pageItem(index));
  if (last < pageCount - 2) items.push({ kind: 'ellipsis', key: 'end' });
  items.push(pageItem(pageCount - 1));
  return items;
}
