import type { KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import { expandKnowledgeScope } from '@mastra/core/storage';
import { z } from 'zod';

import { Extractor } from '../extractor';
import type { ExtractorOnExtractedContext, ExtractorRuntimeContext } from '../extractor';
import { publishSubconsciousActivity } from './activity';
import { writePinnedKnowledge } from './pinned';
import { resolveKnowledgeResourceId } from './scope';
import type { SubconsciousCaptureConfig, SubconsciousCaptureOutput, SubconsciousDefaultCapture } from './types';

const CAPTURE_GUIDANCE_PAGE = 'capture-guidance';
const MAX_CAPTURE_GUIDANCE_LENGTH = 4_000;
const SCOPE_ORDER: Record<KnowledgeScopeLevel, number> = { org: 0, resource: 1, thread: 2 };

export const subconsciousCaptureSchema = z.object({
  nodes: z.array(
    z.object({
      name: z.string().trim().min(1),
      kind: z.string().trim().min(1),
      scope: z.enum(['org', 'resource', 'thread']).optional(),
      records: z.array(
        z.object({
          text: z.string().trim().min(1),
          scope: z.enum(['org', 'resource', 'thread']).optional(),
          when: z.string().trim().min(1).optional(),
          reason: z.string().trim().min(1),
        }),
      ),
    }),
  ),
});

// Advertised to the model ONLY when capture-time pinning is enabled; apart from
// the pin flag it must stay identical to the default schema above.
const subconsciousCapturePinningSchema = z.object({
  nodes: z.array(
    z.object({
      name: z.string().trim().min(1),
      kind: z.string().trim().min(1),
      scope: z.enum(['org', 'resource', 'thread']).optional(),
      records: z.array(
        z.object({
          text: z.string().trim().min(1),
          scope: z.enum(['org', 'resource', 'thread']).optional(),
          when: z.string().trim().min(1).optional(),
          reason: z.string().trim().min(1),
          pin: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

const CAPTURE_PINNING_INSTRUCTIONS = `Mark pin: true only for durable user preferences or hard constraints that should apply in every future session without being asked for.`;

const CAPTURE_INSTRUCTIONS = `Extract durable, explicitly stated knowledge from the observations.
Return nodes with short stable names, a freeform kind, and knowledge records nested under the node each record is about.
Use common kinds such as person, task, event, project, organization, or document when they fit.
Set node scope to the narrowest level where that identity and content should be shared. Omit it to use the configured default scope.
Knowledge records must be grounded in the conversation, concise, and written as prose. Do not infer unstated information.
Wrap every named node mentioned in record text in [[wikilinks]].
Set a record scope only when the conversation establishes where it applies. Use org for organization-wide records, resource for records shared across this resource's conversations, and thread for conversation-private records.
Omit scope when uncertain; omitted record scopes stay private to the current thread.
Emit when only when the conversation anchors the referred time. Resolve relative dates against the current date and use ISO 8601.
Capture what was learned through the work, not what the session was told: skip records that merely restate standing instructions, configured rules, or the text of the task or issue the session was handed. The exception is an explicit request from the user to remember something, which is always captured even when it duplicates an existing instruction.`;

const CAPTURE_REASON_INSTRUCTIONS = `Every record requires a reason: the concrete why behind capturing it, in one short sentence - what it cost to learn or when it will matter again (and for pinned records, why it must stay in context). Never write generic filler such as "seemed relevant" or "useful context".`;

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
  const resourceId = resolveKnowledgeResourceId(context.requestContext, context.resourceId);
  if (!resourceId) {
    throw new Error('Subconscious requires resourceId to derive scoped knowledge.');
  }
  if (!context.threadId) {
    throw new Error('Subconscious requires threadId to derive scoped knowledge.');
  }
  return [`org:${organizationId}`, `resource:${resourceId}`, `thread:${context.threadId}`];
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
  if (Number.isNaN(when.getTime())) throw new Error(`Invalid Subconscious record time: ${value}`);
  return when;
}

export interface CaptureExtractorOptions {
  config?: SubconsciousCaptureConfig;
  defaultScope: KnowledgeScopeLevel;
  maxScope?: KnowledgeScopeLevel;
  learnedGuidance: boolean;
  activityRecentUpdates?: number;
  /** Resolved pins config; capture-time pinning activates only when `capturePinning` is true. */
  pins?: false | { maxPins: number; maxCharacters: number; capturePinning: boolean };
}

export class SubconsciousCaptureExtractor extends Extractor<SubconsciousCaptureOutput> {
  constructor(options: CaptureExtractorOptions) {
    const capturePinning = options.pins !== false && options.pins !== undefined && options.pins.capturePinning;
    // Dropped-pin notes per extraction call, surfaced through the activity publish.
    // Keyed on the extraction OUTPUT (context.current): a custom onExtracted hook
    // receives a spread copy of the context, but `current` travels by reference.
    const pinNotes = new WeakMap<object, string[]>();

    const defaultImplementation: SubconsciousDefaultCapture = async context => {
      const scopeContext = requireScopeContext(context);
      const store = await getKnowledgeStore(context);
      const droppedPins: string[] = [];

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
        for (const extractedKnowledge of extractedNode.records) {
          if (capturePinning && extractedKnowledge.pin === true && options.pins) {
            try {
              await writePinnedKnowledge(
                store,
                {
                  scope: scopeContext,
                  sourceThreadId: context.threadId,
                  defaultScope: options.defaultScope,
                  maxScope: options.maxScope,
                  maxPins: options.pins.maxPins,
                  maxCharacters: options.pins.maxCharacters,
                },
                extractedKnowledge.text,
                extractedKnowledge.scope,
                extractedKnowledge.reason ? { reason: extractedKnowledge.reason } : undefined,
              );
            } catch (error) {
              droppedPins.push(`Capture-time pin dropped: ${error instanceof Error ? error.message : String(error)}`);
            }
            continue;
          }
          const knowledgeLevel = clampScope(extractedKnowledge.scope ?? 'thread', options.maxScope);
          await store.appendKnowledge({
            node,
            text: extractedKnowledge.text,
            scope: expandKnowledgeScope(scopeContext, knowledgeLevel),
            sourceThreadId: context.threadId,
            when: parseWhen(extractedKnowledge.when),
            maxScope: options.maxScope,
            metadata: extractedKnowledge.reason ? { reason: extractedKnowledge.reason } : undefined,
            resolutionScope: scopeContext,
            defaultScope: nodeScope,
          });
        }
      }
      if (droppedPins.length) pinNotes.set(context.current, droppedPins);
    };

    super({
      name: 'Capture',
      includePreviousExtraction: false,
      metadataKeyPath: false,
      schema: (options.config?.schema ??
        (capturePinning
          ? subconsciousCapturePinningSchema
          : subconsciousCaptureSchema)) as z.ZodType<SubconsciousCaptureOutput>,
      instructions: async context => {
        const sections = [
          CAPTURE_INSTRUCTIONS,
          // reason only exists on the default schemas; a custom schema gets no reason instruction.
          !options.config?.schema ? CAPTURE_REASON_INSTRUCTIONS : undefined,
          capturePinning && !options.config?.schema ? CAPTURE_PINNING_INSTRUCTIONS : undefined,
          options.config?.instructions?.trim(),
        ];
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
          const droppedPinNotes = pinNotes.get(context.current);
          pinNotes.delete(context.current);
          await publishActivity(droppedPinNotes);
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
