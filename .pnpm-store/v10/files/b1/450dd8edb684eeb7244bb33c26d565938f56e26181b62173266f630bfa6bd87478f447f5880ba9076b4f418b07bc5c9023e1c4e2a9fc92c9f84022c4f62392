/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
interface Base64 {
    byteToCharMap_: {
        [key: number]: string;
    } | null;
    charToByteMap_: {
        [key: string]: number;
    } | null;
    byteToCharMapWebSafe_: {
        [key: number]: string;
    } | null;
    charToByteMapWebSafe_: {
        [key: string]: number;
    } | null;
    ENCODED_VALS_BASE: string;
    readonly ENCODED_VALS: string;
    readonly ENCODED_VALS_WEBSAFE: string;
    HAS_NATIVE_SUPPORT: boolean;
    encodeByteArray(input: number[] | Uint8Array, webSafe?: boolean): string;
    encodeString(input: string, webSafe?: boolean): string;
    decodeString(input: string, webSafe: boolean): string;
    decodeStringToByteArray(input: string, webSafe: boolean): number[];
    init_(): void;
}
export declare const base64: Base64;
/**
 * An error encountered while decoding base64 string.
 */
export declare class DecodeBase64StringError extends Error {
    readonly name = "DecodeBase64StringError";
}
/**
 * URL-safe base64 encoding
 */
export declare const base64Encode: (str: string) => string;
/**
 * URL-safe base64 encoding (without "." padding in the end).
 * e.g. Used in JSON Web Token (JWT) parts.
 */
export declare const base64urlEncodeWithoutPadding: (str: string) => string;
/**
 * URL-safe base64 decoding
 *
 * NOTE: DO NOT use the global atob() function - it does NOT support the
 * base64Url variant encoding.
 *
 * @param str To be decoded
 * @return Decoded result, if possible
 */
export declare const base64Decode: (str: string) => string | null;
export {};
