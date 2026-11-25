/**
 * InstructionBuilder: Resolves an array of AgentInstructionBlock items
 * into a final instruction string.
 *
 * For each block:
 *  - `{ type: 'text', content }` → render template with context
 *  - `{ type: 'prompt_block_ref', id, rules? }` → evaluate ref rules, fetch from storage, evaluate stored block rules, render template
 *  - `{ type: 'prompt_block', content, rules? }` → inline block, evaluate rules, render template
 *
 * Blocks that fail rule evaluation are excluded.
 * Resolved text segments are joined with double newlines.
 */

import type { AgentInstructionBlock, StorageResolvedPromptBlockType, PromptBlocksStorage } from '@mastra/core/storage';

import { renderTemplate } from './template-engine';
import { evaluateRuleGroup } from './rule-evaluator';

export interface InstructionBuilderDeps {
  promptBlocksStorage: PromptBlocksStorage;
  /** When true, include draft (unpublished) prompt block refs. Used for preview mode. */
  includeDrafts?: boolean;
  /**
   * Version tag to resolve each prompt block reference with, e.g. "production". A referenced block that
   * has this tag in its `metadata.versionTags` renders the tagged version; a block without it renders
   * its published version as usual. A block that isn't published is still skipped. Ignored when
   * `includeDrafts` is set.
   */
  versionTag?: string;
  /** Include the name and ID of each rendered prompt block reference in agent instructions. */
  includePromptBlockLabels?: boolean;
  /** Called once with the version of every prompt block reference that was rendered. */
  onResolved?: (resolved: ResolvedPromptBlockVersions) => void;
}

export interface ResolvedPromptBlockVersions {
  /** The version tag that was applied, when one was. */
  versionTag?: string;
  /** Prompt block ID to the version ID that was rendered. */
  promptBlockVersions: Record<string, string>;
  /** Rendered prompt blocks that don't have `versionTag` and so used their published version. */
  promptBlocksWithoutTag: string[];
}

/** Request context key that selects a version tag for every prompt block an agent references. */
export const PROMPT_VERSION_TAG_KEY = 'promptVersionTag';

/** Request context key that selects a version tag for the agent being called. */
export const AGENT_VERSION_TAG_KEY = 'agentVersionTag';

/**
 * Reserved request context key the agent run span reads its version metadata from. Same value as
 * `MASTRA_VERSION_INFO_KEY` in `@mastra/core`, repeated here so the editor still works with a core
 * that predates it (the metadata is then not reported).
 */
export const VERSION_INFO_KEY = 'mastra__versionInfo';

/** "published" and "draft" select a status, not a tag, so they can't name a prompt version here. */
const RESERVED_VERSION_TAGS = new Set(['published', 'draft']);

function getTaggedVersionId(block: StorageResolvedPromptBlockType, tag: string): string | undefined {
  const tags = block.metadata?.versionTags;
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return undefined;
  const versionId = (tags as Record<string, unknown>)[tag];
  return typeof versionId === 'string' && versionId ? versionId : undefined;
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

  // Batch-fetch the referenced blocks to avoid N+1 queries. Skip references gated off by their own rules.
  const blockIds = Array.from(
    new Set(
      blocks
        .filter((b): b is Extract<AgentInstructionBlock, { type: 'prompt_block_ref' }> => b.type === 'prompt_block_ref')
        .filter(b => !b.rules || evaluateRuleGroup(b.rules, context))
        .map(b => b.id),
    ),
  );

  const versionTag =
    !deps.includeDrafts && deps.versionTag && !RESERVED_VERSION_TAGS.has(deps.versionTag) ? deps.versionTag : undefined;
  const resolvedBlocksMap = new Map<string, StorageResolvedPromptBlockType>();
  const taggedBlockIds = new Set<string>();
  const used: ResolvedPromptBlockVersions = {
    ...(versionTag ? { versionTag } : {}),
    promptBlockVersions: {},
    promptBlocksWithoutTag: [],
  };
  if (blockIds.length > 0) {
    // When includeDrafts is set, resolve the latest version (draft) instead of the published one
    const resolveOptions = deps.includeDrafts ? { status: 'draft' as const } : undefined;
    // Fetch all blocks in parallel
    const fetchResults = await Promise.all(
      blockIds.map(id => deps.promptBlocksStorage.getByIdResolved(id, resolveOptions)),
    );
    for (let i = 0; i < blockIds.length; i++) {
      const result = fetchResults[i];
      if (result) {
        resolvedBlocksMap.set(blockIds[i]!, result);
      }
    }

    // Swap in the tagged version of each block that has the requested tag.
    if (versionTag) {
      await Promise.all(
        Array.from(resolvedBlocksMap, async ([id, block]) => {
          const versionId = getTaggedVersionId(block, versionTag);
          if (!versionId) return;
          const tagged = await deps.promptBlocksStorage.getByIdResolved(id, { versionId });
          if (tagged) {
            resolvedBlocksMap.set(id, tagged);
            taggedBlockIds.add(id);
          }
        }),
      );
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
    // Per-usage rules on the ref gate this placement of the shared block (e.g. as a fallback)
    if (block.rules && !evaluateRuleGroup(block.rules, context)) {
      continue;
    }

    const resolved = resolvedBlocksMap.get(block.id);
    if (!resolved) {
      // Block not found in storage — skip silently
      continue;
    }

    // Only include published blocks (unless in preview/draft mode)
    if (!deps.includeDrafts && resolved.status !== 'published') {
      continue;
    }

    // The stored block's own rules must also pass
    if (resolved.rules) {
      const passes = evaluateRuleGroup(resolved.rules, context);
      if (!passes) {
        continue;
      }
    }

    // Render template content
    const rendered = renderTemplate(resolved.content, context);
    if (rendered.trim()) {
      const versionId = resolved.resolvedVersionId ?? resolved.activeVersionId;
      if (versionId) used.promptBlockVersions[resolved.id] = versionId;
      if (versionTag && !taggedBlockIds.has(resolved.id) && !used.promptBlocksWithoutTag.includes(resolved.id)) {
        used.promptBlocksWithoutTag.push(resolved.id);
      }
      segments.push(
        deps.includePromptBlockLabels
          ? `Prompt block: ${JSON.stringify(resolved.name)} (ID: ${JSON.stringify(resolved.id)})\n${rendered}`
          : rendered,
      );
    }
  }

  deps.onResolved?.(used);
  return segments.join('\n\n');
}
