/** `4 links in, 14 links out`: what the arrows in a link badge say, for its label and a page's tooltip. */
export function linkCountsText(links: { in: number; out: number }, notShown = 0): string {
  const noun = (count: number) => (count === 1 ? 'link' : 'links');
  const text = `${links.in} ${noun(links.in)} in, ${links.out} ${noun(links.out)} out`;
  return notShown > 0 ? `${text} (${notShown} not shown)` : text;
}
