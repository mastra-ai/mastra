/**
 * Parent-mode tool: delegate workflow construction to the workflow-builder
 * sub-agent. The parent code-agent calls this with the user's request verbatim;
 * the sub-agent runs its own discovery → compose → save loop and returns a
 * one-paragraph summary the parent relays to the user.
 *
 * The split exists so the parent code-agent's system prompt stays focused on
 * coding and isn't polluted with the long workflow-authoring contract.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface AgentLike {
  stream: (
    input: string,
    options?: { requestContext?: unknown },
  ) => Promise<{
    fullStream: ReadableStream<{ type: string; payload?: { toolName?: string; result?: unknown } }>;
    text: Promise<string>;
  }>;
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
    const builder = (mastra as unknown as { getAgent: (id: string) => AgentLike | undefined }).getAgent(
      'workflow-builder',
    );
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

    // Sub-agent runs its own tool loop. Watch the stream for the save-workflow
    // tool-result so we can surface the workflow id alongside the summary.
    let workflowId: string | undefined;
    const reader = stream.fullStream.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value?.type === 'tool-result' && value.payload?.toolName === 'save-workflow') {
        const result = value.payload.result as { id?: string } | undefined;
        if (typeof result?.id === 'string') workflowId = result.id;
      }
    }

    const summary = await stream.text;
    return { summary, workflowId };
  },
});
