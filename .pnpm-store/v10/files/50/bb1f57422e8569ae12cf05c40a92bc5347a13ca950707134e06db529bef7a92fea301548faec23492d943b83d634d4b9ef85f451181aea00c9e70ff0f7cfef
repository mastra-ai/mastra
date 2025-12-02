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
import { type ReadBuffer, type WriteBuffer } from "../primitives/buffer";
import type { CodecContext } from "./context";
export type uuid = string;
export type CodecKind = "array" | "tuple" | "namedtuple" | "object" | "set" | "scalar" | "sparse_object" | "range" | "multirange" | "record";
export interface ICodec {
    readonly tid: uuid;
    readonly tidBuffer: Uint8Array;
    encode(buf: WriteBuffer, object: any, ctx: CodecContext): void;
    decode(buf: ReadBuffer, ctx: CodecContext): any;
    getSubcodecs(): ICodec[];
    getKind(): CodecKind;
    getKnownTypeName(): string;
}
export interface IArgsCodec {
    encodeArgs(args: any, ctx: CodecContext): Uint8Array;
}
export declare abstract class Codec {
    readonly tid: uuid;
    readonly tidBuffer: Uint8Array;
    constructor(tid: uuid);
    getKnownTypeName(): string;
}
export declare abstract class ScalarCodec extends Codec {
    readonly typeName: string;
    readonly ancestors: ScalarCodec[] | null;
    constructor(tid: uuid, typeName: string);
    derive(tid: uuid, typeName: string, ancestors: ScalarCodec[]): Codec;
    getSubcodecs(): ICodec[];
    getKind(): CodecKind;
    readonly tsType: string;
    readonly tsModule: string | null;
    getKnownTypeName(): string;
}
