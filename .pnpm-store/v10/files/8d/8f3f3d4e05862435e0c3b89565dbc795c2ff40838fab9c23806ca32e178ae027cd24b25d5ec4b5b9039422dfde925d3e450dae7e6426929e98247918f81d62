// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { ReadableInterop, ArrowJSONLike } from '../io/interfaces.js';

import type { ByteBuffer } from 'flatbuffers';
import type { ReadStream } from 'node:fs';
import type { FileHandle as FileHandle_ } from 'node:fs/promises';

/** @ignore */
type FSReadStream = ReadStream;
/** @ignore */
type FileHandle = FileHandle_;

/** @ignore */
export interface Subscription {
    unsubscribe: () => void;
}

/** @ignore */
export interface Observer<T> {
    closed?: boolean;
    next: (value: T) => void;
    error: (err: any) => void;
    complete: () => void;
}

/** @ignore */
export interface Observable<T> {
    subscribe: (observer: Observer<T>) => Subscription;
}

/** @ignore */ const isNumber = (x: any) => typeof x === 'number';
/** @ignore */ const isBoolean = (x: any) => typeof x === 'boolean';
/** @ignore */ const isFunction = (x: any) => typeof x === 'function';
/** @ignore */
// eslint-disable-next-line @typescript-eslint/ban-types
export const isObject = (x: any): x is Object => x != null && Object(x) === x;

/** @ignore */
export const isPromise = <T = any>(x: any): x is PromiseLike<T> => {
    return isObject(x) && isFunction(x.then);
};

/** @ignore */
export const isObservable = <T = any>(x: any): x is Observable<T> => {
    return isObject(x) && isFunction(x.subscribe);
};

/** @ignore */
export const isIterable = <T = any>(x: any): x is Iterable<T> => {
    return isObject(x) && isFunction(x[Symbol.iterator]);
};

/** @ignore */
export const isAsyncIterable = <T = any>(x: any): x is AsyncIterable<T> => {
    return isObject(x) && isFunction(x[Symbol.asyncIterator]);
};

/** @ignore */
export const isArrowJSON = (x: any): x is ArrowJSONLike => {
    return isObject(x) && isObject(x['schema']);
};

/** @ignore */
export const isArrayLike = <T = any>(x: any): x is ArrayLike<T> => {
    return isObject(x) && isNumber(x['length']);
};

/** @ignore */
export const isIteratorResult = <T = any>(x: any): x is IteratorResult<T> => {
    return isObject(x) && ('done' in x) && ('value' in x);
};

/** @ignore */
export const isUnderlyingSink = <T = any>(x: any): x is UnderlyingSink<T> => {
    return isObject(x) &&
        isFunction(x['abort']) &&
        isFunction(x['close']) &&
        isFunction(x['start']) &&
        isFunction(x['write']);
};

/** @ignore */
export const isFileHandle = (x: any): x is FileHandle => {
    return isObject(x) && isFunction(x['stat']) && isNumber(x['fd']);
};

/** @ignore */
export const isFSReadStream = (x: any): x is FSReadStream => {
    return isReadableNodeStream(x) && isNumber((<any>x)['bytesRead']);
};

/** @ignore */
export const isFetchResponse = (x: any): x is Response => {
    return isObject(x) && isReadableDOMStream(x['body']);
};

const isReadableInterop = <T = any>(x: any): x is ReadableInterop<T> => ('_getDOMStream' in x && '_getNodeStream' in x);

/** @ignore */
export const isWritableDOMStream = <T = any>(x: any): x is WritableStream<T> => {
    return isObject(x) &&
        isFunction(x['abort']) &&
        isFunction(x['getWriter']) &&
        !isReadableInterop(x);
};

/** @ignore */
export const isReadableDOMStream = <T = any>(x: any): x is ReadableStream<T> => {
    return isObject(x) &&
        isFunction(x['cancel']) &&
        isFunction(x['getReader']) &&
        !isReadableInterop(x);
};

/** @ignore */
export const isWritableNodeStream = (x: any): x is NodeJS.WritableStream => {
    return isObject(x) &&
        isFunction(x['end']) &&
        isFunction(x['write']) &&
        isBoolean(x['writable']) &&
        !isReadableInterop(x);
};

/** @ignore */
export const isReadableNodeStream = (x: any): x is NodeJS.ReadableStream => {
    return isObject(x) &&
        isFunction(x['read']) &&
        isFunction(x['pipe']) &&
        isBoolean(x['readable']) &&
        !isReadableInterop(x);
};

/** @ignore */
export const isFlatbuffersByteBuffer = (x: any): x is ByteBuffer => {
    return isObject(x) &&
        isFunction(x['clear']) &&
        isFunction(x['bytes']) &&
        isFunction(x['position']) &&
        isFunction(x['setPosition']) &&
        isFunction(x['capacity']) &&
        isFunction(x['getBufferIdentifier']) &&
        isFunction(x['createLong']);
};
