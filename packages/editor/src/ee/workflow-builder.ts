import type { Mastra } from '@mastra/core';
import type { Agent } from '@mastra/core/agent';
import type { IWorkflowBuilder, WorkflowBuilderOptions } from '@mastra/core/editor';
import type { MastraModelConfig } from '@mastra/core/llm';
import { createWorkflowBuilderAgent as createSharedWorkflowBuilderAgent } from '@mastra/core/workflows/builder';
import { Memory } from '@mastra/memory';

export const DEFAULT_WORKFLOW_BUILDER_MODEL = 'openai/gpt-5.5';

/**
 * Authoring turns are tool-heavy: a single request can persist dozens of
 * inspection and submission records. The memory default of 10 evicts the user's
 * original request long before the workflow is finished, which reads as the
 * agent forgetting what it was asked to build.
 */
export const DEFAULT_WORKFLOW_BUILDER_LAST_MESSAGES = 100;

export function createWorkflowBuilderAgent(
  model?: MastraModelConfig,
  lastMessages: number = DEFAULT_WORKFLOW_BUILDER_LAST_MESSAGES,
): Agent<'workflow-builder-agent'> {
  return createSharedWorkflowBuilderAgent({
    id: 'workflow-builder-agent',
    name: 'Workflow Builder',
    description: 'Builds persisted workflow definitions through constrained client tools',
    model: model ?? DEFAULT_WORKFLOW_BUILDER_MODEL,
    memory: new Memory({ options: { lastMessages } }),
    surfaceInstructions: `# Studio authoring policy

Turn the user's request into a complete canonical workflow definition using the registered agent, tool, and workflow catalogs. Treat the current unsaved authoring state, accepted definition, candidate definition, and validation issues injected in each turn as authoritative. Never describe schemas, mapping form, graph shape, lifecycle, or persistence state from memory—read the authoritative Studio state and catalogs first.

The three shared listing tools behave here as the shared playbook describes, with one Studio specific: \`list-available-workflows\` reports \`catalog-unavailable\` when this user lacks workflow read permission. Agents and tools stay listable in that case, so compose without nested workflow references rather than treating discovery as blocked.

# Studio execution and response protocol

1. Complete discovery, composition, and the shared pre-action check before calling \`submit-workflow-draft\`.
2. Call \`submit-workflow-draft\` with one complete canonical definition. Do not submit incremental fragments, speculative alternatives, or parallel attempts.
   When the definition nests helper workflows that the catalog does not have yet, put those complete helper definitions in the same submission's \`dependencies\` array. Never submit a helper on its own turn or in a separate call — the whole set travels as one submission, goes Ready as one unit, and the user's Save persists it as one unit. Only add a helper the composition genuinely requires, give it a real id and description because the user will see it as its own workflow, and tell the user in your summary which helpers Save will create.
3. Wait for the submission result before deciding what to do next. A successful submission makes the returned accepted definition the authoritative Ready draft. Stop calling tools after success and never resubmit that Ready definition in the same turn.
4. If the submission is rejected with validation diagnostics, do not claim success. Correct every returned issue against authoritative inspection, rerun the shared pre-action check, and make one sequential corrected complete submission.
5. If the result is \`already-ready\`, the returned accepted definition is authoritative. Do not retry or replace it in the same turn; summarize it and wait for a new user turn.
6. If the result is \`superseded\`, an earlier submission in the turn won. Do not apologize, retry, or claim the workflow is broken. Inspect the authoritative state before making any claim.
7. Ready is not persisted. Never persist directly, never call a server-side \`save-workflow\` tool, and never claim persistence. Only the user's explicit Studio Save action may persist the finalized draft.
8. After Ready success, follow the shared summary rules and end by telling the user to review the authoritative draft and use the explicit Studio Save action.`,
  });
}

export class EditorWorkflowBuilder implements IWorkflowBuilder {
  readonly enabled: boolean;
  private readonly agent;
  private readonly modelPolicy: WorkflowBuilderOptions['modelPolicy'];

  constructor(options: WorkflowBuilderOptions = {}, mastra?: Mastra) {
    this.enabled = options.enabled !== false;
    this.modelPolicy = options.modelPolicy;
    this.agent = createWorkflowBuilderAgent(options.model, options.lastMessages);
    if (mastra) {
      this.agent.__registerMastra(mastra);
      this.agent.__registerPrimitives({ logger: mastra.getLogger(), storage: mastra.getStorage() });
    }
  }

  getAgent() {
    return this.agent;
  }

  getModelPolicy() {
    return this.modelPolicy;
  }
}
