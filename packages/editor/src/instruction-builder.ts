/**
 * InstructionBuilder: Resolves an array of AgentInstructionBlock items
 * into a final instruction string.
 *
 * For each block:
 *  - `{ type: 'text', content }` → render template with context
 *  - `{ type: 'prompt_block_ref', id }` → fetch from storage, evaluate rules, render template
 *  - `{ type: 'prompt_block', content, rules? }` → inline block, evaluate rules, render template
 *
 * Blocks that fail rule evaluation are excluded.
 * Resolved text segments are joined with double newlines.
 */

import type { AgentInstructionBlock, StorageResolvedPromptBlockType } from '@mastra/core/storage';
import type { PromptBlocksStorage } from '@mastra/core/storage';

import { renderTemplate } from './template-engine';
import { evaluateRuleGroup } from './rule-evaluator';

export interface InstructionBuilderDeps {
  promptBlocksStorage: PromptBlocksStorage;
}

/**
 * Resolves an array of instruction blocks into a final instruction string.
 *
 * @param blocks - Array of instruction block references (text, prompt_block_ref, or inline prompt_block)
 * @param context - Runtime context for template interpolation and rule evaluation
 * @param deps - Dependencies (storage)
 * @returns The resolved instruction string
 */
export async function resolveInstructionBlocks(
  blocks: AgentInstructionBlock[],
  context: Record<string, unknown>,
  deps: InstructionBuilderDeps,
): Promise<string> {
  const segments: string[] = [];

  // Batch-fetch all prompt block ref IDs to avoid N+1 queries
  const blockIds = Array.from(
    new Set(
      blocks.filter((b): b is { type: 'prompt_block_ref'; id: string } => b.type === 'prompt_block_ref').map(b => b.id),
    ),
  );

  const resolvedBlocksMap = new Map<string, StorageResolvedPromptBlockType>();
  if (blockIds.length > 0) {
    // Fetch all blocks in parallel
    const fetchResults = await Promise.all(blockIds.map(id => deps.promptBlocksStorage.getByIdResolved(id)));
    for (let i = 0; i < blockIds.length; i++) {
      const result = fetchResults[i];
      if (result) {
        resolvedBlocksMap.set(blockIds[i]!, result);
      }
    }
  }

  for (const block of blocks) {
    if (block.type === 'text') {
      // Static text blocks: render template, always included
      const rendered = renderTemplate(block.content, context);
      if (rendered.trim()) {
        segments.push(rendered);
      }
      continue;
    }

    if (block.type === 'prompt_block') {
      // Inline prompt block: evaluate rules and render template directly
      if (block.rules) {
        const passes = evaluateRuleGroup(block.rules, context);
        if (!passes) {
          continue;
        }
      }

      const rendered = renderTemplate(block.content, context);
      if (rendered.trim()) {
        segments.push(rendered);
      }
      continue;
    }

    // Prompt block reference (prompt_block_ref)
    const resolved = resolvedBlocksMap.get(block.id);
    if (!resolved) {
      // Block not found in storage — skip silently
      continue;
    }

    // Only include published blocks
    if (resolved.status !== 'published') {
      continue;
    }

    // Evaluate rules if present
    if (resolved.rules) {
      const passes = evaluateRuleGroup(resolved.rules, context);
      if (!passes) {
        continue;
      }
    }

    // Render template content
    const rendered = renderTemplate(resolved.content, context);
    if (rendered.trim()) {
      segments.push(rendered);
    }
  }

  return segments.join('\n\n');
}
