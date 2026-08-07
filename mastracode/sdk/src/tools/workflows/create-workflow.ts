/**
 * Parent-mode tool: delegate workflow construction to the workflow-builder
 * sub-agent. The parent code-agent calls this with the user's request verbatim;
 * the sub-agent runs its own discovery → compose → save loop and returns a
 * one-paragraph summary the parent relays to the user.
 *
 * The split exists so the parent code-agent's system prompt stays focused on
 * coding and isn't polluted with the long workflow-authoring contract.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Coerce an unknown thrown value into a readable string. Sub-agent tool errors
 * come through the stream in various shapes (Error, plain object, string) —
 * normalise so the parent tool's error message is always useful.
 */
function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export const createWorkflowTool = createTool({
  id: 'create-workflow',
  description:
    'Build and save a static workflow on behalf of the user. Pass the user request verbatim — a focused sub-agent handles discovery, construction, and persistence, then returns a summary. Use this whenever the user asks to "build a workflow", "compose a workflow", or similar. Do NOT try to construct workflows inline yourself.',
  inputSchema: z.object({
    request: z.string().describe('The user request, verbatim — do not paraphrase or summarise.'),
  }),
  outputSchema: z.object({
    summary: z.string().describe('Natural-language summary of what the sub-agent built. Relay this to the user.'),
    workflowId: z.string().optional().describe('The id of the saved workflow, if save-workflow returned ok.'),
  }),
  execute: async ({ request }, { mastra, requestContext }) => {
    if (!mastra) throw new Error('create-workflow requires a Mastra context.');
    const builder = (mastra as Mastra).getAgent('workflow-builder' as never);
    if (!builder) {
      throw new Error(
        'The "workflow-builder" sub-agent is not registered on this Mastra instance. Cannot build workflows.',
      );
    }

    // Propagate the parent code-agent's requestContext so the sub-agent's
    // dynamic model resolver (getDynamicModel) sees controller.session.modelId.
    // Without this the sub-agent throws "No model selected" even when the user
    // has /models configured for the main code-agent.
    const stream = await builder.stream(request, { requestContext });

    // Sub-agent runs its own tool loop. We MUST verify save-workflow actually
    // ran and returned ok — otherwise the sub-agent's natural-language "summary"
    // is worthless (it will happily claim success without ever calling the tool,
    // or claim success after save-workflow threw). Surface every error the
    // sub-agent's tools produce so the caller sees them instead of a fake ok.
    let workflowId: string | undefined;
    let saveAttempted = false;
    let saveSucceeded = false;
    const toolErrors: Array<{ toolName: string; error: string }> = [];

    const reader = stream.fullStream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value?.type === 'tool-call' && value.payload?.toolName === 'save-workflow') {
        saveAttempted = true;
      }
      if (value?.type === 'tool-result' && value.payload?.toolName === 'save-workflow') {
        const result = value.payload.result as { id?: string; ok?: boolean } | undefined;
        if (result && result.ok === true && typeof result.id === 'string') {
          workflowId = result.id;
          saveSucceeded = true;
        }
      }
      if (value?.type === 'tool-error' && typeof value.payload?.toolName === 'string') {
        toolErrors.push({ toolName: value.payload.toolName, error: stringifyError(value.payload.error) });
      }
    }

    const summary = await stream.text;

    // If save-workflow errored, surface that error explicitly — do NOT return
    // the sub-agent's summary as if things were fine.
    const saveErrors = toolErrors.filter(e => e.toolName === 'save-workflow');
    if (saveErrors.length > 0 && !saveSucceeded) {
      throw new Error(
        `create-workflow failed: save-workflow threw ${saveErrors.length} error(s):\n- ${saveErrors
          .map(e => e.error)
          .join('\n- ')}\n\nSub-agent summary (unreliable, save did not succeed):\n${summary}`,
      );
    }

    // If save-workflow was never called, the sub-agent gave up (or hallucinated
    // success). Fail loudly so the caller doesn't think a workflow exists.
    if (!saveAttempted) {
      const otherErrors = toolErrors.length
        ? `\n\nOther sub-agent tool errors:\n- ${toolErrors.map(e => `${e.toolName}: ${e.error}`).join('\n- ')}`
        : '';
      throw new Error(
        `create-workflow failed: the workflow-builder sub-agent never called save-workflow. No workflow was persisted.${otherErrors}\n\nSub-agent summary:\n${summary}`,
      );
    }

    // Save was attempted but never returned ok (no tool-result with { ok: true, id }).
    if (!saveSucceeded) {
      const otherErrors = toolErrors.length
        ? `\n\nSub-agent tool errors:\n- ${toolErrors.map(e => `${e.toolName}: ${e.error}`).join('\n- ')}`
        : '';
      throw new Error(
        `create-workflow failed: save-workflow was called but did not return { ok: true }.${otherErrors}\n\nSub-agent summary:\n${summary}`,
      );
    }

    return { summary, workflowId };
  },
});
