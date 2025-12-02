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
import { FirebaseAuthTokenData } from '@firebase/app-types/private';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { Provider } from '@firebase/component';
export interface AuthTokenProvider {
    getToken(forceRefresh: boolean): Promise<FirebaseAuthTokenData>;
    addTokenChangeListener(listener: (token: string | null) => void): void;
    removeTokenChangeListener(listener: (token: string | null) => void): void;
    notifyForInvalidToken(): void;
}
/**
 * Abstraction around FirebaseApp's token fetching capabilities.
 */
export declare class FirebaseAuthTokenProvider implements AuthTokenProvider {
    private appName_;
    private firebaseOptions_;
    private authProvider_;
    private auth_;
    constructor(appName_: string, firebaseOptions_: object, authProvider_: Provider<FirebaseAuthInternalName>);
    getToken(forceRefresh: boolean): Promise<FirebaseAuthTokenData>;
    addTokenChangeListener(listener: (token: string | null) => void): void;
    removeTokenChangeListener(listener: (token: string | null) => void): void;
    notifyForInvalidToken(): void;
}
export declare class EmulatorTokenProvider implements AuthTokenProvider {
    private accessToken;
    /** A string that is treated as an admin access token by the RTDB emulator. Used by Admin SDK. */
    static OWNER: string;
    constructor(accessToken: string);
    getToken(forceRefresh: boolean): Promise<FirebaseAuthTokenData>;
    addTokenChangeListener(listener: (token: string | null) => void): void;
    removeTokenChangeListener(listener: (token: string | null) => void): void;
    notifyForInvalidToken(): void;
}
