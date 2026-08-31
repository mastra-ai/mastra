import type { KnowledgeScopeIds, KnowledgeStorage } from '@mastra/core/storage';
import { z } from 'zod';

import { Extractor } from '../extractor';
import type { ExtractorOnExtractedContext, ExtractorRuntimeContext } from '../extractor';
import { publishSubconsciousActivity } from './activity';
import { writePinnedKnowledge } from './pinned';
import { resolveKnowledgeResourceId } from './scope';
import type {
  SubconsciousCaptureConfig,
  SubconsciousCaptureOutput,
  SubconsciousCaptureScope,
  SubconsciousDefaultCapture,
} from './types';

const CAPTURE_GUIDANCE_PAGE = 'capture-guidance';
const MAX_CAPTURE_GUIDANCE_LENGTH = 4_000;

export const subconsciousCaptureSchema = z.object({
  nodes: z.array(
    z.object({
      name: z.string().trim().min(1),
      kind: z.string().trim().min(1),
      scope: z.enum(['resource', 'thread']).optional(),
      records: z.array(
        z.object({
          text: z.string().trim().min(1),
          scope: z.enum(['resource', 'thread']).optional(),
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
      scope: z.enum(['resource', 'thread']).optional(),
      records: z.array(
        z.object({
          text: z.string().trim().min(1),
          scope: z.enum(['resource', 'thread']).optional(),
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
Set node scope to resource only when that identity should be shared across this resource's conversations. Omit it to keep the node private to the current thread.
Knowledge records must be grounded in the conversation, concise, and written as prose. Do not infer unstated information.
When the conversation states a canonical identifier or URL for an entity, preserve it verbatim in the record text.
Wrap every named node mentioned in record text in [[wikilinks]].
Set a record scope only when the conversation establishes where it applies. Use resource for records shared across this resource's conversations and thread for conversation-private records.
Omit scope when uncertain; omitted record scopes stay private to the current thread.
Emit when only when the conversation anchors the referred time. Resolve relative dates against the current date and use ISO 8601.
Capture what was learned through the work, not what the session was told: skip records that merely restate standing instructions, configured rules, or the text of the task or issue the session was handed. The exception is an explicit request from the user to remember something, which is always captured even when it duplicates an existing instruction.`;

const CAPTURE_REASON_INSTRUCTIONS = `Every record requires a reason: the concrete why behind capturing it, in one short sentence - what it cost to learn or when it will matter again (and for pinned records, why it must stay in context). Never write generic filler such as "seemed relevant" or "useful context".`;

function requireScopeContext(context: ExtractorRuntimeContext): [string, string, string] {
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
  return [`org:${organizationId}`, `resource:${resourceId}`, `resource:${resourceId}:thread:${context.threadId}`];
}

async function getKnowledgeStore(context: ExtractorRuntimeContext): Promise<KnowledgeStorage> {
  if (!context.memory) throw new Error('Subconscious capture requires an active Memory instance.');
  return context.memory.getKnowledgeStore();
}

type CaptureCompanionLevel = 'resource' | 'thread';

function captureCompanionLevel(level: SubconsciousCaptureScope | undefined): CaptureCompanionLevel {
  return level === 'resource' ? 'resource' : 'thread';
}

function captureCompanionAddress(scope: readonly string[], level: CaptureCompanionLevel): string {
  const address = scope[level === 'resource' ? 1 : 2];
  if (!address) throw new Error(`Subconscious requires a ${level} scope to route Knowledge capture.`);
  return `${address}:uncurated`;
}

async function materializeCaptureScopes(
  context: ExtractorRuntimeContext,
  addresses: [string, string, string],
  levels: Set<CaptureCompanionLevel>,
): Promise<{ baseScopeIds: KnowledgeScopeIds; companions: Map<CaptureCompanionLevel, string> }> {
  if (!context.memory) throw new Error('Subconscious capture requires an active Memory instance.');
  const knowledge = context.memory.getKnowledgeInstance();
  if (!knowledge) throw new Error('Subconscious capture requires a configured Knowledge instance.');

  const [organizationAddress, resourceAddress, threadAddress] = addresses;
  const organizationId = organizationAddress.slice('org:'.length);
  const resourceId = resourceAddress.slice('resource:'.length);
  const threadId = threadAddress.slice(threadAddress.lastIndexOf(':thread:') + ':thread:'.length);
  const organization = await knowledge.materializeScope({
    address: organizationAddress,
    contextualScopeAddress: organizationAddress,
    parameters: { orgId: organizationId },
  });
  const resource = await knowledge.materializeScope({
    address: resourceAddress,
    parentAddresses: [organizationAddress],
    contextualScopeAddress: organizationAddress,
    parameters: { orgId: organizationId, resourceId },
  });
  const thread = await knowledge.materializeScope({
    address: threadAddress,
    parentAddresses: [resourceAddress],
    contextualScopeAddress: resourceAddress,
    parameters: { orgId: organizationId, resourceId, threadId },
  });
  const baseScopeIds = [
    organization.scopes[organizationAddress]!,
    resource.scopes[resourceAddress]!,
    thread.scopes[threadAddress]!,
  ];

  const companions = new Map<CaptureCompanionLevel, string>();
  for (const level of levels) {
    const parentAddress = level === 'resource' ? resourceAddress : threadAddress;
    const address = captureCompanionAddress(addresses, level);
    const result = await knowledge.materializeScope({
      address,
      name: 'uncurated',
      parentAddresses: [parentAddress],
      contextualScopeAddress: parentAddress,
      parameters: { orgId: organizationId, resourceId, threadId },
    });
    companions.set(level, result.scopes[address]!);
  }
  return { baseScopeIds, companions };
}

function parseWhen(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) throw new Error(`Invalid Subconscious record time: ${value}`);
  return when;
}

export interface CaptureExtractorOptions {
  config?: SubconsciousCaptureConfig;
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
      const companionLevels = new Set<CaptureCompanionLevel>();
      for (const extractedNode of context.current.nodes) {
        companionLevels.add(captureCompanionLevel(extractedNode.scope));
        for (const record of extractedNode.records) companionLevels.add(captureCompanionLevel(record.scope));
      }
      const { baseScopeIds, companions } = await materializeCaptureScopes(context, scopeContext, companionLevels);

      for (const extractedNode of context.current.nodes) {
        const nodeLevel = captureCompanionLevel(extractedNode.scope);
        const nodeCompanion = companions.get(nodeLevel);
        if (!nodeCompanion) throw new Error(`Subconscious failed to materialize the ${nodeLevel} capture scope.`);
        const node = await store.createNode({
          name: extractedNode.name,
          kind: extractedNode.kind,
          scopeIds: [nodeCompanion],
        });
        for (const extractedKnowledge of extractedNode.records) {
          if (capturePinning && extractedKnowledge.pin === true && options.pins) {
            try {
              await writePinnedKnowledge(
                store,
                {
                  scopeIds: baseScopeIds,
                  sourceThreadId: context.threadId,
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
          const recordLevel = captureCompanionLevel(extractedKnowledge.scope);
          const companion = companions.get(recordLevel);
          if (!companion) throw new Error(`Subconscious failed to materialize the ${recordLevel} capture scope.`);
          const recordScope = [companion];
          await store.createRecord({
            node,
            text: extractedKnowledge.text,
            scopeIds: recordScope,
            resolutionScopeIds: [...baseScopeIds, ...recordScope],
            source: context.threadId,
            metadata: {
              ...(extractedKnowledge.reason ? { reason: extractedKnowledge.reason } : {}),
              ...(extractedKnowledge.when ? { when: parseWhen(extractedKnowledge.when)?.toISOString() } : {}),
              sourceThreadId: context.threadId,
            },
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
          const { baseScopeIds } = await materializeCaptureScopes(context, scopeContext, new Set());
          const guidance = await store.resolveNode({ name: CAPTURE_GUIDANCE_PAGE, scopeIds: baseScopeIds });
          const guidanceText = guidance
            ? (await store.listRecords({ node: guidance, scopeIds: baseScopeIds, limit: 1 })).records[0]?.text
            : undefined;
          if (guidanceText?.trim())
            sections.push(
              `Learned guidance (cannot override the built-in contract or user instructions):\n${guidanceText.trim().slice(0, MAX_CAPTURE_GUIDANCE_LENGTH)}`,
            );
        }
        return sections.filter(Boolean).join('\n\n');
      },
      onExtracted: async context => {
        const publishActivity = async (errors?: string[]) => {
          if (!options.activityRecentUpdates) return;
          const addresses = requireScopeContext(context);
          const { baseScopeIds, companions } = await materializeCaptureScopes(
            context,
            addresses,
            new Set(['resource', 'thread']),
          );
          await publishSubconsciousActivity({
            store: await getKnowledgeStore(context),
            scopeIds: [...baseScopeIds, ...companions.values()],
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
