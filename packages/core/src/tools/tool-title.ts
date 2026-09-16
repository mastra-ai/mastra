export function getToolTitle(tool: unknown): string | undefined {
  return (tool as { title?: string } | undefined)?.title;
}

const TITLED_CHUNK_TYPES = new Set(['tool-call', 'tool-call-input-streaming-start']);

export function withToolTitle<T extends { type: string; payload?: any }>(chunk: T, tool: unknown): T {
  if (!TITLED_CHUNK_TYPES.has(chunk.type) || chunk.payload?.title !== undefined) {
    return chunk;
  }
  const title = getToolTitle(tool);
  if (!title) {
    return chunk;
  }
  return { ...chunk, payload: { ...chunk.payload, title } };
}
