export function normalizePromptIndentation(instructions: string): string {
  const lines = instructions.split('\n');
  const nonblankLines = lines.filter(line => line.trim().length > 0);
  const firstLine = nonblankLines[0];

  if (firstLine === undefined) return instructions;

  let commonIndentation = firstLine.match(/^[\t ]*/)?.[0] ?? '';

  for (const line of nonblankLines) {
    while (!line.startsWith(commonIndentation)) {
      commonIndentation = commonIndentation.slice(0, -1);
    }
    if (commonIndentation.length === 0) return instructions;
  }

  return lines
    .map(line => (line.startsWith(commonIndentation) ? line.slice(commonIndentation.length) : line))
    .join('\n');
}
