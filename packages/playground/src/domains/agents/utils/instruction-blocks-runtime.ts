import type { InstructionBlock } from '../components/agent-edit-page/utils/form-validation';

export type PromptBlockPublicationStatus = 'published' | 'unpublished' | 'unknown';

export type UnresolvedPromptBlock = {
  id: string;
  name?: string;
  reason: 'not_found' | 'forbidden' | 'request_failed';
};

export type RuntimeEmptyResult = { type: 'empty' } | { type: 'published' } | { type: 'unknown'; ids: string[] };

/**
 * Checks all instruction blocks for prompt block references and determines whether runtime content is available.
 * Returns { type: 'empty' } when every referenced block is unpublished;
 * { type: 'unknown', ids: [...] } when some blocks have an unknown publication status;
 * { type: 'published' } otherwise.
 */
export function instructionsResolveEmptyDueToDrafts(
  blocks: InstructionBlock[] | undefined,
  publicationStatuses: ReadonlyMap<string, PromptBlockPublicationStatus>,
): RuntimeEmptyResult {
  // The length half is a shortcut: an empty list walks no blocks, so the
  // `hasRef` check at the end reports `published` either way.
  // Stryker disable next-line ConditionalExpression
  if (!blocks || blocks.length === 0) return { type: 'published' };

  let hasRef = false;
  let hasRuntimeContent = false;
  const unknownIds: string[] = [];

  for (const block of blocks) {
    if (block.type === 'prompt_block') {
      if (block.content.trim() !== '') hasRuntimeContent = true;
      continue;
    }

    const id = block.promptBlockId?.trim();
    if (!id) continue;
    hasRef = true;

    const status = publicationStatuses.get(id);
    if (status === undefined || status === 'unknown') {
      unknownIds.push(id);
    } else if (status === 'published') {
      hasRuntimeContent = true;
    }
  }

  if (unknownIds.length > 0) return { type: 'unknown', ids: [...new Set(unknownIds)] };
  if (hasRuntimeContent) return { type: 'published' };
  if (hasRef) return { type: 'empty' };
  return { type: 'published' };
}

/**
 * Formats unresolved prompt block references into a human-readable error message.
 * Includes the block name alongside the ID when available.
 */
export function formatUnresolvedPromptBlocksMessage(blocks: UnresolvedPromptBlock[]): string {
  const labels = blocks.map(block => (block.name ? `"${block.name}" (${block.id})` : block.id)).join(', ');

  return `Unable to verify referenced prompt block${blocks.length === 1 ? '' : 's'}: ${labels}. Resolve these references or try again before continuing.`;
}

export const EMPTY_RUNTIME_INSTRUCTIONS_MESSAGE =
  'This agent only references unpublished prompt blocks, so it would run with an empty prompt. Publish the referenced prompt blocks or add inline instructions before continuing.';

/**
 * Formats unpublished prompt block IDs into an error message telling the user to publish before continuing.
 */
export function formatUnpublishedPromptBlocksMessage(ids: string[]): string {
  return `Unable to use unpublished referenced prompt block${ids.length === 1 ? '' : 's'}: ${ids.join(', ')}. Publish these prompt blocks and try again.`;
}

/**
 * Formats prompt block IDs whose publication status is unknown into an error message.
 * These blocks may have been deleted or are temporarily unavailable.
 */
export function formatUnknownPromptBlocksMessage(ids: string[]): string {
  const labels = ids.join(', ');
  return `Unable to verify publication status for prompt block${ids.length === 1 ? '' : 's'}: ${labels}. The block may have been deleted or is temporarily unavailable. Please check and try again.`;
}
