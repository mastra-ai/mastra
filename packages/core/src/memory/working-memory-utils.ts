export const WORKING_MEMORY_START_TAG = '<working_memory>';
export const WORKING_MEMORY_END_TAG = '</working_memory>';

export const SYSTEM_REMINDER_START_TAG = '<system-reminder>';
export const SYSTEM_REMINDER_END_TAG = '</system-reminder>';

/**
 * Tool name used when working memory is delivered via the legacy system-message path.
 * This is the registry key in `Memory.listTools()` and therefore the `toolName` on the
 * wire when the LLM calls the tool.
 */
export const UPDATE_WORKING_MEMORY_TOOL_NAME = 'updateWorkingMemory';

/**
 * Tool name used when working memory is delivered via state signals
 * (`workingMemory.useStateSignals: true`). The rename keeps legacy strip filters
 * — which look for `updateWorkingMemory` — from incidentally stripping the new
 * path's tool-call parts, so they persist as a normal audit trail.
 */
export const SET_WORKING_MEMORY_TOOL_NAME = 'setWorkingMemory';

/**
 * All known working-memory tool names. Use this when you want to recognize the
 * tool regardless of delivery mode (e.g. to skip scoring on WM-only iterations
 * or detect that working memory was updated). Strip-style filters should NOT
 * use this — they should keep matching only `UPDATE_WORKING_MEMORY_TOOL_NAME`.
 */
export const WORKING_MEMORY_TOOL_NAMES = [UPDATE_WORKING_MEMORY_TOOL_NAME, SET_WORKING_MEMORY_TOOL_NAME] as const;

export function isWorkingMemoryToolName(name: string | undefined | null): boolean {
  return name === UPDATE_WORKING_MEMORY_TOOL_NAME || name === SET_WORKING_MEMORY_TOOL_NAME;
}

/*
 * Compatibility note: @mastra/memory intentionally copies the exported helpers
 * in this file into packages/memory/src/index.ts instead of importing them.
 * Its peer range permits older core versions that do not export these newer
 * names, and importing them can crash published memory builds during ESM
 * instantiation. Until v2 can tighten that peer contract, keep both sides
 * manually in sync.
 */

/**
 * Extracts all working memory tag contents from text using indexOf-based parsing.
 * This avoids ReDoS vulnerability that exists with regex-based approaches.
 * @returns Array of full matches (including tags) or null if no matches
 */
export function extractWorkingMemoryTags(text: string): string[] | null {
  const results: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    const start = text.indexOf(WORKING_MEMORY_START_TAG, pos);
    if (start === -1) break;

    const end = text.indexOf(WORKING_MEMORY_END_TAG, start + WORKING_MEMORY_START_TAG.length);
    if (end === -1) break;

    results.push(text.substring(start, end + WORKING_MEMORY_END_TAG.length));
    pos = end + WORKING_MEMORY_END_TAG.length;
  }

  return results.length > 0 ? results : null;
}

/**
 * Removes all working memory tags and their contents from text.
 * Uses indexOf-based parsing to avoid ReDoS vulnerability.
 */
export function removeWorkingMemoryTags(text: string): string {
  let result = '';
  let pos = 0;

  while (pos < text.length) {
    const start = text.indexOf(WORKING_MEMORY_START_TAG, pos);
    if (start === -1) {
      result += text.substring(pos);
      break;
    }

    result += text.substring(pos, start);

    const end = text.indexOf(WORKING_MEMORY_END_TAG, start + WORKING_MEMORY_START_TAG.length);
    if (end === -1) {
      // No closing tag found, keep the rest as-is
      result += text.substring(start);
      break;
    }

    pos = end + WORKING_MEMORY_END_TAG.length;
  }

  return result;
}

/**
 * Extracts the content of the first working memory tag (without the tags themselves).
 * Uses indexOf-based parsing to avoid ReDoS vulnerability.
 * @returns The content between the tags, or null if no valid tag pair found
 */
export function extractWorkingMemoryContent(text: string): string | null {
  const start = text.indexOf(WORKING_MEMORY_START_TAG);
  if (start === -1) return null;

  const contentStart = start + WORKING_MEMORY_START_TAG.length;
  const end = text.indexOf(WORKING_MEMORY_END_TAG, contentStart);
  if (end === -1) return null;

  return text.substring(contentStart, end);
}

/**
 * Removes all system-reminder tags and their contents from text.
 * Uses indexOf-based parsing to avoid ReDoS vulnerability.
 *
 * Note: system-reminder tags can have attributes like `<system-reminder type="...">`,
 * so we match from `<system-reminder` to the closing `>` for the start tag.
 */
export function removeSystemReminderTags(text: string): string {
  let result = '';
  let pos = 0;

  while (pos < text.length) {
    // Find start of tag (may have attributes)
    const startTagBegin = text.indexOf('<system-reminder', pos);
    if (startTagBegin === -1) {
      result += text.substring(pos);
      break;
    }

    result += text.substring(pos, startTagBegin);

    // Find end of opening tag (the closing >)
    const startTagEnd = text.indexOf('>', startTagBegin);
    if (startTagEnd === -1) {
      // Malformed tag, keep rest as-is
      result += text.substring(startTagBegin);
      break;
    }

    // Find closing tag
    const end = text.indexOf(SYSTEM_REMINDER_END_TAG, startTagEnd + 1);
    if (end === -1) {
      // No closing tag found, keep the rest as-is
      result += text.substring(startTagBegin);
      break;
    }

    pos = end + SYSTEM_REMINDER_END_TAG.length;
  }

  return result;
}
