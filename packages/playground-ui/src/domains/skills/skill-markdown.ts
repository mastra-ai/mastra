export interface ParsedSkill {
  name: string;
  description: string;
  instructions: string;
}

export type SkillMarkdownResult = { skill: ParsedSkill; error?: never } | { skill?: never; error: string };

const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function frontmatterValue(frontmatter: string, key: string) {
  const line = frontmatter.split(/\r?\n/).find(row => row.startsWith(`${key}:`));
  if (!line) return '';
  return line
    .slice(key.length + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();
}

/** Reads a SKILL.md: `name` and `description` from its frontmatter, the instructions from the rest. */
export function parseSkillMarkdown(text: string): SkillMarkdownResult {
  const match = FRONTMATTER.exec(text);
  if (!match)
    return { error: 'SKILL.md has no frontmatter. Start the file with a --- block holding its name and description.' };
  const frontmatter = match[1] ?? '';
  const name = frontmatterValue(frontmatter, 'name');
  const description = frontmatterValue(frontmatter, 'description');
  const instructions = text.slice(match[0].length).trim();
  if (!name) return { error: 'SKILL.md has no name. Add a name line to its frontmatter, then upload it again.' };
  if (!description)
    return { error: 'SKILL.md has no description. Add a description line under the name, then upload it again.' };
  if (!instructions) return { error: 'SKILL.md has no instructions. Write them below the frontmatter.' };
  return { skill: { name, description, instructions } };
}

/** The SKILL.md among picked or dropped files: a single file whatever its name, or the top-most SKILL.md in a folder. */
export function findSkillFile(files: File[]): File | undefined {
  if (files.length === 1 && !files[0]?.webkitRelativePath) return files[0];
  const depth = (file: File) => (file.webkitRelativePath || file.name).split('/').length;
  return files.filter(file => file.name.toLowerCase() === 'skill.md').toSorted((a, b) => depth(a) - depth(b))[0];
}
