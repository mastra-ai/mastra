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

import { DataType } from '../../type.js';
import { Vector } from '../../vector.js';
import { Builder, BuilderOptions } from '../../builder.js';
import { makeBuilder } from '../../factories.js';

/** @ignore */
export interface BuilderTransformOptions<T extends DataType = any, TNull = any> extends BuilderOptions<T, TNull> {
    queueingStrategy?: 'bytes' | 'count';
    dictionaryHashFunction?: (value: any) => string | number;
    readableStrategy?: { highWaterMark?: number; size?: any; type?: 'bytes' };
    writableStrategy?: { highWaterMark?: number; size?: any; type?: 'bytes' };
    valueToChildTypeId?: (builder: Builder<T, TNull>, value: any, offset: number) => number;
}

/** @ignore */
export function builderThroughDOMStream<T extends DataType = any, TNull = any>(options: BuilderTransformOptions<T, TNull>) {
    return new BuilderTransform(options);
}

/** @ignore */
export class BuilderTransform<T extends DataType = any, TNull = any> {

    public readable: ReadableStream<Vector<T>>;
    public writable: WritableStream<T['TValue'] | TNull>;
    public _controller: ReadableStreamDefaultController<Vector<T>> | null;

    private _numChunks = 0;
    private _finished = false;
    private _bufferedSize = 0;
    private _builder: Builder<T, TNull>;
    private _getSize: (builder: Builder<T, TNull>) => number;

    constructor(options: BuilderTransformOptions<T, TNull>) {

        // Access properties by string indexers to defeat closure compiler

        const {
            ['readableStrategy']: readableStrategy,
            ['writableStrategy']: writableStrategy,
            ['queueingStrategy']: queueingStrategy = 'count',
            ...builderOptions
        } = options;

        this._controller = null;
        this._builder = makeBuilder<T, TNull>(builderOptions);
        this._getSize = queueingStrategy !== 'bytes' ? chunkLength : chunkByteLength;

        const { ['highWaterMark']: readableHighWaterMark = queueingStrategy === 'bytes' ? 2 ** 14 : 1000 } = { ...readableStrategy };
        const { ['highWaterMark']: writableHighWaterMark = queueingStrategy === 'bytes' ? 2 ** 14 : 1000 } = { ...writableStrategy };

        this['readable'] = new ReadableStream<Vector<T>>({
            ['cancel']: () => { this._builder.clear(); },
            ['pull']: (c) => { this._maybeFlush(this._builder, this._controller = c); },
            ['start']: (c) => { this._maybeFlush(this._builder, this._controller = c); },
        }, {
            'highWaterMark': readableHighWaterMark,
            'size': queueingStrategy !== 'bytes' ? chunkLength : chunkByteLength,
        });

        this['writable'] = new WritableStream({
            ['abort']: () => { this._builder.clear(); },
            ['write']: () => { this._maybeFlush(this._builder, this._controller); },
            ['close']: () => { this._maybeFlush(this._builder.finish(), this._controller); },
        }, {
            'highWaterMark': writableHighWaterMark,
            'size': (value: T['TValue'] | TNull) => this._writeValueAndReturnChunkSize(value),
        });
    }

    private _writeValueAndReturnChunkSize(value: T['TValue'] | TNull) {
        const bufferedSize = this._bufferedSize;
        this._bufferedSize = this._getSize(this._builder.append(value));
        return this._bufferedSize - bufferedSize;
    }

    private _maybeFlush(builder: Builder<T, TNull>, controller: ReadableStreamDefaultController<Vector<T>> | null) {
        if (controller == null) { return; }
        if (this._bufferedSize >= controller.desiredSize!) {
            ++this._numChunks && this._enqueue(controller, builder.toVector());
        }
        if (builder.finished) {
            if (builder.length > 0 || this._numChunks === 0) {
                ++this._numChunks && this._enqueue(controller, builder.toVector());
            }
            if (!this._finished && (this._finished = true)) {
                this._enqueue(controller, null);
            }
        }
    }

    private _enqueue(controller: ReadableStreamDefaultController<Vector<T>>, chunk: Vector<T> | null) {
        this._bufferedSize = 0;
        this._controller = null;
        chunk == null ? controller.close() : controller.enqueue(chunk);
    }
}

/** @ignore */ const chunkLength = <T extends DataType = any>(chunk?: Vector<T> | Builder<T>) => chunk?.length ?? 0;
/** @ignore */ const chunkByteLength = <T extends DataType = any>(chunk?: Vector<T> | Builder<T>) => chunk?.byteLength ?? 0;
