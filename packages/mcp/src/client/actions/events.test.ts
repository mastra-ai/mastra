import { noopLogger } from '@mastra/core/logger';
import { describe, expect, it, vi } from 'vitest';
import type { InternalMastraMCPClient } from '../client';
import { EventClientActions } from './events';

describe('EventClientActions.list', () => {
  it('stops following events/list pages from a server that never stops paging', async () => {
    const listEvents = vi.fn(async (cursor?: string) => ({
      events: [],
      nextCursor: String(Number(cursor ?? 0) + 1),
    }));
    const client = { name: 'srv', getEventsCapability: () => ({}), listEvents };
    const actions = new EventClientActions({
      client: client as unknown as InternalMastraMCPClient,
      logger: noopLogger,
    });

    await expect(actions.list()).rejects.toMatchObject({ id: 'MCP_EVENTS_LIST_FAILED' });
    expect(listEvents).toHaveBeenCalledTimes(100);
  });
});
