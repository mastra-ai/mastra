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
import { PersistentConnection } from '../core/PersistentConnection';
import { RepoInfo } from '../core/RepoInfo';
import { Connection } from '../realtime/Connection';
export declare const DataConnection: typeof PersistentConnection;
export declare const RealTimeConnection: typeof Connection;
/**
 * @internal
 */
export declare const hijackHash: (newHash: () => string) => () => void;
export declare const ConnectionTarget: typeof RepoInfo;
/**
 * Forces the RepoManager to create Repos that use ReadonlyRestClient instead of PersistentConnection.
 * @internal
 */
export declare const forceRestClient: (forceRestClient: boolean) => void;
