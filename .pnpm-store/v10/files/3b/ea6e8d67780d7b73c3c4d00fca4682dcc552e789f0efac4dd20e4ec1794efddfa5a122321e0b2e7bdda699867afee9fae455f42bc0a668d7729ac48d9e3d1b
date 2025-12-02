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
import type { ICodec, uuid, CodecKind } from "./ifaces";
import { Codec } from "./ifaces";
import type { Codecs } from "./codecs";
import type { WriteBuffer } from "../primitives/buffer";
import { ReadBuffer } from "../primitives/buffer";
import type { CodecContext } from "./context";
export declare const SQLRowModeArray: {
    _private_sql_row: Codecs.SQLRowCodec;
};
export declare const SQLRowModeObject: {
    _private_sql_row: Codecs.SQLRowCodec;
};
export declare class RecordCodec extends Codec implements ICodec {
    private subCodecs;
    private names;
    constructor(tid: uuid, codecs: ICodec[], names: string[]);
    encode(_buf: WriteBuffer, _object: any): void;
    decode(buf: ReadBuffer, ctx: CodecContext): any;
    getSubcodecs(): ICodec[];
    getNames(): string[];
    getKind(): CodecKind;
}
