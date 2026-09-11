import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

export const packageRoot = process.env.MASTRA_CONNECT_PACKAGE_ROOT
  ? resolve(process.env.MASTRA_CONNECT_PACKAGE_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const templatesDir = resolve(packageRoot, '.templates', 'integrations');
export const providersDir = resolve(packageRoot, 'src', 'providers');
export const providerIndexPath = resolve(providersDir, 'index.ts');

export function isDirectExecution(metaUrl: string): boolean {
  return Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(metaUrl));
}

export interface ProviderManifest {
  providerId: string;
  localId: string;
  templateSha: string;
  /** Absent on older manifests, whose source is NangoHQ/integration-templates. */
  templateRepo?: string;
  generatedAt: string;
  toolCount: number;
  skippedActions: { action: string; reason: string }[];
  files: Record<string, string>;
}

export function validateProviderId(id: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id === '.' || id === '..') {
    throw new Error(
      `${label} must be a safe directory identifier containing only letters, numbers, dots, underscores, and hyphens.`,
    );
  }
}

export function providerDir(localId: string): string {
  validateProviderId(localId, 'Local ID');
  return resolve(providersDir, localId);
}

export function listInstalledProviderIds(): string[] {
  if (!existsSync(providersDir)) return [];
  return readdirSync(providersDir, { withFileTypes: true })
    .filter(
      entry =>
        entry.isDirectory() &&
        // Dot-prefixed directories are generator scratch space (e.g. a
        // temporary dir left behind by a killed generate run), never providers.
        !entry.name.startsWith('.') &&
        existsSync(resolve(providersDir, entry.name, 'index.ts')),
    )
    .map(entry => entry.name)
    .sort();
}

export function providerRegistrationName(localId: string): string {
  const camel = localId.replace(/[-._]+(\w)/g, (_, ch: string) => ch.toUpperCase());
  // A leading digit (e.g. '1password') would make the camelized ID an invalid
  // TypeScript identifier; prefix it so the generated modules still parse.
  return `${/^\d/.test(camel) ? `_${camel}` : camel}Provider`;
}

export function updateProviderIndex(): void {
  const installed = listInstalledProviderIds();
  const imports = installed.map(id => `import { ${providerRegistrationName(id)} } from './${id}/index.js';`);
  const entries = installed.map(id => `  ${providerRegistrationName(id)},`);
  const body = [
    '// AUTO-GENERATED — do not edit by hand.',
    '// Updated by the maintainer-only add-provider and remove-provider commands.',
    "import type { ProviderRegistration } from '../registry.js';",
    ...(imports.length > 0 ? ['', ...imports] : []),
    '',
    'export const PROVIDERS: readonly ProviderRegistration[] = [',
    ...entries,
    '];',
    '',
  ].join('\n');
  writeFileSync(providerIndexPath, body);
}

export function readManifest(localId: string): ProviderManifest | undefined {
  const path = resolve(providerDir(localId), '.manifest.json');
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ProviderManifest;
  } catch {
    // A truncated or hand-edited manifest gets the same treatment as a
    // missing one: callers fall through to their "no generator manifest"
    // handling instead of surfacing a raw SyntaxError.
    return undefined;
  }
}

function listFilesRecursive(root: string, current = root): string[] {
  if (!existsSync(current)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...listFilesRecursive(root, path));
    else if (entry.isFile() && entry.name !== '.manifest.json') files.push(relative(root, path));
  }
  return files.sort();
}

export function calculateFileChecksums(root: string): Record<string, string> {
  return Object.fromEntries(
    listFilesRecursive(root).map(file => {
      const contents = readFileSync(resolve(root, file));
      return [file, createHash('sha256').update(contents).digest('hex')];
    }),
  );
}

export function findModifiedFiles(localId: string, manifest: ProviderManifest): string[] {
  const current = calculateFileChecksums(providerDir(localId));
  const paths = new Set([...Object.keys(manifest.files), ...Object.keys(current)]);
  return [...paths].filter(path => manifest.files[path] !== current[path]).sort();
}

export async function confirm(message: string, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) return true;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${message} Re-run with --yes in a non-interactive terminal.`);
  }

  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await readline.question(`${message} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    readline.close();
  }
}

export function currentTemplateSha(): string {
  const checkoutRoot = resolve(templatesDir, '..');
  if (!existsSync(resolve(checkoutRoot, '.git'))) {
    throw new Error('Template checkout is missing. Run `pnpm sync-templates` first.');
  }
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkoutRoot, encoding: 'utf8' }).trim();
}

export function templateProviderIds(): string[] {
  if (!existsSync(templatesDir)) return [];
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(resolve(templatesDir, entry.name, 'actions')))
    .map(entry => entry.name)
    .sort();
}
