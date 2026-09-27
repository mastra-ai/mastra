import { Readable } from 'node:stream';

import type { SourceCatalog } from '../../src/mastra/workspaces/catalog.js';

type ObjectFixture = {
  key: string;
  content: Buffer;
  etag: string;
  modifiedAt: Date;
  announcedSize?: number;
  headSize?: number;
};

export function s3Fixture() {
  const objects = new Map<string, ObjectFixture>();
  const calls: Array<{ operation: string; key?: string }> = [];
  let failed = false;
  let incomplete = false;
  let mutateOnRead = false;
  let hangingBody = false;
  let includesOutOfPrefix = false;
  const unreadableKeys = new Set<string>();
  let cancelledBodies = 0;
  let pageSize = 2;
  return {
    objects,
    calls,
    setFailed(value: boolean) {
      failed = value;
    },
    setIncomplete(value: boolean) {
      incomplete = value;
    },
    setMutateOnRead(value: boolean) {
      mutateOnRead = value;
    },
    setHangingBody(value: boolean) {
      hangingBody = value;
    },
    setIncludesOutOfPrefix(value: boolean) {
      includesOutOfPrefix = value;
    },
    setUnreadable(key: string, value: boolean) {
      if (value) unreadableKeys.add(key);
      else unreadableKeys.delete(key);
    },
    setPageSize(value: number) {
      pageSize = value;
    },
    get cancelledBodies() {
      return cancelledBodies;
    },
    client: {
      async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
        const input = command.input;
        const operation = command.constructor.name;
        calls.push({ operation, ...(typeof input.Key === 'string' ? { key: input.Key } : {}) });
        if (failed) throw new Error('synthetic S3 failure');
        if (operation === 'ListObjectsV2Command') {
          const prefix = String(input.Prefix ?? '');
          const start = Number(input.ContinuationToken ?? 0);
          const entries = [...objects.values()].filter(object => object.key.startsWith(prefix));
          if (includesOutOfPrefix) {
            const outsider = [...objects.values()].find(object => !object.key.startsWith(prefix));
            if (outsider) entries.push(outsider);
          }
          const page = entries.slice(start, start + pageSize);
          const next = start + page.length < entries.length ? String(start + page.length) : undefined;
          return {
            Contents: page.map(object => ({
              Key: object.key,
              ETag: object.etag,
              Size: object.announcedSize ?? object.content.length,
              LastModified: object.modifiedAt,
            })),
            IsTruncated: incomplete || Boolean(next),
            NextContinuationToken: incomplete ? '0' : next,
          };
        }
        const key = String(input.Key);
        const object = objects.get(key);
        if (!object) {
          const error = new Error('missing');
          error.name = 'NoSuchKey';
          throw error;
        }
        if (operation === 'HeadObjectCommand') {
          return {
            ETag: object.etag,
            ContentLength: object.headSize ?? object.content.length,
            LastModified: object.modifiedAt,
          };
        }
        if (operation === 'GetObjectCommand') {
          if (unreadableKeys.has(key)) {
            const error = new Error('synthetic object read failure');
            error.name = 'AccessDenied';
            throw error;
          }
          if (mutateOnRead) object.etag += '-changed';
          if (input.IfMatch && input.IfMatch !== object.etag) {
            const error = new Error('changed');
            error.name = 'PreconditionFailed';
            throw error;
          }
          const body = hangingBody ? new Readable({ read() {} }) : Readable.from([object.content]);
          const destroy = body.destroy.bind(body);
          body.destroy = (...args) => {
            cancelledBodies++;
            return destroy(...args);
          };
          return { ETag: object.etag, Body: body };
        }
        throw new Error('Unexpected operation ' + operation);
      },
    },
  };
}

export function environment() {
  return {
    OPENAI_API_KEY: 'synthetic-openai-key',
    GOOGLE_DRIVE_CLIENT_EMAIL: 'source-test@example.test',
    GOOGLE_DRIVE_PRIVATE_KEY: 'synthetic-private-key',
    S3_ACCESS_KEY_ID: 'synthetic-s3-access-key',
    S3_SECRET_ACCESS_KEY: 'synthetic-s3-secret-key',
  };
}

export function catalog(): SourceCatalog {
  return {
    version: 1,
    sources: [
      {
        id: 'drive',
        provider: 'google-drive',
        mountPath: '/drive',
        folderId: 'drive-root',
        credentialRef: 'organization',
        enabled: true,
      },
      {
        id: 'archive',
        provider: 's3',
        mountPath: '/archive',
        bucket: 'synthetic-archive',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        region: 'auto',
        prefix: 'organization/',
        credentialRef: 'organization',
        enabled: true,
      },
    ],
  };
}
