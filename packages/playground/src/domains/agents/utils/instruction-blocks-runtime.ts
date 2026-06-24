import type { InstructionBlock } from '../components/agent-edit-page/utils/form-validation';

/**
 * Predicate answering "does a referenced prompt block contribute content at runtime?".
 *
 * Runtime instruction resolution (`resolveInstructionBlocks` in `@mastra/editor`)
 * only includes PUBLISHED prompt blocks — a ref to an unpublished (draft) block
 * is silently skipped. Studio's editor preview, by contrast, resolves with
 * `includeDrafts: true`, so a draft ref still renders. That mismatch is what
 * this helper guards against.
 *
 * When the answer for an id is unknown (e.g. the block is not in the loaded
 * list), callers should return `true` so the guard never blocks a save it
 * cannot prove is broken.
 */
export type IsPromptBlockPublished = (promptBlockId: string) => boolean;

/**
 * Returns `true` when an agent's instruction blocks would resolve to an EMPTY
 * prompt at runtime *specifically because every contributing block is an
 * unpublished prompt-block ref*.
 *
 * Intentionally narrow — it returns `false` (i.e. "not the draft problem") when:
 *  - any inline `prompt_block` has content (runtime keeps inline content), or
 *  - at least one ref points to a published block (runtime keeps it), or
 *  - there are no refs at all (the generic "instructions are required"
 *    validation already covers the truly-empty case).
 *
 * It only returns `true` when there is at least one ref and every ref is known
 * to be unpublished, with no inline content to fall back on.
 */
export function instructionsResolveEmptyDueToDrafts(
  blocks: InstructionBlock[] | undefined,
  isPublished: IsPromptBlockPublished,
): boolean {
  if (!blocks || blocks.length === 0) return false;

  let hasRef = false;

  for (const block of blocks) {
    if (block.type === 'prompt_block') {
      // Inline content survives at runtime — instructions won't be empty.
      if (block.content.trim() !== '') return false;
    } else if (block.type === 'prompt_block_ref') {
      const id = block.promptBlockId?.trim();
      if (!id) continue;
      hasRef = true;
      // A single published ref is enough to keep runtime instructions non-empty.
      if (isPublished(id)) return false;
    }
  }

  return hasRef;
}

/** User-facing message shown when a save/publish is blocked by the guard above. */
export const EMPTY_RUNTIME_INSTRUCTIONS_MESSAGE =
  'This agent only references unpublished prompt blocks, so it would run with an empty prompt. Publish the referenced prompt blocks (or add inline instructions) before continuing.';
