import { MASTRA_BUILDER_MODEL_POLICY_KEY } from '@mastra/core/agent-builder/ee';
import type { BuilderModelPolicy } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import type { RequestContext } from '@mastra/core/request-context';

import { resolveBuilderModelPolicy } from './resolve-builder-model-policy';

/**
 * Resolve the Agent Builder model policy and seed it onto the server's `RequestContext`
 * under the reserved internal key BEFORE any client-supplied request-context entries are
 * merged. Server merge logic (`set first; client cannot overwrite`) means a spoofed body
 * value cannot displace this seed.
 *
 * Returns the resolved policy so callers may short-circuit if needed.
 */
export async function seedBuilderModelPolicy(
  editor: IMastraEditor | undefined,
  serverRequestContext: RequestContext,
): Promise<BuilderModelPolicy> {
  const policy = await resolveBuilderModelPolicy(editor);
  serverRequestContext.set(MASTRA_BUILDER_MODEL_POLICY_KEY, policy);
  return policy;
}
