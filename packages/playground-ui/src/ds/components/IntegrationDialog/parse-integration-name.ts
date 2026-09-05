const PARENTHESIZED_SUFFIX = /\s*\(([^()]+)\)\s*$/;

export function parseIntegrationName(name: string): { name: string; badge?: string } {
  const match = PARENTHESIZED_SUFFIX.exec(name);
  const badge = match?.[1]?.trim();
  if (!match || !badge) return { name };
  return { name: name.slice(0, match.index).trim(), badge };
}
