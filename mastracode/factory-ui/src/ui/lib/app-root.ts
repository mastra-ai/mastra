/**
 * Path prefix the app is mounted under. Empty when Factory serves itself at `/`;
 * a host (e.g. Platform) sets it before rendering so in-app links stay inside
 * its route, like `/acme/my-project/factory`.
 */
let root = '';

export function setAppRoot(next: string): void {
  root = next.replace(/\/+$/, '');
}

export function appRoot(): string {
  return root;
}

/** `pathname` relative to the mount point, for matching Factory's own routes. */
export function appPathname(pathname: string): string {
  return root && pathname.startsWith(root) ? pathname.slice(root.length) || '/' : pathname;
}
