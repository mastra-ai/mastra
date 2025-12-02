/**
 * @license
 * Copyright 2021 Google LLC
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
export type FirebaseSignInProvider = 'custom' | 'email' | 'password' | 'phone' | 'anonymous' | 'google.com' | 'facebook.com' | 'github.com' | 'twitter.com' | 'microsoft.com' | 'apple.com';
interface FirebaseIdToken {
    iss: string;
    aud: string;
    sub: string;
    iat: number;
    exp: number;
    user_id: string;
    auth_time: number;
    provider_id?: 'anonymous';
    email?: string;
    email_verified?: boolean;
    phone_number?: string;
    name?: string;
    picture?: string;
    firebase: {
        sign_in_provider: FirebaseSignInProvider;
        identities?: {
            [provider in FirebaseSignInProvider]?: string[];
        };
    };
    [claim: string]: unknown;
    uid?: never;
}
export type EmulatorMockTokenOptions = ({
    user_id: string;
} | {
    sub: string;
}) & Partial<FirebaseIdToken>;
export declare function createMockUserToken(token: EmulatorMockTokenOptions, projectId?: string): string;
/**
 * Updates Emulator Banner. Primarily used for Firebase Studio
 * @param name
 * @param isRunningEmulator
 * @public
 */
export declare function updateEmulatorBanner(name: string, isRunningEmulator: boolean): void;
export {};
