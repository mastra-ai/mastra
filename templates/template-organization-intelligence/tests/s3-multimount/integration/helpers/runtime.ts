import { join } from 'node:path';

import { LocalFilesystem } from '@mastra/core/workspace';
import { vi } from 'vitest';

import { SourceIndex } from '../../../../src/mastra/workspaces/source-index.js';
import { createSourceRuntime } from '../../../../src/mastra/workspaces/sources.js';
import { googleFixture } from '../../../fixtures/records.js';

import { catalog, environment, s3Fixture } from '../../../fixtures/s3.js';

export async function runtime(
  directory: string,
  drive = googleFixture(),
  s3 = s3Fixture(),
  configuration = catalog(),
  driveRoot?: string,
) {
  return createSourceRuntime({
    catalog: configuration,
    catalogPath: join(directory, 'source-catalog.json'),
    ledgerPath: join(directory, 'state', 'identities.json'),
    environment: environment(),
    driveAccessToken: async () => 'synthetic-drive-token',
    driveRequest: drive.request,
    configureS3Client: client => {
      vi.spyOn(client, 'send').mockImplementation(s3.client.send as never);
    },
    ...(driveRoot
      ? {
          driveFilesystemFactory: () => new LocalFilesystem({ basePath: driveRoot, contained: true, readOnly: true }),
        }
      : {}),
  });
}

export async function index(
  directory: string,
  drive = googleFixture(),
  s3 = s3Fixture(),
  configuration = catalog(),
  embedding?: (text: string, observed: string[]) => Promise<number[]>,
) {
  const sources = await runtime(directory, drive, s3, configuration);
  const embedded: string[] = [];
  const sourceIndex = new SourceIndex({
    databaseUrl: 'file:' + join(directory, 'state', 'index.db'),
    sources,
    embed: async text => {
      embedded.push(text);
      return embedding?.(text, embedded) ?? [text.includes('Drive') ? 1 : 0, text.includes('Archive') ? 1 : 0];
    },
  });
  await sourceIndex.initialize();
  return { sources, sourceIndex, embedded };
}
