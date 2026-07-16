import fs from 'node:fs';

/**
 * Single writer for the scaffolded project's `.env`.
 *
 * The template ships a commented `.env.example` (derived from `.env.schema`)
 * that the create flow copies to `.env`; this writer fills values in place so
 * comments and ordering survive. Keys missing from the file are appended.
 */
export class EnvWriter {
  private lines: string[];
  private readonly written = new Map<string, string>();

  constructor(private readonly filePath: string) {
    this.lines = fs.readFileSync(filePath, 'utf8').split('\n');
  }

  /**
   * Set `KEY=value`, replacing the first `KEY=` assignment, uncommenting a
   * `# KEY=` placeholder (unset vars ship commented out — an active empty
   * `KEY=` would load as `""` and defeat `?? default` fallbacks), or appending.
   */
  set(key: string, value: string): void {
    this.written.set(key, value);
    const line = `${key}=${serializeValue(value)}`;
    const active = this.lines.findIndex(l => l.startsWith(`${key}=`));
    const commentedPattern = new RegExp(`^#\\s*${key}=\\s*$`);
    const index = active !== -1 ? active : this.lines.findIndex(l => commentedPattern.test(l));
    if (index === -1) {
      // Ensure a trailing newline boundary, then append.
      if (this.lines[this.lines.length - 1] !== '') this.lines.push('');
      this.lines.push(line, '');
    } else {
      this.lines[index] = line;
    }
  }

  /** Keys written so far (for the summary/outro). */
  keys(): string[] {
    return [...this.written.keys()];
  }

  save(): void {
    fs.writeFileSync(this.filePath, this.lines.join('\n'));
  }
}

/**
 * Serialize a value for a dotenv line. Embedded newlines become literal `\n`
 * escapes (the server's PEM normalization turns them back into newlines, and
 * escape-expanding parsers already deliver real newlines). Values containing
 * whitespace, `#`, or quotes are double-quoted.
 */
export function serializeValue(value: string): string {
  const escaped = value.replace(/\n/g, '\\n');
  if (/[\s#'"]/.test(escaped) || escaped.includes('\\n')) {
    return `"${escaped.replace(/"/g, '\\"')}"`;
  }
  return escaped;
}
