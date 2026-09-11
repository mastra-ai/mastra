/**
 * Sub-agent tool: persist the Dynamic Workflow definition and live-register it.
 * Calls `mastra.addDynamicWorkflow()`. After this returns the workflow is
 * immediately runnable.
 *
 * The complete-definition authoring contract (graph families, mapping sources,
 * predicate DSL, and all model-facing guidance) is shared with Studio's
 * `submit-workflow-draft` and lives in `@mastra/core/workflows/builder`.
 */
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import {
  normalizeWorkflowBuilderDefinition,
  workflowBuilderDefinitionSchema,
  type WorkflowBuilderDefinition,
} from '@mastra/core/workflows/builder';
import { z } from 'zod';

export { WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION as MAPPING_CONFIG_DESCRIPTION } from '@mastra/core/workflows/builder';

export const workflowDefinitionInputSchema = z.preprocess(
  normalizeWorkflowBuilderDefinition,
  workflowBuilderDefinitionSchema,
);

export interface SaveWorkflowAuthorizationContext {
  /**
   * A detached copy of the complete definition. Mutating it cannot change the
   * definition passed to `Mastra.addDynamicWorkflow()`.
   */
  definition: Readonly<WorkflowBuilderDefinition>;
  requestContext: RequestContext;
}

export interface CreateSaveWorkflowToolOptions {
  /**
   * Optional deny-only policy hook. Throw to reject the save. Return normally
   * to allow it. The callback cannot replace or rewrite the saved definition.
   */
  authorize?: (context: SaveWorkflowAuthorizationContext) => void | Promise<void>;
}

/**
 * Creates the native Dynamic Workflow save tool with an optional host policy.
 * Validation, persistence, registration, and rollback remain owned by
 * `Mastra.addDynamicWorkflow()`.
 */
export function createSaveWorkflowTool(options: CreateSaveWorkflowToolOptions = {}) {
  return createTool({
    id: 'save-workflow',
    description:
      'Persist a Dynamic Workflow definition and live-register it on the running Mastra instance. Supports all ten persisted graph families: agent, tool, mapping, nested workflow, parallel, foreach, sleep, sleepUntil, conditional, and loop. Conditional and loop entries require declarative predicates; JS closures cannot round-trip through storage. After this returns, the workflow is immediately runnable. Call it exactly once with the complete definition; there is no incremental save API.',
    inputSchema: workflowDefinitionInputSchema,
    outputSchema: z.object({
      ok: z.literal(true),
      id: z.string(),
    }),
    execute: async (def, { mastra, requestContext }) => {
      if (!mastra) throw new Error('save-workflow requires a Mastra context.');
      const m = mastra as Mastra;
      const normalizedDefinition = normalizeWorkflowBuilderDefinition(def);

      if (options.authorize) {
        // Normalize again to give policy code a detached JSON-safe value. The
        // callback can inspect or reject, but cannot mutate the accepted input.
        const authorizationDefinition = normalizeWorkflowBuilderDefinition(normalizedDefinition);
        await options.authorize({ definition: authorizationDefinition, requestContext });
      }

      // `mastra.addDynamicWorkflow` performs registry pre-flight — a mis-classified
      // agentId/toolId or unregistered id throws before rehydration with an
      // actionable message listing every offender. It also rejects JSON Schemas
      // that use keywords the storage-side converter can't rehydrate
      // (oneOf/anyOf/allOf/not/$ref/patternProperties/discriminator).
      await m.addDynamicWorkflow(normalizedDefinition as Parameters<Mastra['addDynamicWorkflow']>[0]);
      return { ok: true as const, id: normalizedDefinition.id };
    },
  });
}

export const saveWorkflowTool = createSaveWorkflowTool();
