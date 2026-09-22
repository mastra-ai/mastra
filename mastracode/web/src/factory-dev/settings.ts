import fs from 'node:fs/promises';
import path from 'node:path';

export type DatabaseSettings =
  | { provider: 'libsql' }
  | { provider: 'postgres-local' }
  | { provider: 'platform'; databaseId: string };

export interface FactoryDevSettings {
  version: 1;
  auth: { source: 'mastra-cli-session' };
  organization: { id: string; name: string };
  project: { id: string; name: string };
  environment: { id: string; name: string };
  database: DatabaseSettings;
  sandbox: { provider: 'local' | 'platform' };
}

export const settingsPath = (root: string) => path.join(root, '.factory', 'settings.json');

export async function loadSettings(root: string): Promise<FactoryDevSettings | null> {
  try {
    const value = JSON.parse(await fs.readFile(settingsPath(root), 'utf8')) as FactoryDevSettings;
    if (value.version !== 1) throw new Error(`Unsupported Factory settings version: ${value.version}`);
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveSettings(root: string, settings: FactoryDevSettings): Promise<void> {
  const file = settingsPath(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
}

export async function loadEnvironmentValue(file: string, key: string): Promise<string | undefined> {
  const contents = await fs.readFile(file, 'utf8').catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  });
  const line = contents.split('\n').find(candidate => candidate.startsWith(`${key}=`));
  if (!line) return undefined;
  const value = line.slice(key.length + 1).trim();
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'string' ? parsed : value;
  } catch {
    return value;
  }
}

export async function saveEnvironment(
  file: string,
  values: Record<string, string | undefined>,
): Promise<void> {
  const existing = await fs.readFile(file, 'utf8').catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  });
  const managedKeys = new Set(Object.keys(values));
  const lines = existing.split('\n').filter(line => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    return !match || !managedKeys.has(match[1]!);
  });
  while (lines.at(-1) === '') lines.pop();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) lines.push(`${key}=${JSON.stringify(value)}`);
  }
  await fs.writeFile(file, `${lines.join('\n')}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

export function localPostgresUrl(env: NodeJS.ProcessEnv): string {
  const user = env.POSTGRES_USER || 'user';
  const password = env.POSTGRES_PASSWORD || 'pass';
  const database = env.POSTGRES_DB || 'mastracode_web';
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:54329/${encodeURIComponent(database)}`;
}
