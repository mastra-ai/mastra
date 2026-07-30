#!/usr/bin/env node
/**
 * Copies the canonical Web Factory skills from @mastra/factory into
 * src/mastra/public/factory-skills so `mastra build` ships them next to the
 * bundled server module. The public copy is generated — never edit it or
 * check it in; edit mastracode/factory/factory-skills instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(webRoot, 'package.json'));

const factoryPackageRoot = path.dirname(require.resolve('@mastra/factory/package.json'));
const sourceDir = path.join(factoryPackageRoot, 'factory-skills');
const destDir = path.join(webRoot, 'src', 'mastra', 'public', 'factory-skills');

if (!fs.existsSync(sourceDir)) {
  console.error(`factory-skills source not found: ${sourceDir}`);
  process.exit(1);
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.cpSync(sourceDir, destDir, { recursive: true });

const skillCount = fs.readdirSync(destDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
console.log(`synced ${skillCount} factory skills -> ${path.relative(webRoot, destDir)}`);
