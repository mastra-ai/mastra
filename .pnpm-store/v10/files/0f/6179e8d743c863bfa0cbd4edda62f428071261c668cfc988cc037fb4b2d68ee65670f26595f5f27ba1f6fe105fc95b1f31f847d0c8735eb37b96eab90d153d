/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { ArrayBufferViewInput } from '../util/buffer.js';
import { ReadableDOMStreamOptions } from './interfaces.js';
import type { ReadableOptions, Readable } from 'node:stream';
type Uint8ArrayGenerator = Generator<Uint8Array, null, {
    cmd: 'peek' | 'read';
    size: number;
}>;
type AsyncUint8ArrayGenerator = AsyncGenerator<Uint8Array, null, {
    cmd: 'peek' | 'read';
    size: number;
}>;
/** @ignore */
declare const _default: {
    fromIterable<T extends ArrayBufferViewInput>(source: Iterable<T> | T): Uint8ArrayGenerator;
    fromAsyncIterable<T_1 extends ArrayBufferViewInput>(source: AsyncIterable<T_1> | PromiseLike<T_1>): AsyncUint8ArrayGenerator;
    fromDOMStream<T_2 extends ArrayBufferViewInput>(source: ReadableStream<T_2>): AsyncUint8ArrayGenerator;
    fromNodeStream(stream: NodeJS.ReadableStream): AsyncUint8ArrayGenerator;
    toDOMStream<T_3>(source: Iterable<T_3> | AsyncIterable<T_3>, options?: ReadableDOMStreamOptions): ReadableStream<T_3>;
    toNodeStream<T_4>(source: Iterable<T_4> | AsyncIterable<T_4>, options?: ReadableOptions): Readable;
};
export default _default;
