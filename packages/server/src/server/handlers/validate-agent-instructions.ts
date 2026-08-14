import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/request-context';
import type { AgentInstructionBlock } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import { assertStoredResourceScope, getStoredResourceScope } from '../utils';

const UNPUBLISHED_REFERENCES_MESSAGE =
  'Unable to use unpublished referenced prompt blocks: {ids}. Publish these prompt blocks and try again.';

/**
 * Type guard that returns AgentInstructionBlock[] when the input is an array, or undefined otherwise.
 */
function getInstructionBlocks(instructions: unknown): AgentInstructionBlock[] | undefined {
  if (!Array.isArray(instructions)) {
    return undefined;
  }

  return instructions as AgentInstructionBlock[];
}

/**
 * Validates prompt_block_ref references in agent instructions.
 * Checks every referenced prompt block for existence, access scope, and published status with an activeVersionId.
 * Throws an HTTP 400 error listing unresolved or unpublished block IDs when validation fails.
 */
export async function validateAgentInstructionReferences({
  instructions,
  mastra,
  requestContext,
}: {
  instructions: unknown;
  mastra: Pick<Mastra, 'getServer' | 'getStorage'>;
  requestContext: RequestContext | undefined;
}): Promise<void> {
  const blocks = getInstructionBlocks(instructions);
  if (!blocks) {
    return;
  }

  const referenceIds = [
    ...new Set(
      blocks
        .filter(
          (block): block is Extract<AgentInstructionBlock, { type: 'prompt_block_ref' }> =>
            block.type === 'prompt_block_ref',
        )
        .map(block => block.id.trim())
        .filter(Boolean),
    ),
  ];
  if (referenceIds.length === 0) {
    return;
  }

  const storage = mastra.getStorage();
  const promptBlocksStore = storage ? await storage.getStore('promptBlocks') : null;
  const scope = await getStoredResourceScope(mastra, requestContext);
  const results = promptBlocksStore
    ? await Promise.allSettled(referenceIds.map(id => promptBlocksStore.getById(id)))
    : referenceIds.map(() => ({ status: 'rejected' as const, reason: new Error('Storage unavailable') }));

  const unresolvedIds: string[] = [];
  const unpublishedIds: string[] = [];

  for (const [index, result] of results.entries()) {
    const id = referenceIds[index];
    if (!id || result.status === 'rejected' || !result.value) {
      if (id) unresolvedIds.push(id);
      continue;
    }

    try {
      assertStoredResourceScope(result.value, scope);
    } catch {
      unresolvedIds.push(id);
      continue;
    }

    if (result.value.status !== 'published' || !result.value.activeVersionId) {
      unpublishedIds.push(id);
    }
  }

  if (unresolvedIds.length > 0) {
    throw new HTTPException(400, {
      message: `Unable to verify referenced prompt blocks: ${unresolvedIds.join(', ')}. Resolve these references and try again.`,
    });
  }

  if (unpublishedIds.length > 0) {
    throw new HTTPException(400, {
      message: UNPUBLISHED_REFERENCES_MESSAGE.replace('{ids}', unpublishedIds.join(', ')),
    });
  }
}
