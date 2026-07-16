#!/usr/bin/env node
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(webRoot, 'src', 'web', 'factory', 'factory-skills');
const destination = path.join(webRoot, '.mastra', 'output', 'factory-skills');

await mkdir(path.dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
