/**
 * Resolve the agent name. Uses an explicit name when provided, otherwise derives
 * a Title Case name from the description. Infra-agnostic — no workflow ctx.
 */
export function resolveName(description: string, explicitName?: string): string {
  const trimmed = explicitName?.trim();
  if (trimmed) {
    return trimmed;
  }

  const words = description
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);

  if (words.length === 0) {
    return 'New Agent';
  }

  return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}
