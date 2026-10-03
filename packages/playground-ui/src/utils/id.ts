export function getShortId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return id.slice(0, 8);
}

export function getShortSha(sha: string | undefined): string | undefined {
  if (!sha) return undefined;
  return sha.slice(0, 7);
}
