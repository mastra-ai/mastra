import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import type { Processor } from '../index';
import { REPROCESS_PART_KEY } from '../stream-reprocess';

export type BatchPartsCheckEvery = 'chunk' | 'sentence' | 'section';
export type BatchPartsLookback = 'none' | 'short' | 'medium' | 'long';

export const BATCH_PARTS_GUARDRAIL_CONTEXT_KEY = Symbol.for('@mastra/core.batchPartsGuardrailContext');

type ChunkWithGuardrailContext = ChunkType & {
  [BATCH_PARTS_GUARDRAIL_CONTEXT_KEY]?: string;
};

export type BatchPartsState = {
  batch: ChunkType[];
  timeoutId: NodeJS.Timeout | undefined;
  timeoutTriggered: boolean;
  pendingNonText?: ChunkType;
  lookbackText?: string;
};

export interface BatchPartsOptions {
  /**
   * Number of parts to batch together before emitting
   * @default 5
   */
  batchSize?: number;

  /**
   * Maximum time to wait before emitting a batch (in milliseconds)
   * If set, will emit the current batch even if it hasn't reached batchSize
   * @default undefined (no timeout)
   */
  maxWaitTime?: number;

  /**
   * Whether to emit immediately when a non-text part is encountered
   * @default true
   */
  emitOnNonText?: boolean;

  /**
   * Semantic boundary used for text windowing. When omitted, the processor
   * preserves legacy batchSize/maxWaitTime behavior.
   */
  checkEvery?: BatchPartsCheckEvery;

  /**
   * Amount of previously emitted text attached as guardrail-only context.
   * This context is not included in the visible stream text.
   */
  lookback?: BatchPartsLookback;

  /**
   * Safety fallback so semantic modes never buffer indefinitely.
   * @internal
   */
  maxSegmentChars?: number;
}

const LOOKBACK_CHARS: Record<BatchPartsLookback, number> = {
  none: 0,
  short: 500,
  medium: 2_000,
  long: 8_000,
};

const DEFAULT_MAX_SEGMENT_CHARS: Record<BatchPartsCheckEvery, number> = {
  chunk: 0,
  sentence: 1_000,
  section: 4_000,
};

/**
 * Processor that batches multiple stream parts together to reduce stream overhead.
 * Only implements processOutputStream - does not process final results.
 */
export class BatchPartsProcessor implements Processor<'batch-parts'> {
  public readonly id = 'batch-parts';
  public readonly name = 'Batch Parts';

  constructor(private options: BatchPartsOptions = {}) {
    this.options = {
      batchSize: 5,
      emitOnNonText: true,
      ...options,
    };
  }

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
    writer?: { custom: (data: ChunkType) => Promise<void> };
  }): Promise<ChunkType | null> {
    const { part, state, writer } = args;

    this.initializeState(state);

    // Emit any pending non-text part that was deferred from the previous call
    if (state.pendingNonText) {
      const pending = state.pendingNonText;
      state.pendingNonText = undefined;
      // Buffer the current part for later emission
      state.batch.push(part);
      return pending;
    }

    // Check if a timeout has triggered a flush
    if (state.timeoutTriggered && state.batch.length > 0) {
      state.timeoutTriggered = false;
      // Add the current part to the batch before flushing
      state.batch.push(part);
      return this.flushBatch(state as BatchPartsState);
    }

    // If it's a non-text part and we should emit immediately, flush the batch first
    if (this.options.emitOnNonText && part.type !== 'text-delta') {
      const batchedChunk = this.flushBatch(state as BatchPartsState);
      if (batchedChunk) {
        // We have two parts to emit (the batched text and this non-text part)
        // but can only return one. When running inside the processor chain,
        // return the batched text (so it flows through any downstream
        // processors) and stash the non-text part for the runner to re-drive
        // through the whole chain right after. This avoids deferring the
        // non-text part to the next processOutputStream call — which never
        // happens when the stream stops on this part (e.g. a `stopWhen`
        // condition halting the agentic loop on a tool result), dropping the
        // part from the stream entirely.
        if (writer) {
          state[REPROCESS_PART_KEY] = part;
          return batchedChunk;
        }
        // No writer (e.g. direct unit invocation): fall back to deferring the
        // non-text part to the next call.
        state.pendingNonText = part;
        return batchedChunk;
      }
      return part;
    }

    // Add the part to the current batch
    state.batch.push(part);

    if (this.options.checkEvery) {
      const semanticFlushEndIndex = this.semanticFlushEndIndex(state as BatchPartsState);
      if (semanticFlushEndIndex !== null) {
        return this.flushBatch(state as BatchPartsState, semanticFlushEndIndex);
      }
    } else if (state.batch.length >= this.options.batchSize!) {
      // Legacy behavior: emit based on batch size.
      return this.flushBatch(state as BatchPartsState);
    }

    // Set up timeout for max wait time if specified
    if (this.options.maxWaitTime && !state.timeoutId) {
      state.timeoutId = setTimeout(() => {
        // Mark that a timeout has triggered
        state.timeoutTriggered = true;
        state.timeoutId = undefined;
      }, this.options.maxWaitTime);
    }

    // Don't emit this part yet - it's batched
    return null;
  }

  private initializeState(state: Record<string, any>): void {
    if (!state.batch) {
      state.batch = [];
    }
    if (!state.timeoutTriggered) {
      state.timeoutTriggered = false;
    }
    if (state.lookbackText === undefined) {
      state.lookbackText = '';
    }
  }

  private semanticFlushEndIndex(state: BatchPartsState): number | null {
    const checkEvery = this.options.checkEvery;
    if (!checkEvery) return null;

    const text = this.batchText(state);
    if (!text) return null;
    if (checkEvery === 'chunk') return text.length;

    const maxSegmentChars = this.options.maxSegmentChars ?? DEFAULT_MAX_SEGMENT_CHARS[checkEvery];
    if (maxSegmentChars > 0 && text.length >= maxSegmentChars) return maxSegmentChars;

    if (checkEvery === 'sentence') {
      return findSentenceBoundaryIndex(text);
    }

    return findSectionBoundaryIndex(text);
  }

  private flushBatch(state: BatchPartsState, textEndIndex?: number): ChunkType | null {
    if (state.batch.length === 0) {
      return null;
    }

    // Clear any existing timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = undefined;
    }

    // Combine text chunks into a single text part. In semantic mode, this may
    // emit only the completed window and keep the unfinished remainder buffered.
    const textChunks = state.batch.filter((part: ChunkType) => part.type === 'text-delta') as ChunkType[];

    if (textChunks.length > 0) {
      const combinedText = textChunks.map(part => (part.type === 'text-delta' ? part.payload.text : '')).join('');
      const emitEndIndex = textEndIndex ?? combinedText.length;
      const emittedText = combinedText.slice(0, emitEndIndex);
      const remainderText = combinedText.slice(emitEndIndex);

      const firstChunk = textChunks[0] as ChunkType & { type: 'text-delta' };
      const combinedChunk: ChunkType = {
        type: 'text-delta',
        payload: { text: emittedText, id: firstChunk.payload.id },
        runId: firstChunk.runId,
        from: ChunkFrom.AGENT,
      };

      state.batch = remainderText
        ? [
            {
              type: 'text-delta',
              payload: { text: remainderText, id: firstChunk.payload.id },
              runId: firstChunk.runId,
              from: ChunkFrom.AGENT,
            },
          ]
        : [];

      return this.withGuardrailContext(combinedChunk, state);
    } else {
      // If no text chunks, return the first non-text part
      const part = state.batch[0];
      state.batch = state.batch.slice(1);
      return part || null;
    }
  }

  private batchText(state: BatchPartsState): string {
    return state.batch.map(part => (part.type === 'text-delta' ? part.payload.text : '')).join('');
  }

  private withGuardrailContext(part: ChunkType, state: BatchPartsState): ChunkType {
    if (!this.options.checkEvery || part.type !== 'text-delta') {
      return part;
    }

    const currentText = part.payload.text;
    const lookbackChars = LOOKBACK_CHARS[this.options.lookback ?? 'none'];
    const lookbackText = lookbackChars > 0 ? (state.lookbackText ?? '').slice(-lookbackChars) : '';
    const guardrailContext = `${lookbackText}${currentText}`;
    state.lookbackText = `${state.lookbackText ?? ''}${currentText}`.slice(-LOOKBACK_CHARS.long);

    if (!guardrailContext || guardrailContext === currentText) {
      return part;
    }

    const partWithContext: ChunkWithGuardrailContext = { ...part };
    Object.defineProperty(partWithContext, BATCH_PARTS_GUARDRAIL_CONTEXT_KEY, {
      configurable: true,
      value: guardrailContext,
    });
    return partWithContext;
  }

  /**
   * Force flush any remaining batched parts
   * This should be called when the stream ends to ensure no parts are lost
   */
  flush(state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false }): ChunkType | null {
    this.initializeState(state as Record<string, any>);
    return this.flushBatch(state);
  }
}

function findSentenceBoundaryIndex(text: string): number | null {
  const lastNewlineIndex = text.lastIndexOf('\n');
  if (lastNewlineIndex >= 0 && text.slice(lastNewlineIndex + 1).trim().length === 0 && text.trim().length > 0) {
    return text.length;
  }

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char !== '.' && char !== '!' && char !== '?') continue;

    const previous = text[index - 1];
    const next = text[index + 1];
    if (char === '.' && isDigit(previous) && isDigit(next)) continue;
    if (char === '.' && isCommonAbbreviation(text, index)) continue;
    if (next === undefined || /\s/u.test(next)) return index + 1;
  }

  return null;
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && /\d/u.test(value);
}

function isCommonAbbreviation(text: string, punctuationIndex: number): boolean {
  const before = text.slice(Math.max(0, punctuationIndex - 8), punctuationIndex + 1).toLowerCase();
  return /(?:\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|e\.g|i\.e)\.)$/u.test(before);
}

function findSectionBoundaryIndex(text: string): number | null {
  const jsonEndIndex = findCompleteJsonStructureEndIndex(text);
  if (jsonEndIndex !== null) return jsonEndIndex;

  const nextHeadingMatch = /\n#{1,6}\s+\S/u.exec(text);
  if (nextHeadingMatch?.index && nextHeadingMatch.index > 0) return nextHeadingMatch.index;

  const fenceEndIndex = findClosedFenceEndIndex(text);
  if (fenceEndIndex !== null) return fenceEndIndex;

  if (hasListBlockBoundary(text)) return text.length;
  if (hasBlankLine(text)) return text.length;

  return null;
}

function hasListBlockBoundary(text: string): boolean {
  let foundListItem = false;
  const lines = text.split('\n');

  for (let index = 0; index < lines.length - 1; index++) {
    const line = lines[index]!;
    if (isListItemLine(line)) {
      foundListItem = true;
    } else if (foundListItem && index > 0 && line.trim().length === 0) {
      return true;
    }
  }

  return false;
}

function isListItemLine(line: string): boolean {
  const content = line.trimStart();
  const first = content[0];
  if ((first === '-' || first === '*' || first === '+') && /\s/u.test(content[1] ?? '')) {
    return content.slice(2).trim().length > 0;
  }

  let index = 0;
  while (isDigit(content[index])) index++;
  return (
    index > 0 &&
    content[index] === '.' &&
    /\s/u.test(content[index + 1] ?? '') &&
    content.slice(index + 2).trim().length > 0
  );
}

function hasBlankLine(text: string): boolean {
  const lines = text.split('\n');
  for (let index = 1; index < lines.length - 1; index++) {
    if (lines[index]!.trim().length === 0) return true;
  }
  return false;
}

function findClosedFenceEndIndex(text: string): number | null {
  const fenceMatches = [...text.matchAll(/^```.*$/gmu)];
  if (fenceMatches.length < 2) return null;

  const closingFence = fenceMatches[1];
  if (!closingFence || closingFence.index === undefined) return null;
  return closingFence.index + closingFence[0].length;
}

function findCompleteJsonStructureEndIndex(text: string): number | null {
  const leadingWhitespaceLength = text.match(/^\s*/u)?.[0].length ?? 0;
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '[';
      if (stack.pop() !== expected) return null;
      if (stack.length === 0) {
        return leadingWhitespaceLength + index + 1;
      }
    }
  }

  return null;
}
