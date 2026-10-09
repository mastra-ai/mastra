import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { validateCatalog, validateEnvironment } from '../../../src/mastra/workspaces/catalog.js';
import { BoundedS3Filesystem, ScopedS3Reader } from '../../../src/mastra/workspaces/s3-source.js';
import { createSourceRuntime } from '../../../src/mastra/workspaces/sources.js';
import { googleFixture } from '../../fixtures/records.js';
import { catalog, environment, s3Fixture } from '../../fixtures/s3.js';
import { runtime } from './helpers/runtime.js';

describe('S3 multi-mount integration', () => {
  it('S3 catalog and identity preserve readonly containment', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-s3-'));
    try {
      const unsafe = catalog();
      unsafe.sources[1] = { ...unsafe.sources[1]!, prefix: '../escape/' } as never;
      await expect(validateCatalog(unsafe, join(directory, 'source-catalog.json'))).rejects.toThrow('prefix');
      let providerFactoryCalls = 0;
      const ledgerPath = join(directory, 'invalid', 'identities.json');
      await expect(
        createSourceRuntime({
          catalog: unsafe,
          catalogPath: join(directory, 'source-catalog.json'),
          ledgerPath,
          environment: environment(),
          configureS3Client: () => {
            providerFactoryCalls++;
          },
        }),
      ).rejects.toThrow('prefix');
      expect(providerFactoryCalls).toBe(0);
      await expect(access(ledgerPath)).rejects.toMatchObject({ code: 'ENOENT' });
      const ambiguous = catalog();
      ambiguous.sources[1] = { ...ambiguous.sources[1]!, prefix: 'organization//private/' } as never;
      await expect(validateCatalog(ambiguous, join(directory, 'source-catalog.json'))).rejects.toThrow('prefix');
      const aliasedEndpoint = catalog();
      aliasedEndpoint.sources[1] = {
        ...aliasedEndpoint.sources[1]!,
        endpoint: 'https://account.r2.cloudflarestorage.com/%2e',
      } as never;
      await expect(validateCatalog(aliasedEndpoint, join(directory, 'source-catalog.json'))).rejects.toThrow(
        'endpoint',
      );
      const overlapping = catalog();
      const archive = overlapping.sources[1]!;
      if (archive.provider !== 's3') throw new Error('Expected S3 archive fixture.');
      overlapping.sources.push({ ...archive, id: 'nested', mountPath: '/nested', prefix: 'organization/private/' });
      await expect(validateCatalog(overlapping, join(directory, 'source-catalog.json'))).rejects.toThrow('overlap');
      expect(validateEnvironment(catalog(), { ...environment(), S3_SECRET_ACCESS_KEY: '' })).toEqual(
        expect.arrayContaining(['Enabled S3 sources require both accepted S3 credential settings.']),
      );
      const mounted = await runtime(directory);
      const remapped = catalog();
      remapped.sources[1] = { ...remapped.sources[1]!, prefix: 'other/' } as never;
      await expect(runtime(directory, googleFixture(), s3Fixture(), remapped)).rejects.toThrow(
        'changed provider or root',
      );
      expect(mounted.catalog.sources[1]).toMatchObject({
        endpoint: 'https://account.r2.cloudflarestorage.com',
        prefix: 'organization/',
      });
      const requests: Array<{ method?: string; headers?: Record<string, string> }> = [];
      const client = new S3Client({
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        credentials: { accessKeyId: 'synthetic-access', secretAccessKey: 'synthetic-secret' },
        maxAttempts: 1,
        requestHandler: {
          handle: async (request: unknown) => {
            requests.push(request as { method?: string; headers?: Record<string, string> });
            return { response: { statusCode: 200, headers: {}, body: Readable.from([]) } };
          },
        },
      });
      const s3 = catalog().sources[1]!;
      if (s3.provider !== 's3') throw new Error('Expected S3 archive fixture.');
      const filesystem = new BoundedS3Filesystem(
        {
          id: s3.id,
          bucket: s3.bucket,
          region: s3.region,
          endpoint: s3.endpoint,
          prefix: s3.prefix,
          readOnly: true,
          credentials: { accessKeyId: 'synthetic-access', secretAccessKey: 'synthetic-secret' },
        },
        s3,
      );
      filesystem.client.config.requestHandler = client.config.requestHandler;
      await filesystem.init();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.method).toBe('HEAD');
      expect(JSON.stringify(filesystem.getMountConfig())).not.toContain('synthetic-secret');
      let transientAttempts = 0;
      const retryClient = new S3Client({
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        credentials: { accessKeyId: 'synthetic-access', secretAccessKey: 'synthetic-secret' },
        maxAttempts: 1,
        requestHandler: {
          handle: async () => {
            transientAttempts++;
            return { response: { statusCode: 503, headers: {}, body: Readable.from([]) } };
          },
        },
      });
      const priorAttempts = process.env.AWS_MAX_ATTEMPTS;
      process.env.AWS_MAX_ATTEMPTS = '9';
      try {
        const retryFilesystem = new BoundedS3Filesystem(
          {
            id: s3.id,
            bucket: s3.bucket,
            region: s3.region,
            endpoint: s3.endpoint,
            prefix: s3.prefix,
            readOnly: true,
            credentials: { accessKeyId: 'synthetic-access', secretAccessKey: 'synthetic-secret' },
          },
          s3,
        );
        retryFilesystem.client.config.requestHandler = retryClient.config.requestHandler;
        await expect(retryFilesystem.init()).rejects.toThrow('unavailable');
        expect(transientAttempts).toBe(3);
      } finally {
        if (priorAttempts === undefined) delete process.env.AWS_MAX_ATTEMPTS;
        else process.env.AWS_MAX_ATTEMPTS = priorAttempts;
      }
      const forgedClient = s3Fixture();
      const scoped = new ScopedS3Reader(s3, forgedClient.client);
      expect(await scoped.list('other-prefix/')).toMatchObject({ complete: false, objects: [] });
      await expect(
        scoped.extract({ key: 'other-prefix/secret.md', relativePath: 'secret.md', title: 'secret.md' }),
      ).rejects.toThrow('outside its configured source');
      expect(forgedClient.calls).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
