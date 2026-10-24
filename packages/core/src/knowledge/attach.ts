import type { KnowledgeConcreteRole, KnowledgeScope, KnowledgeStorage } from '../storage';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';
import type { KnowledgeToolContext } from './knowledge-tools';
import { createKnowledgeTools, resolveKnowledgeRunAccess } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import { createPinnedTools } from './pinned';
import { PINNED_READ_MEMO_KEY } from './pinned-state-processor';
import type { KnowledgeSemanticIndexCoordinator } from './semantic-index';

/** What the moved tool factories need from whoever hosts them. */
export interface KnowledgeToolHost {
  getKnowledgeStore(): Promise<KnowledgeStorage>;
  getKnowledgeSemanticIndex(): Promise<KnowledgeSemanticIndexCoordinator | undefined>;
  getKnowledgeInstance(): {
    __ownedScopeRole?(tag: string, heldTags: readonly string[]): KnowledgeConcreteRole | undefined;
    __getVisibleStructureScopes(
      scope: KnowledgeScope,
    ): Promise<Array<{ address: string; name: string; description?: string; heldAncestors?: string[] }>>;
    materializeScope?(input: {
      address: string;
      contextualScopeAddress: string;
      parentAddresses?: string[];
    }): Promise<unknown>;
  };
}

export interface KnowledgeToolGroups {
  read: boolean;
  write: boolean;
  pins: false | { maxPins: number; maxTokens: number };
}

type Tools = Record<string, ToolAction<any, any, any>>;

/** Placeholder options used only to read the static tool definitions (ids, descriptions, schemas). */
const TEMPLATE_SCOPE: KnowledgeScope = ['thread:template'];

/** Where a record came from: the writing agent's thread, stamped with the agent as its source. */
function provenance(context: KnowledgeToolContext | undefined): { sourceThreadId: string; source?: string } {
  const threadId = context?.agent?.threadId;
  if (!threadId) throw new Error('Knowledge tools require an active threadId.');
  const agentId = context?.agent?.agentId;
  return { sourceThreadId: threadId, ...(agentId ? { source: `agent:${agentId}` } : {}) };
}

/**
 * Write and pin tools take their scope at construction. Attached tools rebuild them per call
 * from the calling run, keeping every other field of the template (schemas, approval, MCP and
 * background settings) and replacing only `execute`.
 */
function perCall(
  template: Tools,
  build: (context: KnowledgeToolContext | undefined) => Tools,
  after?: (context: KnowledgeToolContext | undefined) => void,
): Tools {
  return Object.fromEntries(
    Object.entries(template).map(([name, tool]) => [
      name,
      createTool({
        ...(tool as any),
        execute: async (input: unknown, context: unknown) => {
          const inner = build(context as KnowledgeToolContext)[name];
          const result = await inner!.execute!(input as never, context as never);
          after?.(context as KnowledgeToolContext);
          return result;
        },
      }),
    ]),
  );
}

export function buildKnowledgeTools(host: KnowledgeToolHost, groups: KnowledgeToolGroups): Tools {
  const tools: Tools = {};
  if (groups.read) Object.assign(tools, createKnowledgeTools(host));
  if (groups.write) {
    const options = (context: KnowledgeToolContext | undefined) => ({
      ...resolveKnowledgeRunAccess(context, host.getKnowledgeInstance()),
      ...provenance(context),
    });
    Object.assign(
      tools,
      perCall(createKnowledgeWriteTools(host, { scope: TEMPLATE_SCOPE, sourceThreadId: 'template' }), context =>
        createKnowledgeWriteTools(host, options(context)),
      ),
    );
  }
  if (groups.pins) {
    const { maxPins, maxTokens } = groups.pins;
    const options = (
      access: { scope: KnowledgeScope; readOnly?: KnowledgeScope },
      origin: { sourceThreadId: string; source?: string },
    ) => ({
      ...access,
      ...origin,
      maxPins,
      maxTokens,
    });
    Object.assign(
      tools,
      perCall(
        createPinnedTools(host, options({ scope: TEMPLATE_SCOPE }, { sourceThreadId: 'template' })),
        context => createPinnedTools(host, options(resolveKnowledgeRunAccess(context), provenance(context))),
        // A pin write changes what the pins lane shows; drop the turn's memoized read.
        context =>
          (context?.requestContext as { delete?(key: string): void } | undefined)?.delete?.(PINNED_READ_MEMO_KEY),
      ),
    );
  }
  return tools;
}
