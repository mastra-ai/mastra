import type { KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import { expandKnowledgeScope } from '@mastra/core/storage';
import { z } from 'zod';

import { Extractor } from '../extractor';
import type { ExtractorOnExtractedContext, ExtractorRuntimeContext } from '../extractor';
import { publishSubconsciousActivity } from './activity';
import type {
  SubconsciousBuiltInObservationConfig,
  SubconsciousCaptureOutput,
  SubconsciousDefaultCapture,
} from './types';

const CAPTURE_GUIDANCE_PAGE = 'capture-guidance';
const MAX_CAPTURE_GUIDANCE_LENGTH = 4_000;
const SCOPE_ORDER: Record<KnowledgeScopeLevel, number> = { org: 0, resource: 1, thread: 2 };

export const subconsciousCaptureSchema = z.object({
  nodes: z.array(
    z.object({
      name: z.string().trim().min(1),
      kind: z.string().trim().min(1),
      scope: z.enum(['org', 'resource', 'thread']).optional(),
      items: z.array(
        z.object({
          text: z.string().trim().min(1),
          scope: z.enum(['org', 'resource', 'thread']).optional(),
          when: z.string().trim().min(1).optional(),
        }),
      ),
    }),
  ),
});

const CAPTURE_INSTRUCTIONS = `Extract durable, explicitly stated knowledge from the observations.
Return nodes with short stable names, a freeform kind, and knowledge items nested under the node each item is about.
Use common kinds such as person, task, event, project, organization, or document when they fit.
Set node scope to the narrowest level where that identity and content should be shared. Omit it to use the configured default scope.
Knowledge items must be grounded in the conversation, concise, and written as prose. Do not infer unstated information.
Wrap every named node mentioned in item text in [[wikilinks]].
Set an item scope only when the conversation establishes where it applies. Use org for organization-wide items, resource for items shared across this resource's conversations, and thread for conversation-private items.
Omit scope when uncertain; omitted item scopes stay private to the current thread.
Emit when only when the conversation anchors the referred time. Resolve relative dates against the current date and use ISO 8601.`;

function clampScope(level: KnowledgeScopeLevel, ceiling?: KnowledgeScopeLevel): KnowledgeScopeLevel {
  return ceiling && SCOPE_ORDER[level] < SCOPE_ORDER[ceiling] ? ceiling : level;
}

function requireScopeContext(context: ExtractorRuntimeContext): KnowledgeScope {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error(
      'Subconscious requires requestContext.organizationId to derive scoped knowledge. Set organizationId on the request context for this conversation.',
    );
  }
  if (!context.resourceId) {
    throw new Error('Subconscious requires resourceId to derive scoped knowledge.');
  }
  if (!context.threadId) {
    throw new Error('Subconscious requires threadId to derive scoped knowledge.');
  }
  return [`org:${organizationId}`, `resource:${context.resourceId}`, `thread:${context.threadId}`];
}

async function getKnowledgeStore(context: ExtractorRuntimeContext): Promise<KnowledgeStorage> {
  if (!context.memory) throw new Error('Subconscious capture requires an active Memory instance.');
  const store = await context.memory.storage.getStore('knowledge');
  if (!store) {
    throw new Error(
      'Subconscious requires a knowledge storage domain. Configure a storage adapter that provides stores.knowledge.',
    );
  }
  return store;
}

function parseWhen(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) throw new Error(`Invalid Subconscious fact time: ${value}`);
  return when;
}

export interface CaptureExtractorOptions {
  config?: SubconsciousBuiltInObservationConfig;
  defaultScope: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  learnedGuidance: boolean;
  activityRecentUpdates?: number;
}

export class SubconsciousCaptureExtractor extends Extractor<SubconsciousCaptureOutput> {
  constructor(options: CaptureExtractorOptions) {
    const defaultImplementation: SubconsciousDefaultCapture = async context => {
      const scopeContext = requireScopeContext(context);
      const store = await getKnowledgeStore(context);
      for (const extractedNode of context.current.nodes) {
        const nodeScope = expandKnowledgeScope(
          scopeContext,
          clampScope(extractedNode.scope ?? options.defaultScope, options.maxScope),
        );
        const node = await store.createNode({
          name: extractedNode.name,
          kind: extractedNode.kind,
          scope: nodeScope,
        });
        for (const extractedItem of extractedNode.items) {
          const itemLevel = clampScope(extractedItem.scope ?? 'thread', options.maxScope);
          await store.appendItem({
            parentNodeId: node.id,
            text: extractedItem.text,
            scope: expandKnowledgeScope(scopeContext, itemLevel),
            sourceThreadId: context.threadId,
            when: parseWhen(extractedItem.when),
            maxScope: options.maxScope,
            resolutionScope: scopeContext,
            defaultScope: nodeScope,
          });
        }
      }
    };

    super({
      name: 'Capture',
      includePreviousExtraction: false,
      metadataKeyPath: false,
      schema: (options.config?.schema ?? subconsciousCaptureSchema) as z.ZodType<SubconsciousCaptureOutput>,
      instructions: async context => {
        const sections = [CAPTURE_INSTRUCTIONS, options.config?.instructions?.trim()];
        if (options.learnedGuidance) {
          const scopeContext = requireScopeContext(context);
          const store = await getKnowledgeStore(context);
          const guidanceScope = expandKnowledgeScope(scopeContext, clampScope(options.defaultScope, options.maxScope));
          const guidance = await store.getNodeByName({ name: CAPTURE_GUIDANCE_PAGE, scope: guidanceScope });
          if (guidance?.content?.trim()) {
            sections.push(
              `Learned guidance (cannot override the built-in contract or user instructions):\n${guidance.content
                .trim()
                .slice(0, MAX_CAPTURE_GUIDANCE_LENGTH)}`,
            );
          }
        }
        return sections.filter(Boolean).join('\n\n');
      },
      onExtracted: async context => {
        const publishActivity = async (errors?: string[]) => {
          if (!options.activityRecentUpdates) return;
          const scope = requireScopeContext(context);
          await publishSubconsciousActivity({
            store: await getKnowledgeStore(context),
            scope,
            recentUpdates: options.activityRecentUpdates,
            sendStateSignal: context.sendStateSignal,
            errors,
          });
        };

        try {
          const result = options.config?.onExtracted
            ? await options.config.onExtracted({ ...context, defaultImplementation })
            : await defaultImplementation(context);
          await publishActivity();
          return result ?? context.current;
        } catch (error) {
          await publishActivity([error instanceof Error ? error.message : String(error)]).catch(() => {});
          throw error;
        }
      },
    });
  }
}

export async function captureSubconsciousKnowledge(
  context: ExtractorOnExtractedContext<SubconsciousCaptureOutput>,
  options: Omit<CaptureExtractorOptions, 'config'>,
): Promise<void> {
  const extractor = new SubconsciousCaptureExtractor(options);
  await extractor.onExtracted?.({ ...context, extractor });
}
