// @vitest-environment jsdom
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { requestBrowserStreamTicket } from '../browser-stream-ticket';
import { browserStreamTicketResponse } from './fixtures/browser-stream-ticket';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const TICKET_URL = `${BASE_URL}/api/agents/support-bot/browser/stream-ticket`;

describe('requestBrowserStreamTicket', () => {
  describe('when the server issues a ticket', () => {
    it('returns it', async () => {
      server.use(http.post(TICKET_URL, () => HttpResponse.json(browserStreamTicketResponse)));

      await expect(
        requestBrowserStreamTicket({ agentId: 'support-bot', threadId: 'thread-1', baseUrl: BASE_URL }),
      ).resolves.toBe(browserStreamTicketResponse.ticket);
    });

    it('authenticates the mint request with the configured headers', async () => {
      let authorization: string | null = null;
      server.use(
        http.post(TICKET_URL, ({ request }) => {
          authorization = request.headers.get('authorization');
          return HttpResponse.json(browserStreamTicketResponse);
        }),
      );

      await requestBrowserStreamTicket({
        agentId: 'support-bot',
        threadId: 'thread-1',
        baseUrl: BASE_URL,
        headers: { Authorization: 'Bearer abc123' },
      });

      expect(authorization).toBe('Bearer abc123');
    });

    it('uses the configured api prefix when one is set', async () => {
      server.use(
        http.post('http://localhost:4111/custom/agents/support-bot/browser/stream-ticket', () =>
          HttpResponse.json(browserStreamTicketResponse),
        ),
      );

      await expect(
        requestBrowserStreamTicket({
          agentId: 'support-bot',
          threadId: 'thread-1',
          baseUrl: BASE_URL,
          apiPrefix: '/custom',
        }),
      ).resolves.toBe(browserStreamTicketResponse.ticket);
    });
  });

  describe('when the server rejects the mint request', () => {
    it('returns undefined so the caller connects without a ticket', async () => {
      server.use(http.post(TICKET_URL, () => new HttpResponse(null, { status: 401 })));

      await expect(
        requestBrowserStreamTicket({ agentId: 'support-bot', threadId: 'thread-1', baseUrl: BASE_URL }),
      ).resolves.toBeUndefined();
    });
  });
});
