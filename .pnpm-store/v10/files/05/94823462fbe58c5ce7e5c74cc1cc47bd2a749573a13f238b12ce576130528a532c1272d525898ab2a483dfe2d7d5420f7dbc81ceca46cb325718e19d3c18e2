/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2017 Google Inc.
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
import { CryptoSigner } from '../utils/crypto-signer';
import { Algorithm } from 'jsonwebtoken';
export declare const BLACKLISTED_CLAIMS: string[];
/**
 * A CryptoSigner implementation that is used when communicating with the Auth emulator.
 * It produces unsigned tokens.
 */
export declare class EmulatedSigner implements CryptoSigner {
    algorithm: Algorithm;
    /**
     * @inheritDoc
     */
    sign(buffer: Buffer): Promise<Buffer>;
    /**
     * @inheritDoc
     */
    getAccountId(): Promise<string>;
}
/**
 * Creates a new FirebaseAuthError by extracting the error code, message and other relevant
 * details from a CryptoSignerError.
 *
 * @param err - The Error to convert into a FirebaseAuthError error
 * @returns A Firebase Auth error that can be returned to the user.
 */
export declare function handleCryptoSignerError(err: Error): Error;
