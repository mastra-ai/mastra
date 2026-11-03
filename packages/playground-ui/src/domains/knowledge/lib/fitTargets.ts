/**
 * The nodes a refocus brings into view: the focus and its neighbours, plus the linked pages on the outer
 * ring (their lines only draw on hover, so they are not neighbours). Every node when nothing is focused.
 */
export function fitTargets<T extends { id: string }>(
  nodes: readonly T[],
  neighbours: ReadonlySet<string> | null,
  linked: ReadonlySet<string>,
): T[] {
  if (!neighbours) return [...nodes];
  return nodes.filter(node => neighbours.has(node.id) || linked.has(node.id));
}
