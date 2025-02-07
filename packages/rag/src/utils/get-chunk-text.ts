import { Document as Chunk } from 'llamaindex';

export function getChunkText(input: Chunk | string): string {
  return input instanceof Chunk ? input.getText() : input;
}
