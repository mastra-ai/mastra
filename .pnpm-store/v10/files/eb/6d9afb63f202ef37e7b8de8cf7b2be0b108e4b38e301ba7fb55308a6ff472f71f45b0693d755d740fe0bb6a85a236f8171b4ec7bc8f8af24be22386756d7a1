"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigMemory = void 0;
const KiB = 1024;
const MiB = 1024 * KiB;
const GiB = 1024 * MiB;
const TiB = 1024 * GiB;
const PiB = 1024 * TiB;
class ConfigMemory {
    _bytes;
    constructor(bytes) {
        this._bytes = bytes;
    }
    get bytes() {
        return Number(this._bytes);
    }
    get bytesBigInt() {
        return this._bytes;
    }
    get kibibytes() {
        return Number(this._bytes) / KiB;
    }
    get mebibytes() {
        return Number(this._bytes) / MiB;
    }
    get gibibytes() {
        return Number(this._bytes) / GiB;
    }
    get tebibytes() {
        return Number(this._bytes) / TiB;
    }
    get pebibytes() {
        return Number(this._bytes) / PiB;
    }
    toString() {
        const bytes = this._bytes;
        const bigPiB = BigInt(PiB);
        if (bytes >= bigPiB && Number(bytes % bigPiB) === 0) {
            return `${bytes / bigPiB}PiB`;
        }
        const bigTiB = BigInt(TiB);
        if (bytes >= bigTiB && Number(bytes % bigTiB) === 0) {
            return `${bytes / bigTiB}TiB`;
        }
        const bigGiB = BigInt(GiB);
        if (bytes >= bigGiB && Number(bytes % bigGiB) === 0) {
            return `${bytes / bigGiB}GiB`;
        }
        const bigMiB = BigInt(MiB);
        if (bytes >= bigMiB && Number(bytes % bigMiB) === 0) {
            return `${bytes / bigMiB}MiB`;
        }
        const bigKiB = BigInt(KiB);
        if (bytes >= bigKiB && Number(bytes % bigKiB) === 0) {
            return `${bytes / bigKiB}KiB`;
        }
        return `${bytes}B`;
    }
}
exports.ConfigMemory = ConfigMemory;
