import type { ReadableStream } from 'stream/web';
import type { ConsumeStreamOptions } from '../aisdk/v5/compat';

export interface MastraBaseStream<T> {
  get fullStream(): ReadableStream<T>;
  consumeStream(options?: ConsumeStreamOptions): Promise<void>;
}
