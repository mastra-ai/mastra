import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { probeLmStudioModels, probeOpenAICompatibleModels } from './lmstudio';

let cleanupServer: (() => Promise<void>) | undefined;

async function withModelServer(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  cleanupServer = () => new Promise(resolve => server.close(() => resolve()));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1`;
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

afterEach(async () => {
  await cleanupServer?.();
  cleanupServer = undefined;
});

describe('probeOpenAICompatibleModels', () => {
  describe('when the model server returns an OpenAI-compatible model list', () => {
    it('returns model ids from /v1/models', async () => {
      const requests: string[] = [];
      const modelUrl = await withModelServer((req, res) => {
        requests.push(req.url ?? '');
        json(res, 200, { data: [{ id: 'loaded-model' }, { id: 'other-model' }] });
      });

      await expect(probeOpenAICompatibleModels(modelUrl, 'Local server')).resolves.toEqual({
        ok: true,
        modelUrl,
        models: ['loaded-model', 'other-model'],
        error: undefined,
      });
      expect(requests).toEqual(['/v1/models']);
    });
  });

  describe('when the model server returns a failing HTTP status', () => {
    it('reports the provider-specific status error', async () => {
      const modelUrl = await withModelServer((_req, res) => {
        json(res, 503, { error: 'unavailable' });
      });

      await expect(probeOpenAICompatibleModels(modelUrl, 'Ollama')).resolves.toMatchObject({
        ok: false,
        models: [],
        error: 'Ollama returned HTTP 503',
      });
    });
  });

  describe('when the model server returns no loaded models', () => {
    it('keeps the probe successful but reports the empty state', async () => {
      const modelUrl = await withModelServer((_req, res) => {
        json(res, 200, { data: [] });
      });

      await expect(probeLmStudioModels(modelUrl)).resolves.toMatchObject({
        ok: true,
        models: [],
        error: 'LM Studio did not report any loaded models',
      });
    });
  });

  describe('when the model server response is malformed', () => {
    it('reports an invalid model list', async () => {
      const modelUrl = await withModelServer((_req, res) => {
        json(res, 200, { models: [] });
      });

      await expect(probeLmStudioModels(modelUrl)).resolves.toMatchObject({
        ok: false,
        models: [],
        error: 'LM Studio returned an invalid model list',
      });
    });
  });

  describe('when the model server is unreachable', () => {
    it('reports the connection failure', async () => {
      const modelUrl = await withModelServer((_req, res) => {
        json(res, 200, { data: [] });
      });
      await cleanupServer?.();
      cleanupServer = undefined;

      await expect(probeLmStudioModels(modelUrl)).resolves.toMatchObject({
        ok: false,
        models: [],
      });
    });
  });
});
