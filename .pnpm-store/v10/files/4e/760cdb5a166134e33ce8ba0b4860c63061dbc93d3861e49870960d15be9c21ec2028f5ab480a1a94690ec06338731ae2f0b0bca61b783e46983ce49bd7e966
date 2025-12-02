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

import { Duplex } from 'node:stream';
import { DataType } from '../../type.js';
import { Builder, BuilderOptions } from '../../builder.js';
import { makeBuilder } from '../../factories.js';

/** @ignore */
export interface BuilderDuplexOptions<T extends DataType = any, TNull = any> extends BuilderOptions<T, TNull> {
    autoDestroy?: boolean;
    highWaterMark?: number;
    queueingStrategy?: 'bytes' | 'count';
    dictionaryHashFunction?: (value: any) => string | number;
    valueToChildTypeId?: (builder: Builder<T, TNull>, value: any, offset: number) => number;
}

/** @ignore */
export function builderThroughNodeStream<T extends DataType = any, TNull = any>(options: BuilderDuplexOptions<T, TNull>) {
    return new BuilderDuplex(makeBuilder(options), options);
}

/** @ignore */
type CB = (error?: Error | null | undefined) => void;

/** @ignore */
class BuilderDuplex<T extends DataType = any, TNull = any> extends Duplex {

    private _finished: boolean;
    private _numChunks: number;
    private _desiredSize: number;
    private _builder: Builder<T, TNull>;
    private _getSize: (builder: Builder<T, TNull>) => number;

    constructor(builder: Builder<T, TNull>, options: BuilderDuplexOptions<T, TNull>) {

        const { queueingStrategy = 'count', autoDestroy = true } = options;
        const { highWaterMark = queueingStrategy !== 'bytes' ? 1000 : 2 ** 14 } = options;

        super({ autoDestroy, highWaterMark: 1, allowHalfOpen: true, writableObjectMode: true, readableObjectMode: true });

        this._numChunks = 0;
        this._finished = false;
        this._builder = builder;
        this._desiredSize = highWaterMark;
        this._getSize = queueingStrategy !== 'bytes' ? builderLength : builderByteLength;
    }
    _read(size: number) {
        this._maybeFlush(this._builder, this._desiredSize = size);
    }
    _final(cb?: CB) {
        this._maybeFlush(this._builder.finish(), this._desiredSize);
        cb && cb();
    }
    _write(value: any, _: string, cb?: CB) {
        const result = this._maybeFlush(
            this._builder.append(value),
            this._desiredSize
        );
        cb && cb();
        return result;
    }
    _destroy(err: Error | null, cb?: (error: Error | null) => void) {
        this._builder.clear();
        cb && cb(err);
    }
    private _maybeFlush(builder: Builder<T, TNull>, size: number) {
        if (this._getSize(builder) >= size) {
            ++this._numChunks && this.push(builder.toVector());
        }
        if (builder.finished) {
            if (builder.length > 0 || this._numChunks === 0) {
                ++this._numChunks && this.push(builder.toVector());
            }
            if (!this._finished && (this._finished = true)) {
                this.push(null);
            }
            return false;
        }
        return this._getSize(builder) < this.writableHighWaterMark;
    }
}

/** @ignore */ const builderLength = <T extends DataType = any>(builder: Builder<T>) => builder.length;
/** @ignore */ const builderByteLength = <T extends DataType = any>(builder: Builder<T>) => builder.byteLength;
