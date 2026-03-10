export type StreamChunkWriter = {
  write: (chunk: unknown) => Promise<void>;
};

export async function forwardAgentStreamChunk({
  writer,
  chunk,
}: {
  writer?: StreamChunkWriter;
  chunk: unknown;
}): Promise<void> {
  if (!writer) {
    return;
  }

  await writer.write(chunk);
}
