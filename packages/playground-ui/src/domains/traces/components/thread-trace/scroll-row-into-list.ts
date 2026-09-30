/**
 * Scrolls only the thread-trace list so `row` sits at its top. `scrollIntoView` would also scroll
 * every scrollable ancestor (the host dialog, `overflow-hidden` wrappers), shifting the page.
 */
export function scrollRowIntoList(row: HTMLElement, behavior: ScrollBehavior = 'auto') {
  const list = row.closest<HTMLElement>('[data-slot="thread-trace-list"]');
  if (!list) return;
  const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
  list.scrollTo({ top, behavior });
}
