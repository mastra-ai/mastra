/** Pages that load the whole board themselves: the boards. */
export function pageLoadsBoard(pathname: string) {
  return /^\/factories\/[^/]+\/(?:work|review|boards\/[^/]+)\/?$/.test(pathname);
}
