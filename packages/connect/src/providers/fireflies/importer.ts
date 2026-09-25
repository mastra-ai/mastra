import { z } from 'zod';

import type { ImporterProviderContext, ImporterProviderRegistration } from '../../importer-registry.js';
import type { RecordLink } from '../../importer-runtime.js';
import {
  boundText,
  clearHighWater,
  clearResumeCursor,
  contentRecordId,
  DEFAULT_MAX_PAGES_PER_RUN,
  DEFAULT_MAX_RECORDS_PER_RUN,
  importerCronTrigger,
  linksMetadata,
  neutralizeWikilinks,
  nodeSelfMetadata,
  readHighWater,
  readResumeCursor,
  readWatermark,
  writeHighWater,
  writeResumeCursor,
  writeWatermark,
} from '../../importer-runtime.js';

const FIREFLIES_WATERMARK_KEY = 'fireflies:watermark';
const FIREFLIES_RESUME_CURSOR_KEY = 'fireflies:resume-cursor';
const FIREFLIES_HIGH_WATER_KEY = 'fireflies:high-water';

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
  organizer_email: z.string().nullish(),
  meeting_attendees: z
    .array(z.object({ displayName: z.string().nullish(), email: z.string().nullish() }))
    .nullish(),
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
    organizer_email
    meeting_attendees {
      displayName
      email
    }
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

interface Attendee {
  email: string;
  displayName?: string;
}

/**
 * A meeting's people are its structure. Prefer `meeting_attendees` (has display
 * names); degrade to the plain `participants` email array when absent.
 */
function extractAttendees(transcript: FirefliesTranscript): Attendee[] {
  const byEmail = new Map<string, Attendee>();
  const richAttendees = transcript.meeting_attendees ?? [];
  for (const attendee of richAttendees) {
    const email = attendee.email?.trim().toLowerCase();
    if (!email) continue;
    const displayName = attendee.displayName?.trim() || undefined;
    const existing = byEmail.get(email);
    if (!existing || (!existing.displayName && displayName)) byEmail.set(email, { email, displayName });
  }
  if (byEmail.size === 0) {
    for (const raw of transcript.participants ?? []) {
      const email = raw.trim().toLowerCase();
      if (email) byEmail.set(email, { email });
    }
  }
  return [...byEmail.values()];
}

/**
 * Recurring meetings share a title — the normalized title keys the series
 * container. Heuristic: unrelated meetings with the same title collapse into
 * one series; a renamed recurring meeting starts a new one.
 */
function seriesSlug(title: string | null | undefined): string | undefined {
  if (!title) return undefined;
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || undefined;
}

function createFirefliesImporter(ctx: ImporterProviderContext) {
  return {
    id: 'fireflies',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`fireflies:${ctx.connection.id}`, ctx),
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, FIREFLIES_WATERMARK_KEY);
      const resumeCursor = await readResumeCursor(context.state, FIREFLIES_RESUME_CURSOR_KEY);
      const persistedHighWater = await readHighWater(context.state, FIREFLIES_HIGH_WATER_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      // Fireflies GraphQL doesn't guarantee ordering across pages, so we can't safely advance
      // the watermark unless the source told us it was done (partial page = end). If we hit
      // maxPages/maxRecords instead, we persist the skip offset so the next run resumes
      // further into the tail — otherwise a backfill larger than one bounded run would
      // never converge. Skip-based pagination is inherently best-effort under concurrent
      // writes; content-hashed record ids provide the safety net.
      const collected: FirefliesTranscript[] = [];
      const parsedResume = resumeCursor ? Number.parseInt(resumeCursor, 10) : NaN;
      let skip = Number.isFinite(parsedResume) && parsedResume >= 0 ? parsedResume : 0;
      const limit = 25;
      let drainedFully = false;
      // Track the newest date observed across the raw API responses so the drain-after-cursor
      // path doesn't regress the watermark to the older tail. Seeded from persisted high-water
      // so multi-run backfills carry the true high forward to the final drain run.
      let newestObserved: string | undefined = persistedHighWater;
      for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const variables: Record<string, unknown> = { limit, skip };
        if (previousWatermark) variables.fromDate = previousWatermark;
        const parsed = transcriptsResponseSchema.parse(
          await ctx.request({
            method: 'POST',
            path: 'graphql',
            body: { query: TRANSCRIPTS_QUERY, variables },
          }),
        );
        for (const transcript of parsed.data.transcripts) {
          const observed = normaliseDate(transcript.date);
          if (observed && (!newestObserved || observed > newestObserved)) newestObserved = observed;
          collected.push(transcript);
        }
        if (parsed.data.transcripts.length < limit) {
          drainedFully = true;
          break;
        }
        skip += parsed.data.transcripts.length;
        if (collected.length >= DEFAULT_MAX_RECORDS_PER_RUN) break;
      }

      // Oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => {
        const ad = normaliseDate(a.date) ?? '';
        const bd = normaliseDate(b.date) ?? '';
        return ad.localeCompare(bd);
      });

      let lastProcessed: string | undefined;
      const upsertedContainers = new Set<string>();
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

        // Structure links: attendees + organizer + recurring-meeting series.
        const links: RecordLink[] = [];
        const attendees = extractAttendees(transcript);
        const organizerEmail = transcript.organizer_email?.trim().toLowerCase() || undefined;
        for (const attendee of attendees) {
          const personAddress = `fireflies:person:${attendee.email}`;
          if (!upsertedContainers.has(personAddress)) {
            upsertedContainers.add(personAddress);
            const personName = attendee.displayName ?? attendee.email;
            const personNode = await importer.upsertNode(personAddress, {
              name: personName,
              kind: 'connect:fireflies:person',
              metadata: nodeSelfMetadata(personAddress),
            });
            const personRecordId = contentRecordId({ address: personAddress, name: personName });
            const personRecords = await personNode.listRecords();
            if (!personRecords.some(r => r.id === personRecordId)) {
              await personNode.appendRecord({
                id: personRecordId,
                text: neutralizeWikilinks(personName),
                metadata: { email: attendee.email },
              });
            }
            if (canRemove) {
              for (const previous of personRecords) {
                if (previous.id !== personRecordId) await personNode.removeRecord(previous.id);
              }
            }
          }
          links.push({ address: personAddress, rel: 'attended-by' });
          if (organizerEmail === attendee.email) links.push({ address: personAddress, rel: 'organized-by' });
        }
        const slug = seriesSlug(transcript.title);
        if (slug) {
          const seriesAddress = `fireflies:series:${slug}`;
          if (!upsertedContainers.has(seriesAddress)) {
            upsertedContainers.add(seriesAddress);
            const seriesName = transcript.title!.trim();
            const seriesNode = await importer.upsertNode(seriesAddress, {
              name: seriesName,
              kind: 'connect:fireflies:series',
              metadata: nodeSelfMetadata(seriesAddress),
            });
            const seriesRecordId = contentRecordId({ address: seriesAddress, name: seriesName });
            const seriesRecords = await seriesNode.listRecords();
            if (!seriesRecords.some(r => r.id === seriesRecordId)) {
              await seriesNode.appendRecord({
                id: seriesRecordId,
                text: neutralizeWikilinks(seriesName),
                metadata: { slug },
              });
            }
            if (canRemove) {
              for (const previous of seriesRecords) {
                if (previous.id !== seriesRecordId) await seriesNode.removeRecord(previous.id);
              }
            }
          }
          links.push({ address: seriesAddress, rel: 'in' });
        }
        const linkMeta = linksMetadata(links);

        const node = await importer.upsertNode(address, {
          name: title,
          kind: 'connect:fireflies:transcript',
          metadata: nodeSelfMetadata(address),
        });
        const existingRecords = await node.listRecords();
        const existingIds = new Set(existingRecords.map(r => r.id));
        const facets = extractFacets(transcript);
        const kept = new Set<string>();
        for (const facet of facets) {
          const recordPayload = { address, facet: facet.facet, text: facet.text, links: linkMeta.links ?? [] };
          const recordId = contentRecordId(recordPayload);
          kept.add(recordId);
          if (!existingIds.has(recordId)) {
            await node.appendRecord({
              id: recordId,
              text: boundText(neutralizeWikilinks(`${title} — ${facet.facet}\n\n${facet.text}`)),
              metadata: { ...metadata, facet: facet.facet, ...linkMeta },
            });
          }
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (!kept.has(previous.id)) await node.removeRecord(previous.id);
          }
        }
        if (date && (!lastProcessed || date > lastProcessed)) lastProcessed = date;
      }

      if (drainedFully && (lastProcessed || newestObserved)) {
        const candidate =
          newestObserved && (!previousWatermark || newestObserved > previousWatermark)
            ? newestObserved
            : previousWatermark;
        await clearResumeCursor(context.state, FIREFLIES_RESUME_CURSOR_KEY);
        await clearHighWater(context.state, FIREFLIES_HIGH_WATER_KEY);
        if (candidate) await writeWatermark(context.state, FIREFLIES_WATERMARK_KEY, candidate);
      } else if (!drainedFully) {
        await writeResumeCursor(context.state, FIREFLIES_RESUME_CURSOR_KEY, String(skip));
        if (newestObserved) await writeHighWater(context.state, FIREFLIES_HIGH_WATER_KEY, newestObserved);
      }
    },
  };
}

export const firefliesImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'fireflies',
  envVar: 'MASTRA_FIREFLIES_CONNECTION_ID',
  defaultSchedule: '0 */2 * * *',
  createImporter: createFirefliesImporter,
};
