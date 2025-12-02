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
import type { BaseRawConnection } from "./baseConn";
import type { CodecsRegistry } from "./codecs/registry";
import type { NormalizedConnectConfig } from "./conUtils";
export type ConnectWithTimeout = (config: NormalizedConnectConfig, registry: CodecsRegistry) => Promise<BaseRawConnection>;
export declare function retryingConnect(connectWithTimeout: ConnectWithTimeout, config: NormalizedConnectConfig, registry: CodecsRegistry): Promise<BaseRawConnection>;
