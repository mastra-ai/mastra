import { resolveRequestThinkingLevel } from '@mastra/code-sdk/agents/model';
import type { ThinkingLevel } from '@mastra/code-sdk/providers/openai-codex';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

export type ReviewRuntime = {
  modelId: string;
  thinkingLevel: ThinkingLevel;
};

// Read at the moment it is needed: a thread that switches model mid-session must
// not attribute the new turn to the model that answered the previous one.
export function reviewRuntimeFromRequestContext(requestContext: RequestContext | undefined): ReviewRuntime | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get<'controller', AgentControllerRequestContext<MastraCodeState>>('controller');
  const modelId = context?.session?.modelId.trim();
  if (!modelId) return null;
  return { modelId, thinkingLevel: resolveRequestThinkingLevel(context) };
}
