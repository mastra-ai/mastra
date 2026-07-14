import type { KnowledgeScope, KnowledgeScopeLevel, KnowledgeStorage } from '@mastra/core/storage';
import { expandKnowledgeScope } from '@mastra/core/storage';
import { z } from 'zod';

import { Extractor } from '../extractor';
import type { ExtractorOnExtractedContext, ExtractorRuntimeContext } from '../extractor';
import type {
  SubconsciousBuiltInObservationConfig,
  SubconsciousCaptureOutput,
  SubconsciousDefaultCapture,
} from './types';

const CAPTURE_GUIDANCE_PAGE = 'capture-guidance';
const MAX_CAPTURE_GUIDANCE_LENGTH = 4_000;
const SCOPE_ORDER: Record<KnowledgeScopeLevel, number> = { org: 0, resource: 1, thread: 2 };

export const subconsciousCaptureSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string().trim().min(1),
      kind: z
        .string()
        .trim()
        .min(1)
        .refine(kind => kind !== 'page', 'Entity kind "page" is reserved'),
      facts: z.array(
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
Return entities with short stable names, a freeform kind, and facts nested under the entity each fact is about.
Use common kinds such as person, task, event, project, or organization when they fit. Never use the reserved kind page.
Facts must be grounded in the conversation, concise, and written as prose. Do not infer unstated information.
Wrap every named entity mentioned in fact text in [[wikilinks]].
Set a fact scope only when the conversation establishes where it applies. Use org for organization-wide facts, resource for facts shared across this resource's conversations, and thread for conversation-private facts.
Omit scope when uncertain; omitted fact scopes stay private to the current thread.
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
}

export class SubconsciousCaptureExtractor extends Extractor<SubconsciousCaptureOutput> {
  constructor(options: CaptureExtractorOptions) {
    const defaultImplementation: SubconsciousDefaultCapture = async context => {
      const scopeContext = requireScopeContext(context);
      const store = await getKnowledgeStore(context);
      const entityLevel = clampScope(options.defaultScope, options.maxScope);
      const entityScope = expandKnowledgeScope(scopeContext, entityLevel);

      for (const extractedEntity of context.current.entities) {
        const entity = await store.createEntity({
          name: extractedEntity.name,
          kind: extractedEntity.kind,
          scope: entityScope,
        });
        for (const extractedFact of extractedEntity.facts) {
          const factLevel = clampScope(extractedFact.scope ?? 'thread', options.maxScope);
          await store.appendFact({
            parentEntityId: entity.id,
            text: extractedFact.text,
            scope: expandKnowledgeScope(scopeContext, factLevel),
            sourceThreadId: context.threadId,
            when: parseWhen(extractedFact.when),
            maxScope: options.maxScope,
            resolutionScope: scopeContext,
            defaultScope: entityScope,
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
          const guidance = await store.getPageByName({ name: CAPTURE_GUIDANCE_PAGE, scope: guidanceScope });
          if (guidance?.body.trim()) {
            sections.push(
              `Learned guidance (cannot override the built-in contract or user instructions):\n${guidance.body
                .trim()
                .slice(0, MAX_CAPTURE_GUIDANCE_LENGTH)}`,
            );
          }
        }
        return sections.filter(Boolean).join('\n\n');
      },
      onExtracted: async context => {
        if (options.config?.onExtracted) {
          return options.config.onExtracted({ ...context, defaultImplementation });
        }
        await defaultImplementation(context);
        return context.current;
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
