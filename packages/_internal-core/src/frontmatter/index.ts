import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const OPEN = '---';
const CLOSE = '\n---';

/** Result of splitting a document into its frontmatter and body. */
export interface ParsedFrontmatter {
  /** Parsed frontmatter fields. `{}` when the document has no frontmatter block. */
  data: Record<string, unknown>;
  /** Document body after the closing delimiter. */
  content: string;
}

/**
 * Split a markdown document into YAML frontmatter and body.
 *
 * A frontmatter block starts with `---` on the first line and ends at the next
 * line that is exactly `---` (a longer dash run or `--- !tag` is not a delimiter). An optional language tag may follow the opening
 * delimiter (`---yaml`); only YAML and JSON are accepted, and a `js`/`javascript`
 * tag throws instead of being evaluated. Documents that do not start with `---`
 * are returned unchanged with empty data.
 *
 * Throws when the frontmatter is not valid YAML or is not a mapping.
 */
export function parseFrontmatter(input: string): ParsedFrontmatter {
  // Strip a UTF-8 byte-order mark so a BOM-prefixed file is still recognized.
  const str = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  // `----` (or longer) is a horizontal rule, not a frontmatter delimiter.
  if (!str.startsWith(OPEN) || str.charAt(OPEN.length) === '-') {
    return { data: {}, content: str };
  }

  let rest = str.slice(OPEN.length);
  const firstLineEnd = rest.indexOf('\n');
  const language = (firstLineEnd === -1 ? rest : rest.slice(0, firstLineEnd)).trim().toLowerCase();
  if (language) {
    rest = firstLineEnd === -1 ? '' : rest.slice(firstLineEnd);
  }

  // Only a line that is exactly `---` (trailing spaces allowed) closes the block;
  // `----`, `---foo` and `--- !tag` are not delimiters.
  let closeIndex = rest.indexOf(CLOSE);
  let closeEnd = -1;
  while (closeIndex !== -1) {
    closeEnd = closeIndex + CLOSE.length;
    while (rest[closeEnd] === ' ' || rest[closeEnd] === '\t') closeEnd++;
    const after = rest.charAt(closeEnd);
    if (after === '' || after === '\n' || after === '\r') break;
    closeIndex = rest.indexOf(CLOSE, closeIndex + 1);
  }
  // Normalize CRLF inside the block so a Windows-authored file parses the same as a Unix one.
  const block = (closeIndex === -1 ? rest : rest.slice(0, closeIndex)).replace(/\r(?=\n|$)/g, '');
  let content = closeIndex === -1 ? '' : rest.slice(closeEnd);
  // Drop the newline that terminates the closing delimiter (`\r\n` or `\n`).
  if (content.startsWith('\r')) content = content.slice(1);
  if (content.startsWith('\n')) content = content.slice(1);

  return { data: parseBlock(block, language), content };
}

function parseBlock(block: string, language: string): Record<string, unknown> {
  // A block containing only comments and whitespace has no data.
  if (block.replace(/^\s*#[^\n]*/gm, '').trim() === '') {
    return {};
  }

  let data: unknown;
  switch (language) {
    case '':
    case 'yaml':
    case 'yml':
      data = parseYaml(block);
      break;
    case 'json':
      data = JSON.parse(block);
      break;
    case 'js':
    case 'javascript':
      throw new Error('JavaScript frontmatter is not supported');
    default:
      throw new Error(`Frontmatter language "${language}" is not supported`);
  }

  if (data === null || data === undefined) return {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Frontmatter must be a mapping of fields');
  }
  return data as Record<string, unknown>;
}

/**
 * Serialize `data` as a YAML frontmatter block followed by `content`.
 * The block is omitted when `data` has no fields. The result always ends with a newline.
 */
export function stringifyFrontmatter(content: string, data: Record<string, unknown>): string {
  const body = content.endsWith('\n') ? content : `${content}\n`;
  if (Object.keys(data).length === 0) return body;
  // `lineWidth: 0` disables folding so long descriptions stay on one line.
  const block = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  return `${OPEN}\n${block}\n${OPEN}\n${body}`;
}
