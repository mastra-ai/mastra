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
/**
 * @fileoverview SHA-1 cryptographic hash.
 * Variable names follow the notation in FIPS PUB 180-3:
 * http://csrc.nist.gov/publications/fips/fips180-3/fips180-3_final.pdf.
 *
 * Usage:
 *   var sha1 = new sha1();
 *   sha1.update(bytes);
 *   var hash = sha1.digest();
 *
 * Performance:
 *   Chrome 23:   ~400 Mbit/s
 *   Firefox 16:  ~250 Mbit/s
 *
 */
/**
 * SHA-1 cryptographic hash constructor.
 *
 * The properties declared here are discussed in the above algorithm document.
 * @constructor
 * @final
 * @struct
 */
export declare class Sha1 {
    /**
     * Holds the previous values of accumulated variables a-e in the compress_
     * function.
     * @private
     */
    private chain_;
    /**
     * A buffer holding the partially computed hash result.
     * @private
     */
    private buf_;
    /**
     * An array of 80 bytes, each a part of the message to be hashed.  Referred to
     * as the message schedule in the docs.
     * @private
     */
    private W_;
    /**
     * Contains data needed to pad messages less than 64 bytes.
     * @private
     */
    private pad_;
    /**
     * @private {number}
     */
    private inbuf_;
    /**
     * @private {number}
     */
    private total_;
    blockSize: number;
    constructor();
    reset(): void;
    /**
     * Internal compress helper function.
     * @param buf Block to compress.
     * @param offset Offset of the block in the buffer.
     * @private
     */
    compress_(buf: number[] | Uint8Array | string, offset?: number): void;
    update(bytes?: number[] | Uint8Array | string, length?: number): void;
    /** @override */
    digest(): number[];
}
