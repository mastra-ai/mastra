#!/usr/bin/env node
// Packs @mastra/connect and checks what ships: the provider-neutral client
// surface is exported, and no Knowledge importer implementation, registry or
// provider importer module is in the tarball. Run after `pnpm build:lib`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const packageDir = new URL('..', import.meta.url).pathname;
const workDir = mkdtempSync(join(tmpdir(), 'connect-pack-'));

const failures = [];
try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', workDir], { cwd: packageDir, encoding: 'utf8' }),
  );
  const tarball = join(workDir, packed[0].filename);
  execFileSync('tar', ['-xzf', tarball, '-C', workDir]);
  const root = join(workDir, 'package');

  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(relative(root, path));
    }
  };
  walk(root);

  for (const file of files) {
    if (/importer/i.test(file)) failures.push(`importer module in tarball: ${file}`);
  }

  const forbidden = [/KnowledgeImporter/, /IMPORTERS\b/, /importer-runtime/, /importer-registry/, /\bimporters\s*\(/];
  for (const file of files.filter(file => /\.(c?js|d\.ts)$/.test(file))) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(text)) failures.push(`${file} matches ${pattern}`);
    }
  }

  const types = readFileSync(join(root, 'dist/index.d.ts'), 'utf8');
  for (const name of [
    'resolveClient',
    'listProjectConnections',
    'getConnectionContext',
    'proxyRequest',
    'proxyRequestWithResponse',
    'ProxyRequestOptions',
    'ProxyResponse',
    'ResolvedClient',
    'ConnectionContext',
  ]) {
    if (!new RegExp(`\\b${name}\\b`).test(types)) failures.push(`dist/index.d.ts does not export ${name}`);
  }

  console.log(`${packed[0].filename}: ${files.length} files checked`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('ok: client surface exported, no importer code packed');
