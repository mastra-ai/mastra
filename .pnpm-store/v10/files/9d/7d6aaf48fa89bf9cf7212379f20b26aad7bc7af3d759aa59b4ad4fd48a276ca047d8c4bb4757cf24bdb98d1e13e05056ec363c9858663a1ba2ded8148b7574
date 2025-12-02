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
import type { CryptoUtils } from "./utils";
export declare function saslprep(str: string): string;
export declare function getSCRAM({ randomBytes, H, HMAC, makeKey }: CryptoUtils): {
    bufferEquals: (a: Uint8Array, b: Uint8Array) => boolean;
    generateNonce: (length?: number) => Uint8Array;
    buildClientFirstMessage: (clientNonce: Uint8Array, username: string) => [string, string];
    parseServerFirstMessage: (msg: string) => [Uint8Array, Uint8Array, number];
    parseServerFinalMessage: (msg: string) => Uint8Array;
    buildClientFinalMessage: (password: string, salt: Uint8Array, iterations: number, clientFirstBare: string, serverFirst: string, serverNonce: Uint8Array) => Promise<[string, Uint8Array]>;
    _getSaltedPassword: (password: Uint8Array, salt: Uint8Array, iterations: number) => Promise<Uint8Array>;
    _getClientKey: (saltedPassword: Uint8Array) => Promise<Uint8Array>;
    _getServerKey: (saltedPassword: Uint8Array) => Promise<Uint8Array>;
    _XOR: (a: Uint8Array, b: Uint8Array) => Uint8Array;
};
