#!/usr/bin/env node
/**
 * Copies the Factory skill assets shipped with `@mastra/factory` into the
 * Mastra entry's `public/` dir so `mastra build` bundles them into
 * `.mastra/output/factory-skills/` (validated by validate-output.mjs). The
 * copy is build-output only — `src/mastra/public/factory-skills/` is
 * gitignored; the canonical assets live in the factory package.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const factoryRoot = path.dirname(require.resolve('@mastra/factory/package.json'));
const source = path.join(factoryRoot, 'factory-skills');
const destination = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/mastra/public/factory-skills');

if (!fs.existsSync(source)) {
  console.error(`copy-factory-skills: ${source} not found — is @mastra/factory installed?`);
  process.exit(1);
}
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
console.log(`copy-factory-skills: ${source} -> ${destination}`);
