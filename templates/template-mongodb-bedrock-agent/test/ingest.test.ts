import { spawn } from 'node:child_process';
import { createServer, type RequestListener } from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { expect, test } from 'vitest';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

async function ingest(handler: RequestListener, env: Record<string, string> = {}) {
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP test port');

  try {
    return await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', './test/http-redirect.mjs', '--import', 'tsx', 'scripts/ingest.ts'],
        {
          cwd: projectRoot,
          env: {
            PATH: process.env.PATH,
            AWS_ACCESS_KEY_ID: 'test',
            AWS_SECRET_ACCESS_KEY: 'test',
            AWS_REGION: 'us-east-1',
            AWS_EC2_METADATA_DISABLED: 'true',
            MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:1/test',
            MONGODB_DATABASE: 'ingest_http_error',
            TEST_HTTP_PORT: String(address.port),
            ...env,
          },
          timeout: 80_000,
        },
      );
      let output = '';
      child.stdout.on('data', data => (output += data));
      child.stderr.on('data', data => (output += data));
      child.on('error', reject);
      child.on('close', code => resolve({ code, output }));
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

test('fails ingestion when the documentation index returns HTTP 503', async () => {
  const result = await ingest((_req, res) => {
    res.writeHead(503);
    res.end('Documentation is temporarily unavailable');
  });
  expect(result.output).toContain('HTTP 503');
  expect(result.code).toBe(1);
  expect(result.output).not.toContain('Done.');
});

test.skipIf(!process.env.TEST_MONGODB_URI)(
  'finishes the first ingestion with a ready vector index and stored documents',
  async () => {
    const client = new MongoClient(process.env.TEST_MONGODB_URI!);
    const db = client.db(`ingest_${randomUUID().replaceAll('-', '')}`);
    try {
      const result = await ingest(
        (req, res) => {
          if (req.url === '/llms.txt') {
            res.end('[Introduction](https://mastra.ai/docs/introduction.md)');
          } else if (req.url === '/docs/introduction.md') {
            res.end('# Introduction\n\nUse Mastra to build an agent.');
          } else {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ embedding: Array(1024).fill(0.1), inputTextTokenCount: 10 }));
          }
        },
        { MONGODB_DATABASE: db.databaseName },
      );
      expect(result.code, result.output).toBe(0);
      expect(result.output).not.toContain('SKIPPED');
      const collection = db.collection('mastra_docs_embeddings');
      const indexes = await collection.listSearchIndexes().toArray();
      expect(indexes.find(index => index.name === 'mastra_docs_embeddings_vector_index')?.status).toBe('READY');
      const documents = await collection.find().toArray();
      expect(documents).toHaveLength(1);
      expect(documents[0].metadata.mdUrl).toBe('https://mastra.ai/docs/introduction.md');
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);

test('stops when the vector index configuration is invalid', async () => {
  const result = await ingest(
    (req, res) => {
      if (req.url === '/llms.txt') {
        res.end('[Introduction](https://mastra.ai/docs/introduction.md)');
      } else {
        res.writeHead(503);
        res.end('Unavailable');
      }
    },
    { EMBED_DIMENSION: '0' },
  );
  expect(result.output).toContain('Dimension must be a positive integer');
  expect(result.code).toBe(1);
  expect(result.output).not.toContain('SKIPPED');
  expect(result.output).not.toContain('Done.');
});

test.skipIf(!process.env.TEST_MONGODB_URI)(
  'removes obsolete chunks and excluded pages only after a complete ingestion',
  async () => {
    const client = new MongoClient(process.env.TEST_MONGODB_URI!);
    const db = client.db(`ingest_${randomUUID().replaceAll('-', '')}`);
    let introduction = '# Introduction\n\n' + 'Use Mastra to build agents. '.repeat(150);
    let pageStatus = 200;
    const handler: RequestListener = (req, res) => {
      if (req.url === '/llms.txt') {
        res.end('[Introduction](https://mastra.ai/docs/introduction.md)\n[Tools](https://mastra.ai/docs/tools.md)');
      } else if (req.url?.startsWith('/docs/')) {
        res.writeHead(pageStatus);
        res.end(req.url === '/docs/introduction.md' ? introduction : '# Tools\n\nAgents can call tools.');
      } else {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ embedding: Array(1024).fill(0.1), inputTextTokenCount: 10 }));
      }
    };
    const env = { MONGODB_DATABASE: db.databaseName };
    const collection = db.collection('mastra_docs_embeddings');
    try {
      const first = await ingest(handler, env);
      expect(first.code, first.output).toBe(0);
      expect(await collection.countDocuments()).toBeGreaterThan(2);
      // Include records written by the original template before generation tags existed.
      await collection.updateMany({}, { $unset: { 'metadata.ingestionId': '' } });
      const unrelated = { metadata: { mdUrl: 'https://another.example/guide.md', text: 'Keep this source' } };
      await collection.insertOne(unrelated);

      introduction = '# Introduction\n\nBuild an agent with Mastra.';
      const second = await ingest(handler, { ...env, DOCS_LIMIT: '1' });
      expect(second.code, second.output).toBe(0);
      const current = await collection.find().toArray();
      expect(current).toHaveLength(2);
      const introductionDoc = current.find(doc => doc.metadata.mdUrl === 'https://mastra.ai/docs/introduction.md');
      expect(introductionDoc?.metadata.text).toContain('Build an agent with Mastra.');
      expect(current.find(doc => doc.metadata.mdUrl === unrelated.metadata.mdUrl)?.metadata).toEqual(
        unrelated.metadata,
      );

      const empty = await ingest((_req, res) => res.end('No links available'), env);
      expect(empty.code, empty.output).toBe(1);
      expect(await collection.find().toArray()).toEqual(current);

      pageStatus = 503;
      const failed = await ingest(handler, env);
      expect(failed.code, failed.output).toBe(1);
      expect(failed.output).not.toContain('Done.');
      expect(await collection.find().toArray()).toEqual(current);
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);
