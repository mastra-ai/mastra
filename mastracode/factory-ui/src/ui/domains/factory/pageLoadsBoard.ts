/** Pages that load the whole board themselves: the boards, and a draft session for its starters. */
export function pageLoadsBoard(pathname: string) {
  return /^\/factories\/[^/]+\/(?:work|review|boards\/[^/]+|user\/new\/[^/]+)\/?$/.test(pathname);
}
