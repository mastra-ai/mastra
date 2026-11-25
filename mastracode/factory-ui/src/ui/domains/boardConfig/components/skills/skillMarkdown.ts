// JSON-quoted values are valid YAML strings, so `:`, `#`, and names such as `123` survive.
export function composeSkillMarkdown({
  name,
  description,
  frontmatter,
  instructions,
}: {
  name: string;
  description: string;
  frontmatter?: Record<string, unknown>;
  instructions: string;
}): string {
  const fields = [
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    ...Object.entries(frontmatter ?? {}).map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
  ];
  return `---\n${fields.join('\n')}\n---\n\n${instructions.trim()}\n`;
}
