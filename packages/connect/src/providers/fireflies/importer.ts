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

const FIREFLIES_WATERMARK_KEY = 'fireflies:watermark';

const summarySchema = z
  .object({
    overview: z.string().nullish(),
    action_items: z.string().nullish(),
    keywords: z.array(z.string()).nullish(),
  })
  .nullish();

const transcriptSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  date: z.union([z.string(), z.number()]).nullish(),
  participants: z.array(z.string()).nullish(),
  summary: summarySchema,
});

const transcriptsResponseSchema = z.object({
  data: z.object({
    transcripts: z.array(transcriptSchema),
  }),
});

type FirefliesTranscript = z.infer<typeof transcriptSchema>;

const TRANSCRIPTS_QUERY = `
query Transcripts($fromDate: DateTime, $limit: Int, $skip: Int) {
  transcripts(fromDate: $fromDate, limit: $limit, skip: $skip) {
    id
    title
    date
    participants
    summary {
      overview
      action_items
      keywords
    }
  }
}`;

/** Fireflies `date` can be an epoch number or ISO string — normalise to ISO for watermark comparison. */
function normaliseDate(raw: string | number | null | undefined): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number') return new Date(raw).toISOString();
  // Already a date-ish string; trust it.
  return raw;
}

interface FacetRecord {
  facet: 'overview' | 'action_items' | 'keywords';
  text: string;
}

function extractFacets(transcript: FirefliesTranscript): FacetRecord[] {
  const facets: FacetRecord[] = [];
  const summary = transcript.summary ?? undefined;
  if (summary?.overview) facets.push({ facet: 'overview', text: summary.overview });
  if (summary?.action_items) facets.push({ facet: 'action_items', text: summary.action_items });
  if (summary?.keywords && summary.keywords.length > 0) {
    facets.push({ facet: 'keywords', text: summary.keywords.join(', ') });
  }
  return facets;
}

function createFirefliesImporter(ctx: ImporterProviderContext) {
  return {
    id: 'fireflies',
    access: ctx.access,
    triggers: {
      cron: {
        schedule: ctx.schedule,
        bindings: Object.keys(ctx.access).map(scope => ({ source: `fireflies:${ctx.connection.id}`, scope })),
      },
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, FIREFLIES_WATERMARK_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      const collected: FirefliesTranscript[] = [];
      let skip = 0;
      const limit = 25;

      await walkPages(
        { signal: context.signal, maxRecords: DEFAULT_MAX_RECORDS_PER_RUN, maxPages: DEFAULT_MAX_PAGES_PER_RUN },
        async () => {
          const variables: Record<string, unknown> = { limit, skip };
          if (previousWatermark) variables.fromDate = previousWatermark;
          const parsed = transcriptsResponseSchema.parse(
            await ctx.request({
              method: 'POST',
              path: 'graphql',
              body: { query: TRANSCRIPTS_QUERY, variables },
            }),
          );
          for (const transcript of parsed.data.transcripts) collected.push(transcript);
          if (parsed.data.transcripts.length < limit) return undefined;
          skip += parsed.data.transcripts.length;
          return { pageIndex: 0 };
        },
        async ({ recordsProcessed }) => recordsProcessed,
      );

      // Oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => {
        const ad = normaliseDate(a.date) ?? '';
        const bd = normaliseDate(b.date) ?? '';
        return ad.localeCompare(bd);
      });

      let latestSeen: string | undefined;
      for (const transcript of collected) {
        if (context.signal.aborted) return;
        const address = `fireflies:transcript:${transcript.id}`;
        const title = transcript.title || `Meeting ${transcript.id}`;
        const date = normaliseDate(transcript.date);
        const citation = `https://app.fireflies.ai/view/${transcript.id}`;
        const metadata = {
          citation,
          date,
          participants: transcript.participants ?? undefined,
        };
        const node = await importer.upsertNode(address, { name: title, kind: 'connect:fireflies:transcript' });
        const existingRecords = await node.listRecords();
        const existingIds = new Set(existingRecords.map(r => r.id));
        const facets = extractFacets(transcript);
        const kept = new Set<string>();
        for (const facet of facets) {
          const recordPayload = { address, facet: facet.facet, text: facet.text };
          const recordId = contentRecordId(recordPayload);
          kept.add(recordId);
          if (!existingIds.has(recordId)) {
            await node.appendRecord({
              id: recordId,
              text: boundText(`${title} — ${facet.facet}\n\n${facet.text}`),
              metadata: { ...metadata, facet: facet.facet },
            });
          }
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (!kept.has(previous.id)) await node.removeRecord(previous.id);
          }
        }
        if (date && (!latestSeen || date > latestSeen)) latestSeen = date;
      }

      if (latestSeen) await writeWatermark(context.state, FIREFLIES_WATERMARK_KEY, latestSeen);
    },
  };
}

export const firefliesImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'fireflies',
  envVar: 'MASTRA_FIREFLIES_CONNECTION_ID',
  defaultSchedule: '0 */2 * * *',
  createImporter: createFirefliesImporter,
};
