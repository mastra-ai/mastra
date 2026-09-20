import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import {
  boundText,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  readWatermark,
  walkPages,
  writeWatermark,
} from '../../importer-runtime.js';

const ZENDESK_CURSOR_KEY = 'zendesk:cursor';

const ticketSchema = z.object({
  id: z.number(),
  subject: z.string().nullish(),
  description: z.string().nullish(),
  status: z.string().optional(),
  updated_at: z.string().optional(),
  url: z.string().optional(),
});

const cursorResponseSchema = z.object({
  tickets: z.array(ticketSchema),
  after_cursor: z.string().nullish(),
  after_url: z.string().nullish(),
  end_of_stream: z.boolean().optional(),
});

type ZendeskTicket = z.infer<typeof ticketSchema>;

function isPurged(ticket: ZendeskTicket): boolean {
  const status = (ticket.status ?? '').toLowerCase();
  return status === 'deleted' || status === 'purged';
}

function createZendeskImporter(ctx: ImporterProviderContext) {
  return {
    id: 'zendesk',
    access: ctx.access,
    triggers: {
      cron: {
        schedule: ctx.schedule,
        bindings: Object.keys(ctx.access).map(scope => ({ source: `zendesk:${ctx.connection.id}`, scope })),
      },
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousCursor = await readWatermark(context.state, ZENDESK_CURSOR_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      const collected: ZendeskTicket[] = [];
      let cursor: string | undefined = previousCursor;
      let lastCursorSeen: string | undefined = previousCursor;
      let endOfStream = false;

      await walkPages(
        { signal: context.signal, maxRecords: DEFAULT_MAX_RECORDS_PER_RUN, maxPages: DEFAULT_MAX_PAGES_PER_RUN },
        async () => {
          const query: Record<string, string | number | boolean | undefined> = {};
          if (cursor) {
            query.cursor = cursor;
          } else {
            // Initial run — start from epoch to fetch all tickets. Callers can override
            // start_time by pre-seeding the cursor if they need a narrower window.
            query.start_time = 0;
          }
          const parsed = cursorResponseSchema.parse(
            await ctx.request({
              method: 'GET',
              path: 'api/v2/incremental/tickets/cursor.json',
              query,
            }),
          );
          for (const ticket of parsed.tickets) collected.push(ticket);
          if (parsed.after_cursor) lastCursorSeen = parsed.after_cursor;
          if (parsed.end_of_stream) {
            endOfStream = true;
            return undefined;
          }
          if (!parsed.after_cursor) return undefined;
          cursor = parsed.after_cursor;
          return { pageIndex: 0 };
        },
        async ({ recordsProcessed }) => recordsProcessed,
      );

      for (const ticket of collected) {
        if (context.signal.aborted) return;
        const address = `zendesk:ticket:${ticket.id}`;
        if (isPurged(ticket)) {
          if (!canRemove) continue;
          const existing = await importer.getNode(address);
          if (!existing) continue;
          const records = await existing.listRecords();
          for (const record of records) await existing.removeRecord(record.id);
          continue;
        }
        const subject = ticket.subject ?? `Ticket #${ticket.id}`;
        const description = ticket.description ?? '';
        const recordPayload = {
          address,
          subject,
          description,
          updatedAt: ticket.updated_at,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, { name: subject, kind: 'connect:zendesk:ticket' });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(description ? `${subject}\n\n${description}` : subject),
            metadata: {
              status: ticket.status,
              updatedAt: ticket.updated_at,
              url: ticket.url,
            },
          });
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
      }

      // Zendesk's after_cursor is opaque — store it verbatim. Commit only after
      // the window's mutations have all been applied.
      if (lastCursorSeen && lastCursorSeen !== previousCursor) {
        await writeWatermark(context.state, ZENDESK_CURSOR_KEY, lastCursorSeen);
      }
      // end_of_stream lets subsequent runs re-use the same cursor (server returns []).
      void endOfStream;
    },
  };
}

export const zendeskImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'zendesk',
  envVar: 'MASTRA_ZENDESK_CONNECTION_ID',
  defaultSchedule: '*/30 * * * *',
  createImporter: createZendeskImporter,
};
