import { NetworkChunkType } from '@mastra/core/stream';
import { MastraUIMessage, MastraUIMessageMetadata } from '../types';

export interface TransformerArgs<T> {
  chunk: NetworkChunkType;
  conversation: MastraUIMessage[];
  metadata: MastraUIMessageMetadata;
}

export interface Transformer<T> {
  transform: (args: TransformerArgs<T>) => MastraUIMessage[];
}
