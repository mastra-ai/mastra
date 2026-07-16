#!/usr/bin/env node
import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(webRoot, 'src', 'web', 'factory', 'factory-skills');
const destination = path.join(webRoot, '.mastra', 'output', 'factory-skills');
const skillFiles = ['understand-issue/SKILL.md', 'understand-pr/SKILL.md'];

await Promise.all(skillFiles.map(skillFile => access(path.join(source, skillFile))));
await mkdir(path.dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
await Promise.all(skillFiles.map(skillFile => access(path.join(destination, skillFile))));
