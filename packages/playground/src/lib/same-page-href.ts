/**
 * True when `href` only changes the search (or hash) of the current page, e.g. `?tool=refundUser`
 * opening a drawer. Those aren't page changes, so navigation skips the view transition: during one,
 * elements with their own `view-transition-name` (like the chat composer) paint above anything
 * entering the page, such as a drawer sliding in.
 */
export function isSamePageHref(href: string, pathname: string): boolean {
  if (href.startsWith('?') || href.startsWith('#')) return true;
  if (!href.startsWith('/')) return false;
  return new URL(href, 'http://studio.local').pathname === pathname;
}
