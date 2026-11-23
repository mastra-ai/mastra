import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import { removeWorkingMemoryTags, removeWorkingMemoryToolInvocationParts } from '../../../memory/working-memory-utils';
import { filterMessagesForPersistence } from '../../filter-messages-for-persistence';
import { CacheKeyGenerator } from '../cache/CacheKeyGenerator';
import { TypeDetector } from '../detection/TypeDetector';
import type { MastraDBMessage, MastraMessagePart } from '../state/types';
import type { MessageInput } from '../types';
import { clearTokenEstimates } from '../utils/token-estimates';

/**
 * Convert CoreMessage content to a plain string.
 * Extracts text from text parts and concatenates them.
 */
export function coreContentToString(content: CoreMessageV4['content']): string {
  if (typeof content === `string`) return content;

  return content.reduce((p, c) => {
    if (c.type === `text`) {
      p += c.text;
    }
    return p;
  }, '');
}

/**
 * Compare two messages for equality based on their content.
 * Uses cache keys for efficient comparison across different message formats.
 */
export function messagesAreEqual(one: MessageInput, two: MessageInput): boolean {
  const oneUIV4 = TypeDetector.isAIV4UIMessage(one) && one;
  const twoUIV4 = TypeDetector.isAIV4UIMessage(two) && two;
  if (oneUIV4 && !twoUIV4) return false;
  if (oneUIV4 && twoUIV4) {
    return CacheKeyGenerator.fromAIV4Parts(one.parts) === CacheKeyGenerator.fromAIV4Parts(two.parts);
  }

  const oneCMV4 = TypeDetector.isAIV4CoreMessage(one) && one;
  const twoCMV4 = TypeDetector.isAIV4CoreMessage(two) && two;
  if (oneCMV4 && !twoCMV4) return false;
  if (oneCMV4 && twoCMV4) {
    return (
      CacheKeyGenerator.fromAIV4CoreMessageContent(oneCMV4.content) ===
      CacheKeyGenerator.fromAIV4CoreMessageContent(twoCMV4.content)
    );
  }

  const oneMM1 = TypeDetector.isMastraMessageV1(one) && one;
  const twoMM1 = TypeDetector.isMastraMessageV1(two) && two;
  if (oneMM1 && !twoMM1) return false;
  if (oneMM1 && twoMM1) {
    return (
      oneMM1.id === twoMM1.id &&
      CacheKeyGenerator.fromAIV4CoreMessageContent(oneMM1.content) ===
        CacheKeyGenerator.fromAIV4CoreMessageContent(twoMM1.content)
    );
  }

  const oneMM2 = TypeDetector.isMastraDBMessage(one) && one;
  const twoMM2 = TypeDetector.isMastraDBMessage(two) && two;
  if (oneMM2 && !twoMM2) return false;
  if (oneMM2 && twoMM2) {
    return (
      oneMM2.id === twoMM2.id &&
      CacheKeyGenerator.fromDBParts(oneMM2.content.parts) === CacheKeyGenerator.fromDBParts(twoMM2.content.parts)
    );
  }

  const oneUIV5 = TypeDetector.isAIV5UIMessage(one) && one;
  const twoUIV5 = TypeDetector.isAIV5UIMessage(two) && two;
  if (oneUIV5 && !twoUIV5) return false;
  if (oneUIV5 && twoUIV5) {
    return CacheKeyGenerator.fromAIV5Parts(one.parts) === CacheKeyGenerator.fromAIV5Parts(two.parts);
  }

  const oneCMV5 = TypeDetector.isAIV5CoreMessage(one) && one;
  const twoCMV5 = TypeDetector.isAIV5CoreMessage(two) && two;
  if (oneCMV5 && !twoCMV5) return false;
  if (oneCMV5 && twoCMV5) {
    return (
      CacheKeyGenerator.fromAIV5ModelMessageContent(oneCMV5.content) ===
      CacheKeyGenerator.fromAIV5ModelMessageContent(twoCMV5.content)
    );
  }

  // default to it did change. we'll likely never reach this codepath
  return true;
}

/**
 * The parts in a whitespace-insensitive form for matching stored copies: `updateWorkingMemory`
 * tool steps removed, and `<working_memory>` tags and surrounding whitespace stripped from text.
 */
function projectPartsForPersistence(parts: MastraMessagePart[]): MastraMessagePart[] {
  return removeWorkingMemoryToolInvocationParts(parts).map(part =>
    part.type === 'text'
      ? {
          ...clearTokenEstimates(part),
          text: removeWorkingMemoryTags(typeof part.text === 'string' ? part.text : '').trim(),
        }
      : part,
  );
}

/**
 * Whether `stored` is the persisted copy of `live`: the same id, and the same parts once
 * both have working-memory tags and tool steps removed and text trimmed. Memory now trims
 * only text it removed tags from, but rows saved before that trimmed all text, so matching
 * ignores surrounding whitespace to recognize both verbatim and trimmed stored copies.
 *
 * Saves through `MessageHistory` (observational memory's buffering) and the agent's save
 * queue first run `filterMessagesForPersistence`, which also drops streaming `partial-call`
 * tool parts, so the live message is matched with and without that filter.
 */
export function isPersistedCopy(live: MastraDBMessage, stored: MastraDBMessage): boolean {
  if (live.id !== stored.id) return false;
  const storedKey = CacheKeyGenerator.fromDBParts(projectPartsForPersistence(stored.content.parts));
  const [filteredLive] = filterMessagesForPersistence([live]);
  return [live, filteredLive].some(
    candidate =>
      candidate !== undefined &&
      CacheKeyGenerator.fromDBParts(projectPartsForPersistence(candidate.content.parts)) === storedKey,
  );
}
