import { MastraError } from '@mastra/core/error';
import { ProtocolError } from '@modelcontextprotocol/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';

import { defineEvent } from './define-event';
import { ServerEventRegistry, deriveDelivery } from './registry';
import type { BufferedEvent } from './ring-buffer';
import type { MCPServerEventPollResult } from './types';

const poll = async (): Promise<MCPServerEventPollResult> => ({ events: [], cursor: null });

describe('deriveDelivery', () => {
  it('serves an emit-fed type over push and poll', () => {
    expect(deriveDelivery('e', {})).toEqual(['push', 'poll']);
  });

  it('serves a type with a poll source over poll only', () => {
    expect(deriveDelivery('e', { poll })).toEqual(['poll']);
  });

  it('never widens a poll-source type to push', () => {
    expect(deriveDelivery('e', { poll, delivery: ['poll', 'push'] })).toEqual(['poll']);
  });

  it('narrows with an explicit delivery and drops modes the type cannot serve', () => {
    expect(deriveDelivery('e', { delivery: ['poll'] })).toEqual(['poll']);
    expect(deriveDelivery('e', { delivery: ['push', 'webhook'] })).toEqual(['push']);
  });

  it('accepts extra modes from other delivery mechanisms', () => {
    expect(deriveDelivery('e', {}, ['webhook'])).toEqual(['push', 'poll', 'webhook']);
    expect(deriveDelivery('e', { poll }, ['webhook'])).toEqual(['poll', 'webhook']);
  });

  it('rejects a definition left with no servable mode', () => {
    expect(() => deriveDelivery('e', { delivery: ['webhook'] })).toThrow(MastraError);
    expect(() => new ServerEventRegistry({ e: { delivery: [] } })).toThrow(/no delivery mode/);
    expect(() => new ServerEventRegistry({ e: { poll, delivery: ['push'] } })).toThrow(/no delivery mode/);
  });
});

describe('defineEvent', () => {
  it('types match and poll from the schemas', () => {
    const definition = defineEvent({
      inputSchema: z.object({ project: z.string().optional() }),
      payloadSchema: z.object({ id: z.string(), project: z.string() }),
      match: (args, data) => {
        expectTypeOf(args).toEqualTypeOf<{ project?: string | undefined }>();
        expectTypeOf(data).toEqualTypeOf<{ id: string; project: string }>();
        return !args.project || data.project === args.project;
      },
    });
    expect(definition.match?.({ project: 'a' }, { id: '1', project: 'b' })).toBe(false);
  });
});

describe('ServerEventRegistry', () => {
  function registry() {
    return new ServerEventRegistry({
      'ticket.created': defineEvent({ payloadSchema: z.object({ id: z.string() }) }),
      'build.finished': defineEvent({ poll }),
    });
  }

  it('records an emitted occurrence, filling eventId and timestamp, and hands it to live listeners', async () => {
    const events = registry();
    const event = events.resolve('ticket.created', 'push');
    const received: BufferedEvent[] = [];
    const unsubscribe = events.subscribe(event, entry => received.push(entry));

    const occurrence = await events.emit('ticket.created', { id: 't1' });
    expect(occurrence).toMatchObject({ name: 'ticket.created', data: { id: 't1' }, cursor: event.buffer!.head });
    expect(occurrence.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(occurrence.timestamp))).toBe(false);
    expect(received.map(entry => entry.occurrence.eventId)).toEqual([occurrence.eventId]);

    const explicit = await events.emit(
      'ticket.created',
      { id: 't2' },
      { eventId: 'fixed', timestamp: new Date('2026-01-01T00:00:00Z') },
    );
    expect(explicit).toMatchObject({ eventId: 'fixed', timestamp: '2026-01-01T00:00:00.000Z' });

    unsubscribe();
    expect(events.listenerCount()).toBe(0);
  });

  it('rejects emits for unknown names, invalid payloads and poll-source types', async () => {
    const events = registry();
    await expect(events.emit('nope', {})).rejects.toMatchObject({ id: 'MCP_SERVER_UNKNOWN_EVENT' });
    await expect(events.emit('ticket.created', { id: 1 })).rejects.toMatchObject({
      id: 'MCP_SERVER_EVENT_INVALID_PAYLOAD',
    });
    await expect(events.emit('build.finished', {})).rejects.toMatchObject({
      id: 'MCP_SERVER_EVENT_NOT_EMITTABLE',
      message: expect.stringMatching(/poll source.*cannot be pushed/),
    });
  });

  it('resolves subscriptions with the protocol errors of the extension', () => {
    const events = registry();
    const notFound = (() => {
      try {
        events.resolve('nope', 'poll');
      } catch (error) {
        return error;
      }
    })();
    expect(notFound).toBeInstanceOf(ProtocolError);
    expect(notFound).toMatchObject({ code: -32023, data: { kind: 'event', name: 'nope' } });
    expect(() => events.resolve('build.finished', 'push')).toThrow(
      expect.objectContaining({ code: -32026, data: { feature: 'deliveryMode', mode: 'push' } }),
    );
  });

  it('validates subscription arguments against inputSchema', async () => {
    const events = new ServerEventRegistry({
      e: defineEvent({ inputSchema: z.object({ limit: z.number().default(5) }) }),
    });
    const event = events.resolve('e', 'poll');
    await expect(events.validateArguments(event, {})).resolves.toEqual({ limit: 5 });
    await expect(events.validateArguments(event, { limit: 'x' })).rejects.toMatchObject({
      code: -32602,
      data: { issues: [expect.objectContaining({ path: ['limit'] })] },
    });
  });
});
