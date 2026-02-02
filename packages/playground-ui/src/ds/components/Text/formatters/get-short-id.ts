export function getShortId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return id.slice(0, 8);
}
