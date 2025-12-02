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
import { type ICodec, ScalarCodec } from "./ifaces";
import type { CodecContext } from "./context";
export declare class JSONCodec extends ScalarCodec implements ICodec {
    tsType: string;
    readonly jsonFormat: number | null;
    encode(buf: WriteBuffer, object: any, ctx: CodecContext): void;
    decode(buf: ReadBuffer, ctx: CodecContext): any;
}
export declare class PgTextJSONCodec extends JSONCodec {
    readonly jsonFormat: null;
}
export declare class PgTextJSONStringCodec extends ScalarCodec implements ICodec {
    encode(buf: WriteBuffer, object: any, ctx: CodecContext): void;
    decode(buf: ReadBuffer, ctx: CodecContext): any;
}
