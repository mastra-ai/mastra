import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraClient } from '../client';
import { MastraClientError } from '../types';

interface SeenRequest {
  method: string;
  url: string;
  body: string;
}

describe('KnowledgeImporters', () => {
  let server: Server;
  let baseUrl: string;
  let seen: SeenRequest[];
  let respond: (req: IncomingMessage, res: ServerResponse) => void;

  beforeEach(async () => {
    seen = [];
    respond = (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    };
    server = createServer((req, res) => {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        seen.push({ method: req.method ?? '', url: req.url ?? '', body });
        respond(req, res);
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  function importers(apiPrefix?: string) {
    return new MastraClient({ baseUrl, apiPrefix, backoffMs: 1, maxBackoffMs: 1 }).getKnowledgeImporters();
  }

  describe('when the client is configured with an API prefix', () => {
    it('requests the custom routes at their own root path', async () => {
      respond = (_req, res) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ summaries: [] }));
      };

      await importers('/api').list();
      await importers('/api').runs('google drive', 5);

      expect(seen.map(r => r.url)).toEqual([
        '/knowledge-importers',
        '/knowledge-importers/google%20drive/runs?limit=5',
      ]);
    });
  });

  describe('when saving settings', () => {
    it('sends the settings and expected version as a JSON PUT', async () => {
      await importers().saveSettings('slack', {
        enabled: true,
        schedule: '*/30 * * * *',
        connectionId: null,
        options: { channels: ['eng'] },
        expectedVersion: 3,
      });

      expect(seen).toEqual([
        {
          method: 'PUT',
          url: '/knowledge-importers/slack/settings',
          body: JSON.stringify({
            enabled: true,
            schedule: '*/30 * * * *',
            connectionId: null,
            options: { channels: ['eng'] },
            expectedVersion: 3,
          }),
        },
      ]);
    });

    it('surfaces a version conflict with its status and code', async () => {
      respond = (_req, res) => {
        res.writeHead(409, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'version_conflict', message: 'stale' } }));
      };

      const error = await importers()
        .saveSettings('slack', { enabled: false, schedule: null, connectionId: null, options: {}, expectedVersion: 1 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MastraClientError);
      expect(error).toMatchObject({ status: 409, body: { error: { code: 'version_conflict' } } });
      expect(seen).toHaveLength(1);
    });
  });

  describe('when starting a run and the server fails', () => {
    it('does not retry, so a flaky 5xx cannot start a second import', async () => {
      respond = (_req, res) => {
        res.writeHead(502);
        res.end('bad gateway');
      };

      await expect(importers().run('notion')).rejects.toMatchObject({ status: 502 });
      await expect(importers().dryRun('notion')).rejects.toMatchObject({ status: 502 });

      expect(seen.map(r => `${r.method} ${r.url}`)).toEqual([
        'POST /knowledge-importers/notion/run',
        'POST /knowledge-importers/notion/dry-run',
      ]);
    });
  });

  describe('when previewing unsaved settings in a dry run', () => {
    it('wraps them in a settings field', async () => {
      respond = (_req, res) => {
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ runId: 'run_1' }));
      };

      const result = await importers().dryRun('github', { options: { repos: ['mastra-ai/mastra'] } });

      expect(result).toEqual({ runId: 'run_1' });
      expect(JSON.parse(seen[0]!.body)).toEqual({ settings: { options: { repos: ['mastra-ai/mastra'] } } });
    });
  });
});
