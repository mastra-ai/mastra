/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Cardinality } from "../ifaces";
import type { ICodec, uuid, CodecKind, IArgsCodec } from "./ifaces";
import { Codec } from "./ifaces";
import { ReadBuffer, WriteBuffer } from "../primitives/buffer";
import type { CodecContext } from "./context";
export interface ObjectFieldInfo {
    name: string;
    implicit: boolean;
    linkprop: boolean;
    cardinality: Cardinality;
}
export declare class ObjectCodec extends Codec implements ICodec, IArgsCodec {
    private codecs;
    private fields;
    private namesSet;
    private cardinalities;
    constructor(tid: uuid, codecs: ICodec[], names: string[], flags: number[], cards: number[]);
    encode(_buf: WriteBuffer, _object: any): void;
    encodeArgs(args: any, ctx: CodecContext): Uint8Array;
    _encodePositionalArgs(args: any, ctx: CodecContext): Uint8Array;
    _encodeNamedArgs(args: any, ctx: CodecContext): Uint8Array;
    decode(buf: ReadBuffer, ctx: CodecContext): any;
    getSubcodecs(): ICodec[];
    getFields(): ObjectFieldInfo[];
    getKind(): CodecKind;
}
