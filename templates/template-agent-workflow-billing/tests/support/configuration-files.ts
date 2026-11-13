import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Synthetic external configuration co-located with the fixture database for cleanup. */
export function configurationFile(directory: string, value: unknown) {
  const path = join(directory, `configuration-${randomUUID()}.json`);
  writeFileSync(path, JSON.stringify(value), { mode: 0o600 });
  return path;
}
export function rawConfigurationFile(directory: string, value: string | undefined) {
  if (value === undefined) return undefined;
  const path = join(directory, `configuration-${randomUUID()}.json`);
  writeFileSync(path, value, { mode: 0o600 });
  return path;
}
