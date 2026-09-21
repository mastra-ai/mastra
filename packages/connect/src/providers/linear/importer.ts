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

// Keys are namespaced under `documents` — earlier revisions of this importer
// synced issues under `linear:watermark`, and reusing that key would make the
// documents backfill skip anything older than the issues watermark.
const LINEAR_WATERMARK_KEY = 'linear:documents:watermark';
const LINEAR_RESUME_CURSOR_KEY = 'linear:documents:resume-cursor';
const LINEAR_HIGH_WATER_KEY = 'linear:documents:high-water';

// Linear is an issue tracker, but issues are operational work — not knowledge.
// This importer syncs Linear Documents (project docs, PRDs, initiative docs),
// which are the durable, document-shaped content in a Linear workspace.
const documentSchema = z.object({
  id: z.string(),
  title: z.string().default(''),
  content: z.string().nullish(),
  url: z.string().nullish(),
  slugId: z.string().nullish(),
  updatedAt: z.string(),
  archivedAt: z.string().nullish(),
  trashed: z.boolean().nullish(),
  project: z.object({ id: z.string().nullish(), name: z.string().nullish() }).nullish(),
  initiative: z.object({ name: z.string().nullish() }).nullish(),
});

const documentsResponseSchema = z.object({
  data: z.object({
    documents: z.object({
      nodes: z.array(documentSchema),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        endCursor: z.string().nullish(),
      }),
    }),
  }),
});

type LinearDocument = z.infer<typeof documentSchema>;

/** Linear doc URLs: `https://linear.app/<ws>/document/<slug>-<slugId>`. */
const DOC_URL_PATTERN = /linear\.app\/[^)\s"]+\/document\/([^)\s"?#]+)/g;

/**
 * Extract doc→doc reference links from a markdown body. Doc URLs end in the
 * short `slugId`, not the uuid, so targets resolve through the slug-alias
 * addresses each doc node registers in `metadata.addressAliases`.
 */
function extractDocLinks(markdown: string): RecordLink[] {
  const links: RecordLink[] = [];
  for (const match of markdown.matchAll(DOC_URL_PATTERN)) {
    const segment = match[1]!;
    const slugId = segment.slice(segment.lastIndexOf('-') + 1);
    if (slugId) links.push({ address: `linear:document:slug:${slugId}`, rel: 'references' });
  }
  return links;
}

const DOCUMENTS_QUERY = `
query Documents($filter: DocumentFilter, $after: String) {
  documents(filter: $filter, orderBy: updatedAt, first: 50, after: $after) {
    nodes {
      id
      title
      content
      url
      slugId
      updatedAt
      archivedAt
      trashed
      project { id name }
      initiative { name }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

function createLinearImporter(ctx: ImporterProviderContext) {
  return {
    id: 'linear',
    access: ctx.access,
    triggers: {
      cron: importerCronTrigger(`linear:${ctx.connection.id}`, ctx),
    },
    handler: async (context: {
      signal: AbortSignal;
      state: import('@mastra/core/knowledge').KnowledgeImporterState;
      importer: () => Promise<import('@mastra/core/knowledge').StaticKnowledgeImporterOperations>;
    }) => {
      const previousWatermark = await readWatermark(context.state, LINEAR_WATERMARK_KEY);
      const resumeCursor = await readResumeCursor(context.state, LINEAR_RESUME_CURSOR_KEY);
      const persistedHighWater = await readHighWater(context.state, LINEAR_HIGH_WATER_KEY);
      const importer = await context.importer();
      const canRemove = Object.values(ctx.access).some(role => role === 'owner');

      // Linear's default orderBy: updatedAt walks newest→oldest. On truncation
      // (maxPages/maxRecords) we persist endCursor so the next run resumes further into
      // the tail. Only when the source exhausts pagination do we advance the watermark
      // and clear the resume cursor.
      const collected: LinearDocument[] = [];
      let cursor: string | undefined = resumeCursor;
      let nextCursorAfterLastPage: string | undefined;
      let drainedFully = false;
      // Track the newest timestamp across the raw API responses, before ASC sort — needed to
      // prevent the watermark regressing on a drain run that resumed from a cursor. Seeded
      // from the persisted high-water so the drain writes the true high across the backfill.
      let newestObserved: string | undefined = persistedHighWater;
      for (let pageIndex = 0; pageIndex < DEFAULT_MAX_PAGES_PER_RUN; pageIndex++) {
        if (context.signal.aborted) break;
        const variables: Record<string, unknown> = { after: cursor };
        if (previousWatermark) variables.filter = { updatedAt: { gte: previousWatermark } };
        const parsed = documentsResponseSchema.parse(
          await ctx.request({
            method: 'POST',
            path: 'graphql',
            body: { query: DOCUMENTS_QUERY, variables },
          }),
        );
        for (const document of parsed.data.documents.nodes) {
          if (!newestObserved || document.updatedAt > newestObserved) newestObserved = document.updatedAt;
          collected.push(document);
        }
        if (!parsed.data.documents.pageInfo.hasNextPage || !parsed.data.documents.pageInfo.endCursor) {
          drainedFully = true;
          break;
        }
        cursor = parsed.data.documents.pageInfo.endCursor;
        nextCursorAfterLastPage = parsed.data.documents.pageInfo.endCursor;
        if (collected.length >= DEFAULT_MAX_RECORDS_PER_RUN) break;
      }

      // Oldest-first so a mid-run failure leaves the watermark low.
      collected.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

      let lastProcessed: string | undefined;
      const upsertedProjects = new Set<string>();
      for (const document of collected) {
        if (context.signal.aborted) return;
        const address = `linear:document:${document.id}`;
        const archived = Boolean(document.archivedAt || document.trashed);
        if (archived) {
          if (canRemove) {
            const existing = await importer.getNode(address);
            if (existing) {
              const records = await existing.listRecords();
              for (const record of records) await existing.removeRecord(record.id);
            }
          }
          lastProcessed = document.updatedAt;
          continue;
        }
        const title = document.title || document.id;
        const content = document.content ?? '';
        // Cross-doc reference links from the markdown body, resolved via the
        // slug-alias each doc registers on its own node.
        const links: RecordLink[] = extractDocLinks(content);
        // Structure: doc → project container.
        const projectId = document.project?.id ?? undefined;
        if (projectId) {
          const projectAddress = `linear:project:${projectId}`;
          if (!upsertedProjects.has(projectAddress)) {
            upsertedProjects.add(projectAddress);
            const projectName = document.project?.name || projectId;
            const projectNode = await importer.upsertNode(projectAddress, {
              name: projectName,
              kind: 'connect:linear:project',
              metadata: nodeSelfMetadata(projectAddress),
            });
            const projectRecordId = contentRecordId({ address: projectAddress, name: projectName });
            const projectRecords = await projectNode.listRecords();
            if (!projectRecords.some(r => r.id === projectRecordId)) {
              await projectNode.appendRecord({
                id: projectRecordId,
                text: neutralizeWikilinks(projectName),
                metadata: { projectId },
              });
            }
            if (canRemove) {
              for (const previous of projectRecords) {
                if (previous.id !== projectRecordId) await projectNode.removeRecord(previous.id);
              }
            }
          }
          links.push({ address: projectAddress, rel: 'in' });
        }
        const slugId = document.slugId ?? undefined;
        const selfAlias = slugId ? `linear:document:slug:${slugId}` : undefined;
        const linkMeta = linksMetadata(links.filter(link => link.address !== address && link.address !== selfAlias));
        const recordPayload = {
          address,
          title,
          content,
          links: linkMeta.links ?? [],
          updatedAt: document.updatedAt,
        };
        const recordId = contentRecordId(recordPayload);
        const node = await importer.upsertNode(address, {
          name: title,
          kind: 'connect:linear:document',
          metadata: nodeSelfMetadata(address, selfAlias ? [selfAlias] : undefined),
        });
        const existingRecords = await node.listRecords();
        if (!existingRecords.some(r => r.id === recordId)) {
          await node.appendRecord({
            id: recordId,
            text: boundText(neutralizeWikilinks(content ? `${title}\n\n${content}` : title)),
            metadata: {
              project: document.project?.name,
              initiative: document.initiative?.name,
              url: document.url,
              ...linkMeta,
            },
          });
        }
        if (canRemove) {
          for (const previous of existingRecords) {
            if (previous.id !== recordId) await node.removeRecord(previous.id);
          }
        }
        lastProcessed = document.updatedAt;
      }

      if (drainedFully && (lastProcessed || newestObserved)) {
        const candidate =
          newestObserved && (!previousWatermark || newestObserved > previousWatermark)
            ? newestObserved
            : previousWatermark;
        await clearResumeCursor(context.state, LINEAR_RESUME_CURSOR_KEY);
        await clearHighWater(context.state, LINEAR_HIGH_WATER_KEY);
        if (candidate) await writeWatermark(context.state, LINEAR_WATERMARK_KEY, candidate);
      } else if (!drainedFully && nextCursorAfterLastPage) {
        await writeResumeCursor(context.state, LINEAR_RESUME_CURSOR_KEY, nextCursorAfterLastPage);
        if (newestObserved) await writeHighWater(context.state, LINEAR_HIGH_WATER_KEY, newestObserved);
      }
    },
  };
}

export const linearImporterRegistration: ImporterProviderRegistration = {
  integrationId: 'linear',
  envVar: 'MASTRA_LINEAR_CONNECTION_ID',
  defaultSchedule: '*/30 * * * *',
  createImporter: createLinearImporter,
};
