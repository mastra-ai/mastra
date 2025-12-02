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
import { FirebaseApp } from '@firebase/app';
import { AppCheckInternalComponentName, AppCheckTokenListener, AppCheckTokenResult } from '@firebase/app-check-interop-types';
import { Provider } from '@firebase/component';
/**
 * Abstraction around AppCheck's token fetching capabilities.
 */
export declare class AppCheckTokenProvider {
    private appCheckProvider?;
    private appCheck?;
    private serverAppAppCheckToken?;
    private appName;
    constructor(app: FirebaseApp, appCheckProvider?: Provider<AppCheckInternalComponentName>);
    getToken(forceRefresh?: boolean): Promise<AppCheckTokenResult>;
    addTokenChangeListener(listener: AppCheckTokenListener): void;
    notifyForInvalidToken(): void;
}
