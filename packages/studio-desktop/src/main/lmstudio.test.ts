import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { probeLmStudioModels, probeLocalModels, probeOllamaModels, probeOpenAICompatibleModels } from './lmstudio';

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

    it('sends an Authorization header when a real API key is configured', async () => {
      const authorizationHeaders: Array<string | undefined> = [];
      const modelUrl = await withModelServer((req, res) => {
        authorizationHeaders.push(req.headers.authorization);
        json(res, 200, { data: [{ id: 'loaded-model' }] });
      });

      await expect(probeOpenAICompatibleModels(modelUrl, 'Local server', 'secret-token')).resolves.toMatchObject({
        ok: true,
        models: ['loaded-model'],
      });
      expect(authorizationHeaders).toEqual(['Bearer secret-token']);
    });

    it('does not send an Authorization header for placeholder API key values', async () => {
      const authorizationHeaders: Array<string | undefined> = [];
      const modelUrl = await withModelServer((req, res) => {
        authorizationHeaders.push(req.headers.authorization);
        json(res, 200, { data: [{ id: 'loaded-model' }] });
      });

      await expect(probeLmStudioModels(modelUrl, 'not-needed')).resolves.toMatchObject({
        ok: true,
        models: ['loaded-model'],
      });
      expect(authorizationHeaders).toEqual([undefined]);
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

describe('probeOllamaModels', () => {
  it('returns locally installed model names from /api/tags', async () => {
    const requests: string[] = [];
    const modelUrl = await withModelServer((req, res) => {
      requests.push(req.url ?? '');
      json(res, 200, { models: [{ name: 'llama3.2:latest' }, { model: 'mistral:7b' }] });
    });

    await expect(probeOllamaModels(modelUrl)).resolves.toEqual({
      ok: true,
      modelUrl,
      models: ['llama3.2:latest', 'mistral:7b'],
      error: undefined,
    });
    expect(requests).toEqual(['/api/tags']);
  });

  it('reports malformed Ollama tag responses', async () => {
    const modelUrl = await withModelServer((_req, res) => {
      json(res, 200, { data: [] });
    });

    await expect(probeOllamaModels(modelUrl)).resolves.toMatchObject({
      ok: false,
      models: [],
      error: 'Ollama returned an invalid model list',
    });
  });
});

describe('probeLocalModels', () => {
  it('uses the native Ollama model list for Ollama presets', async () => {
    const requests: string[] = [];
    const modelUrl = await withModelServer((req, res) => {
      requests.push(req.url ?? '');
      json(res, 200, { models: [{ name: 'llama3.2:latest' }] });
    });

    await expect(probeLocalModels({ modelUrl, providerId: 'ollama' })).resolves.toMatchObject({
      ok: true,
      models: ['llama3.2:latest'],
    });
    expect(requests).toEqual(['/api/tags']);
  });

  it('uses OpenAI-compatible model lists for LM Studio presets', async () => {
    const requests: string[] = [];
    const modelUrl = await withModelServer((req, res) => {
      requests.push(req.url ?? '');
      json(res, 200, { data: [{ id: 'loaded-model' }] });
    });

    await expect(probeLocalModels({ modelUrl, providerId: 'lmstudio' })).resolves.toMatchObject({
      ok: true,
      models: ['loaded-model'],
    });
    expect(requests).toEqual(['/v1/models']);
  });
});
