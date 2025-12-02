/**
 * @license
 * Copyright 2020 Google LLC
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

export interface FirebaseAppCheckInternal {
  // Get the current AttestationToken. Attaches to the most recent in-flight request if one
  // is present. Returns null if no token is present and no token requests are in-flight.
  getToken(forceRefresh?: boolean): Promise<AppCheckTokenResult>;

  // Always returns a fresh limited-use token suitable for Replay Protection.
  // The returned token must be used and consumed as soon as possible.
  getLimitedUseToken(): Promise<AppCheckTokenResult>;

  // Registers a listener to changes in the token state. There can be more than one listener
  // registered at the same time for one or more FirebaseAppAttestation instances. The
  // listeners call back on the UI thread whenever the current token associated with this
  // FirebaseAppAttestation changes.
  addTokenListener(listener: AppCheckTokenListener): void;

  // Unregisters a listener to changes in the token state.
  removeTokenListener(listener: AppCheckTokenListener): void;
}

type AppCheckTokenListener = (token: AppCheckTokenResult) => void;

// If the error field is defined, the token field will be populated with a dummy token
interface AppCheckTokenResult {
  readonly token: string;
  readonly error?: Error;
}

export type AppCheckInternalComponentName = 'app-check-internal';

declare module '@firebase/component' {
  interface NameServiceMapping {
    'app-check-internal': FirebaseAppCheckInternal;
  }
}
