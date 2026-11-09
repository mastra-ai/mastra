const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
  const match = FRONTMATTER.exec(content);
  if (!match) return { frontmatter: null, body: content };
  return { frontmatter: match[1] ?? '', body: content.slice(match[0].length) };
}
