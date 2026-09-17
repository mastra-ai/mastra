export function getToolTitle(tool: unknown): string | undefined {
  return (tool as { title?: string } | undefined)?.title || undefined;
}

export function withToolTitle<T extends { type: string; payload?: any }>(chunk: T, tool: unknown): T {
  const titledChunk = chunk.type === 'tool-call' || chunk.type === 'tool-call-input-streaming-start';
  if (!titledChunk || chunk.payload?.title !== undefined) {
    return chunk;
  }
  const title = getToolTitle(tool);
  if (!title) {
    return chunk;
  }
  return { ...chunk, payload: { ...chunk.payload, title } };
}
