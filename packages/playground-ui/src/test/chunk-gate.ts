/**
 * Holds progressive-search chunks until the test lets them through, so a test steps through a chained search one
 * response at a time instead of racing a clock. Chunk 0 (no continuation) always passes.
 */
export function chunkGate() {
  const waiting = new Map<number, () => void>();
  let open = 0;
  return {
    /** Call in the handler before answering; resolves once the chunk is let through. */
    pass(continuation: string | undefined) {
      const index = Number(continuation ?? 0);
      if (index <= open) return Promise.resolve();
      return new Promise<void>(resolve => waiting.set(index, resolve));
    },
    /** Lets the next chunk through, whether or not it has been asked for yet. */
    next() {
      open += 1;
      waiting.get(open)?.();
      waiting.delete(open);
    },
  };
}

export type ChunkGate = ReturnType<typeof chunkGate>;
