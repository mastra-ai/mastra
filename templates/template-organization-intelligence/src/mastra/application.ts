import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { LibSQLStore } from '@mastra/libsql';

import { loadCatalog, validateEnvironment } from './workspaces/catalog.js';
import { openAIEmbedder } from './workspaces/embeddings.js';
import type { EmbeddingFunction } from './workspaces/source-index.js';
import { SourceIndex } from './workspaces/source-index.js';
import type { SourceRuntime } from './workspaces/sources.js';
import { createSourceRuntime } from './workspaces/sources.js';

export type ApplicationOptions = {
  projectRoot: string;
  environment?: NodeJS.ProcessEnv;
  embed?: EmbeddingFunction;
  sources?: SourceRuntime;
  now?: () => Date;
};

async function loadSources(options: ApplicationOptions, environment: NodeJS.ProcessEnv) {
  const catalogPath = resolve(options.projectRoot, 'source-catalog.json');
  const catalog = options.sources?.catalog ?? (await loadCatalog(catalogPath));
  const issues = validateEnvironment(catalog, environment);
  if (issues.length) throw new Error(issues.join(' '));
  return (
    options.sources ??
    createSourceRuntime({
      catalog,
      catalogPath,
      ledgerPath: resolve(options.projectRoot, '.mastra/source-identities.json'),
      environment,
    })
  );
}

async function createStorage(projectRoot: string) {
  const stateDirectory = resolve(projectRoot, '.mastra');
  await mkdir(stateDirectory, { recursive: true });
  const databaseUrl = `file:${resolve(stateDirectory, 'organization-intelligence.db')}`;
  const storage = new LibSQLStore({ id: 'organization-intelligence-state', url: databaseUrl });
  return { storage, databaseUrl };
}

/** Prepare shared state. Source indexing starts when Mastra starts its worker. */
export async function createOrganizationApplication(options: ApplicationOptions) {
  const environment = options.environment ?? process.env;
  const sources = await loadSources(options, environment);
  const { storage, databaseUrl } = await createStorage(options.projectRoot);
  const index = new SourceIndex({
    sources,
    databaseUrl,
    embed: options.embed ?? openAIEmbedder(environment.OPENAI_API_KEY!),
    now: options.now,
  });
  return {
    index,
    storage,
    sources,
    close: async () => {
      try {
        await index.close();
      } finally {
        await storage.close();
      }
    },
  };
}
