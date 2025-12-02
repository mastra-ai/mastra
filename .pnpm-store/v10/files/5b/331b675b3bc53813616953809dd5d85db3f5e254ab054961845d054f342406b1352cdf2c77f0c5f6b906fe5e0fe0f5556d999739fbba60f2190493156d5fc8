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
/** @ignore */ const isNumber = (x) => typeof x === 'number';
/** @ignore */ const isBoolean = (x) => typeof x === 'boolean';
/** @ignore */ const isFunction = (x) => typeof x === 'function';
/** @ignore */
// eslint-disable-next-line @typescript-eslint/ban-types
export const isObject = (x) => x != null && Object(x) === x;
/** @ignore */
export const isPromise = (x) => {
    return isObject(x) && isFunction(x.then);
};
/** @ignore */
export const isObservable = (x) => {
    return isObject(x) && isFunction(x.subscribe);
};
/** @ignore */
export const isIterable = (x) => {
    return isObject(x) && isFunction(x[Symbol.iterator]);
};
/** @ignore */
export const isAsyncIterable = (x) => {
    return isObject(x) && isFunction(x[Symbol.asyncIterator]);
};
/** @ignore */
export const isArrowJSON = (x) => {
    return isObject(x) && isObject(x['schema']);
};
/** @ignore */
export const isArrayLike = (x) => {
    return isObject(x) && isNumber(x['length']);
};
/** @ignore */
export const isIteratorResult = (x) => {
    return isObject(x) && ('done' in x) && ('value' in x);
};
/** @ignore */
export const isUnderlyingSink = (x) => {
    return isObject(x) &&
        isFunction(x['abort']) &&
        isFunction(x['close']) &&
        isFunction(x['start']) &&
        isFunction(x['write']);
};
/** @ignore */
export const isFileHandle = (x) => {
    return isObject(x) && isFunction(x['stat']) && isNumber(x['fd']);
};
/** @ignore */
export const isFSReadStream = (x) => {
    return isReadableNodeStream(x) && isNumber(x['bytesRead']);
};
/** @ignore */
export const isFetchResponse = (x) => {
    return isObject(x) && isReadableDOMStream(x['body']);
};
const isReadableInterop = (x) => ('_getDOMStream' in x && '_getNodeStream' in x);
/** @ignore */
export const isWritableDOMStream = (x) => {
    return isObject(x) &&
        isFunction(x['abort']) &&
        isFunction(x['getWriter']) &&
        !isReadableInterop(x);
};
/** @ignore */
export const isReadableDOMStream = (x) => {
    return isObject(x) &&
        isFunction(x['cancel']) &&
        isFunction(x['getReader']) &&
        !isReadableInterop(x);
};
/** @ignore */
export const isWritableNodeStream = (x) => {
    return isObject(x) &&
        isFunction(x['end']) &&
        isFunction(x['write']) &&
        isBoolean(x['writable']) &&
        !isReadableInterop(x);
};
/** @ignore */
export const isReadableNodeStream = (x) => {
    return isObject(x) &&
        isFunction(x['read']) &&
        isFunction(x['pipe']) &&
        isBoolean(x['readable']) &&
        !isReadableInterop(x);
};
/** @ignore */
export const isFlatbuffersByteBuffer = (x) => {
    return isObject(x) &&
        isFunction(x['clear']) &&
        isFunction(x['bytes']) &&
        isFunction(x['position']) &&
        isFunction(x['setPosition']) &&
        isFunction(x['capacity']) &&
        isFunction(x['getBufferIdentifier']) &&
        isFunction(x['createLong']);
};

//# sourceMappingURL=compat.mjs.map
