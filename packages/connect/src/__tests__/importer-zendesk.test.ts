import { describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { zendeskImporterRegistration } from '../providers/zendesk/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface ZendeskTicketFixture {
  id: number;
  subject?: string;
  description?: string;
  status?: string;
  updated_at?: string;
}

function ticketNode(fixture: ZendeskTicketFixture) {
  return {
    id: fixture.id,
    subject: fixture.subject ?? null,
    description: fixture.description ?? null,
    status: fixture.status ?? 'open',
    updated_at: fixture.updated_at,
    url: `https://acme.zendesk.com/api/v2/tickets/${fixture.id}.json`,
  };
}

function cursorResponse(
  tickets: ZendeskTicketFixture[],
  opts: { after_cursor?: string | null; end_of_stream?: boolean } = {},
) {
  return {
    tickets: tickets.map(ticketNode),
    after_cursor: opts.after_cursor ?? null,
    end_of_stream: opts.end_of_stream ?? false,
  };
}

function makeContext(overrides?: { role?: 'owner' | 'edit'; request?: ReturnType<typeof vi.fn> }): {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
} {
  const request = overrides?.request ?? vi.fn(async () => ({ tickets: [], after_cursor: null, end_of_stream: true }));
  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_zendesk', integrationId: 'zendesk', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '*/30 * * * *',
  };
  return { ctx, request, importer: createFakeImporter(role), state: createFakeState() };
}

describe('zendesk importer', () => {
  it('first run imports every ticket as a node with a content-hashed record', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      cursorResponse(
        [
          { id: 1, subject: 'Alpha', description: 'first', updated_at: '2026-09-01T00:00:00Z' },
          { id: 2, subject: 'Beta', description: 'second', updated_at: '2026-09-02T00:00:00Z' },
        ],
        { after_cursor: 'cur-1', end_of_stream: true },
      ),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('zendesk:ticket:1')?.input).toMatchObject({ name: 'Alpha' });
    expect(importer.nodes.get('zendesk:ticket:2')?.records.size).toBe(1);
    const call = request.mock.calls[0]![0]! as { method: string; path: string; query: Record<string, unknown> };
    expect(call.method).toBe('GET');
    expect(call.path).toBe('api/v2/incremental/tickets/cursor.json');
    expect(call.query.start_time).toBe(0);
  });

  it('stores the after_cursor verbatim as the watermark', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', description: 'x', updated_at: '2026-09-01T00:00:00Z' }], {
        after_cursor: 'opaque:cursor:abc==',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(await state.get('zendesk:cursor')).toBe(JSON.stringify({ watermark: 'opaque:cursor:abc==' }));
  });

  it('reuses stored cursor on subsequent runs — no start_time query', async () => {
    const { ctx, request, importer, state } = makeContext();
    await state.set('zendesk:cursor', JSON.stringify({ watermark: 'existing-cursor' }));
    request.mockResolvedValueOnce(cursorResponse([], { end_of_stream: true }));
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const call = request.mock.calls[0]![0]! as { query: Record<string, unknown> };
    expect(call.query.cursor).toBe('existing-cursor');
    expect(call.query.start_time).toBeUndefined();
  });

  it('end_of_stream halts pagination even when after_cursor is present', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', updated_at: '2026-09-01T00:00:00Z' }], {
        after_cursor: 'cur-1',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('second run with unchanged fixtures is idempotent', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValue(
      cursorResponse([{ id: 1, subject: 'A', description: 'x', updated_at: '2026-09-01T00:00:00Z' }], {
        after_cursor: 'cur-1',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    const first = importer.nodes.get('zendesk:ticket:1')!.records.size;
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(importer.nodes.get('zendesk:ticket:1')!.records.size).toBe(first);
  });

  it('cursor advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockRejectedValueOnce(new Error('platform down'));
    await expect(runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /platform down/,
    );
    expect(await state.get('zendesk:cursor')).toBeUndefined();
  });

  it('deleted tickets remove records under an owner binding but are skipped under edit', async () => {
    const owner = makeContext({ role: 'owner' });
    owner.request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', description: 'v1', updated_at: '2026-09-01T00:00:00Z' }], {
        after_cursor: 'cur-1',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(owner.ctx), owner);
    owner.request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', status: 'deleted', updated_at: '2026-09-02T00:00:00Z' }], {
        after_cursor: 'cur-2',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(owner.ctx), owner);
    expect(owner.importer.nodes.get('zendesk:ticket:1')!.records.size).toBe(0);

    const edit = makeContext({ role: 'edit' });
    edit.request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', description: 'v1', updated_at: '2026-09-01T00:00:00Z' }], {
        after_cursor: 'cur-1',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(edit.ctx), edit);
    edit.request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', status: 'deleted', updated_at: '2026-09-02T00:00:00Z' }], {
        after_cursor: 'cur-2',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(edit.ctx), edit);
    expect(edit.importer.nodes.get('zendesk:ticket:1')!.records.size).toBe(1);
  });

  it('walks multiple pages until end_of_stream', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce(
      cursorResponse([{ id: 1, subject: 'A', updated_at: '2026-09-01T00:00:00Z' }], {
        after_cursor: 'cur-1',
        end_of_stream: false,
      }),
    );
    request.mockResolvedValueOnce(
      cursorResponse([{ id: 2, subject: 'B', updated_at: '2026-09-02T00:00:00Z' }], {
        after_cursor: 'cur-2',
        end_of_stream: true,
      }),
    );
    await runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state });
    expect(request).toHaveBeenCalledTimes(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, request, importer, state } = makeContext();
    request.mockResolvedValueOnce({ tickets: [{ id: 'not-a-number' }] });
    await expect(runImporter(zendeskImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow();
    expect(await state.get('zendesk:cursor')).toBeUndefined();
  });
});
