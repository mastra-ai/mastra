import type { KnowledgeConcreteRole, KnowledgeScope, KnowledgeStorage } from '../storage';
import type { ToolAction } from '../tools';
import { createTool } from '../tools';
import type { KnowledgeToolContext } from './knowledge-tools';
import { createKnowledgeTools, resolveKnowledgeRunAccess } from './knowledge-tools';
import { createKnowledgeWriteTools } from './knowledge-write-tools';
import { createPinnedTools } from './pinned';
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

function sourceThreadId(context: KnowledgeToolContext | undefined): string {
  const threadId = context?.agent?.threadId;
  if (!threadId) throw new Error('Knowledge tools require an active threadId.');
  return threadId;
}

/**
 * Write and pin tools take their scope at construction. Attached tools rebuild them per call
 * from the calling run, keeping the static definition (id, description, schema) from a template.
 */
function perCall(template: Tools, build: (context: KnowledgeToolContext | undefined) => Tools): Tools {
  return Object.fromEntries(
    Object.entries(template).map(([name, tool]) => [
      name,
      createTool({
        id: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: async (input: unknown, context: unknown) => {
          const inner = build(context as KnowledgeToolContext)[name];
          return inner!.execute!(input as never, context as never);
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
      sourceThreadId: sourceThreadId(context),
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
    const options = (access: { scope: KnowledgeScope; readOnly?: KnowledgeScope }, threadId: string) => ({
      ...access,
      sourceThreadId: threadId,
      maxPins,
      maxTokens,
    });
    Object.assign(
      tools,
      perCall(createPinnedTools(host, options({ scope: TEMPLATE_SCOPE }, 'template')), context =>
        createPinnedTools(host, options(resolveKnowledgeRunAccess(context), sourceThreadId(context))),
      ),
    );
  }
  return tools;
}
