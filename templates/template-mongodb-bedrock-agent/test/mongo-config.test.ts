import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:mastra-docs-mongodb-ABCDEF';
const uri = 'mongodb://test-user:test-password@127.0.0.1:27017/docs';

/** Load startup configuration in a fresh process against a local Secrets Manager HTTP endpoint. */
async function loadMongoConfig(status: number, response: object, directUri?: string) {
  const requests: unknown[] = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push(JSON.parse(body));
    res.writeHead(status, { 'content-type': 'application/x-amz-json-1.1' });
    res.end(JSON.stringify(response));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  try {
    const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '--eval',
          "import { MONGODB_URI } from './src/mastra/mongo.ts'; console.log(MONGODB_URI);",
        ],
        {
          cwd: fileURLToPath(new URL('..', import.meta.url)),
          env: {
            PATH: process.env.PATH,
            AWS_ACCESS_KEY_ID: 'test',
            AWS_SECRET_ACCESS_KEY: 'test',
            AWS_REGION: 'us-east-1',
            AWS_EC2_METADATA_DISABLED: 'true',
            AWS_ENDPOINT_URL_SECRETS_MANAGER: `http://127.0.0.1:${address.port}`,
            MONGODB_SECRET_ARN: secretArn,
            ...(directUri ? { MONGODB_URI: directUri } : {}),
          },
          timeout: 10_000,
        },
      );
      let output = '';
      child.stdout.on('data', data => (output += data));
      child.stderr.on('data', data => (output += data));
      child.on('error', reject);
      child.on('close', code => resolve({ code, output }));
    });
    return { ...result, requests };
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('loads the deployed MongoDB URI from Secrets Manager using the runtime credentials', async () => {
  const result = await loadMongoConfig(200, { SecretString: uri });
  expect(result.code, result.output).toBe(0);
  expect(result.output.trim()).toBe(uri);
  expect(result.requests).toEqual([{ SecretId: secretArn }]);
});

test('keeps local MONGODB_URI configuration independent of Secrets Manager', async () => {
  const result = await loadMongoConfig(403, { __type: 'AccessDeniedException' }, uri);
  expect(result.code, result.output).toBe(0);
  expect(result.output.trim()).toBe(uri);
  expect(result.requests).toHaveLength(0);
});

test('fails startup if the runtime cannot read its MongoDB secret', async () => {
  const result = await loadMongoConfig(403, { __type: 'AccessDeniedException', message: 'Test access denied' });
  expect(result.code).toBe(1);
  expect(result.output).toContain('AccessDeniedException');
  expect(result.output).not.toContain(uri);
});
