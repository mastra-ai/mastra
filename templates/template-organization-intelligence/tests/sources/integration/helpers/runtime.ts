import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SourceIndex } from '../../../../src/mastra/workspaces/source-index.js';
import type { EmbeddingFunction } from '../../../../src/mastra/workspaces/source-index.js';
import { createSourceRuntime } from '../../../../src/mastra/workspaces/sources.js';
import type { googleFixture } from '../../../fixtures/records.js';

export async function openSourceIndex(
  directory: string,
  drive: ReturnType<typeof googleFixture>,
  embed: EmbeddingFunction,
) {
  await mkdir(join(directory, 'records'), { recursive: true });
  const sources = await createSourceRuntime({
    catalog: {
      version: 1,
      sources: [
        { id: 'local', provider: 'local', root: join(directory, 'records'), mountPath: '/local', enabled: true },
        {
          id: 'drive',
          provider: 'google-drive',
          folderId: 'root',
          credentialRef: 'organization',
          mountPath: '/drive',
          enabled: true,
        },
      ],
    },
    catalogPath: join(directory, 'source-catalog.json'),
    ledgerPath: join(directory, 'source-identities.json'),
    environment: { GOOGLE_DRIVE_CLIENT_EMAIL: 'fixture@example.test', GOOGLE_DRIVE_PRIVATE_KEY: 'fixture-key' },
    driveAccessToken: async () => 'fixture-token',
    driveRequest: drive.request,
  });
  const index = new SourceIndex({ databaseUrl: 'file:' + join(directory, 'index.db'), sources, embed });
  await index.initialize();
  return index;
}
