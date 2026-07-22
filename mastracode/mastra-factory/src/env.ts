import fs from 'node:fs';

/**
 * Idempotently update a `.env` file.
 *
 * Replaces any existing `KEY=` line (commented or not) with `KEY=value`.
 * Appends missing keys at the end of the file. Preserves other lines
 * verbatim. Values are written raw — do not pass secrets that contain
 * newlines or leading spaces (WorkOS `sk_` keys and Neon connection strings
 * are safe).
 */
export function upsertEnvFile(envPath: string, updates: Record<string, string>): void {
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const lines = existing === '' ? [] : existing.split('\n');

  // Track which keys we've already handled so remaining ones can be appended.
  const remaining = new Map(Object.entries(updates));

  const patched = lines.map(line => {
    // Match `KEY=...` or `# KEY=...` (with optional leading whitespace on the
    // comment form). We rewrite the whole line, dropping the comment marker.
    const match = /^(\s*#\s*)?([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!match) return line;
    const key = match[2]!;
    if (!remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${value}`;
  });

  if (remaining.size > 0) {
    // Ensure a blank line before the appended block if the file has content.
    if (patched.length > 0 && patched[patched.length - 1] !== '') {
      patched.push('');
    }
    for (const [key, value] of remaining) {
      patched.push(`${key}=${value}`);
    }
  }

  // Preserve trailing newline behavior: input had one (empty last element)
  // → keep one; input didn't → don't force one.
  const output = patched.join('\n');
  fs.writeFileSync(envPath, output);
}
