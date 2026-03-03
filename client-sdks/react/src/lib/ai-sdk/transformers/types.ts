import type {NetworkChunkType} from '@mastra/core/stream';
import type {MastraUIMessage, MastraUIMessageMetadata} from '../types';

export interface TransformerArgs<_T> {
  chunk: NetworkChunkType;
  conversation: MastraUIMessage[];
  metadata: MastraUIMessageMetadata;
}

export interface Transformer<T> {
  transform: (args: TransformerArgs<T>) => MastraUIMessage[];
}
