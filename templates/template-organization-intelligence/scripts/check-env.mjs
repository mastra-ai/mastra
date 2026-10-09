import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

import { loadCatalog, validateEnvironment } from '../src/mastra/workspaces/catalog.ts';

const catalogPath = resolve(process.cwd(), 'source-catalog.json');
const stateDirectory = resolve(process.cwd(), '.mastra');
const databasePath = resolve(stateDirectory, 'organization-intelligence.db');

function fail(message) {
  process.stderr.write(`Environment check failed: ${message}\n`);
  process.exitCode = 1;
}

async function validateLocalStateLocation() {
  try {
    const directory = await stat(stateDirectory);
    if (!directory.isDirectory()) {
      fail('local state directory .mastra must be a directory.');
      return;
    }
    await access(stateDirectory, constants.R_OK | constants.W_OK | constants.X_OK);
  } catch (error) {
    if ((error instanceof Error ? error : {}).code !== 'ENOENT') {
      fail('local state directory .mastra is inaccessible.');
      return;
    }
    try {
      await access(process.cwd(), constants.W_OK | constants.X_OK);
    } catch {
      fail('the parent directory for local state is not writable.');
    }
    return;
  }

  try {
    const database = await stat(databasePath);
    if (!database.isFile()) {
      fail('local state database organization-intelligence.db must be a regular file.');
      return;
    }
    await access(databasePath, constants.R_OK | constants.W_OK);
  } catch (error) {
    if ((error instanceof Error ? error : {}).code !== 'ENOENT') {
      fail('local state database organization-intelligence.db is inaccessible.');
    }
  }
}

let catalog;
try {
  catalog = await loadCatalog(catalogPath);
} catch (error) {
  fail((error instanceof Error ? error.message : 'Source catalog is invalid.').replace(/\n/g, ' '));
}

if (catalog) {
  for (const source of catalog.sources) {
    if (source.provider === 'local' && source.enabled) {
      try {
        const root = isAbsolute(source.root) ? source.root : resolve(process.cwd(), source.root);
        await access(root, constants.R_OK);
      } catch {
        fail(`local source ${source.id} root is not accessible.`);
      }
    }
  }
  for (const issue of validateEnvironment(catalog, process.env)) fail(issue);
}

const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 19) fail('Node.js 24.19.x is required.');

await validateLocalStateLocation();

if (!process.exitCode) {
  process.stdout.write(
    'Environment configuration is valid. Local libSQL state uses .mastra/organization-intelligence.db. Remote access was not attempted.\n',
  );
}
