import { type NetworkChunkType } from '@mastra/core/stream';
import { type MastraUIMessage, type MastraUIMessageMetadata } from '../types';

export interface TransformerArgs<T> {
  chunk: NetworkChunkType;
  conversation: MastraUIMessage[];
  metadata: MastraUIMessageMetadata;
}

export interface Transformer<T> {
  transform: (args: TransformerArgs<T>) => MastraUIMessage[];
}
