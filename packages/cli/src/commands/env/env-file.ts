/**
 * Serialize env vars into `.env` file content, quoting/escaping values so the
 * file is safe to `source` and skipping keys that aren't valid shell
 * identifiers. Managed var names (platform-injected secrets whose values are
 * never exposed) are listed as comments so users know they exist without
 * round-tripping secrets into local files.
 */
export function serializeEnvFile(
  envVars: Record<string, string>,
  opts: { header: string; managedVarNames?: string[] },
): { content: string; written: number; skipped: number } {
  const shellSafeKey = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const lines = [`# ${opts.header}`, ''];
  let skipped = 0;
  let written = 0;

  for (const key of Object.keys(envVars).sort()) {
    if (!shellSafeKey.test(key)) {
      lines.push(`# Skipped unsafe key: ${key.replace(/[^\w.-]/g, '?')}`);
      skipped++;
      continue;
    }
    const value = envVars[key]!;
    // Always quote values to prevent shell metacharacter interpretation when sourced
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`');
    lines.push(`${key}="${escaped}"`);
    written++;
  }

  if (opts.managedVarNames && opts.managedVarNames.length > 0) {
    lines.push('');
    lines.push('# Managed by the Mastra platform — values are injected at deploy time:');
    for (const name of [...opts.managedVarNames].sort()) {
      lines.push(`# ${name}`);
    }
  }

  lines.push(''); // trailing newline
  return { content: lines.join('\n'), written, skipped };
}
