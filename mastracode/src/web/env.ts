import { existsSync, readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let loaded = false;

export function loadWebEnvFiles(cwd = process.cwd()): void {
  if (loaded) return;
  loaded = true;

  const protectedKeys = new Set(Object.keys(process.env));
  const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
  const candidates = uniquePaths([
    join(cwd, '.env'),
    join(cwd, '.env.local'),
    join(packageRoot, '.env'),
    join(packageRoot, '.env.local'),
  ]);

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    loadEnvFile(filePath, protectedKeys);
  }
}

function loadEnvFile(filePath: string, protectedKeys: Set<string>): void {
  const contents = readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (!protectedKeys.has(key)) process.env[key] = value;
  }
}

function parseEnvLine(line: string): [string, string] | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return undefined;

  const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trimStart() : trimmed;
  const equalsIndex = withoutExport.indexOf('=');
  if (equalsIndex <= 0) return undefined;

  const key = withoutExport.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return undefined;

  const rawValue = withoutExport.slice(equalsIndex + 1).trim();
  return [key, parseEnvValue(rawValue)];
}

function parseEnvValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return stripInlineComment(value).trim();
}

function stripInlineComment(value: string): string {
  const hashIndex = value.search(/\s#/);
  return hashIndex === -1 ? value : value.slice(0, hashIndex);
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const candidate of paths) {
    const normalized = path.resolve(candidate);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
