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
import { Path } from '../util/Path';
/**
 *
 * @enum
 */
export declare enum OperationType {
    OVERWRITE = 0,
    MERGE = 1,
    ACK_USER_WRITE = 2,
    LISTEN_COMPLETE = 3
}
/**
 * @interface
 */
export interface Operation {
    source: OperationSource;
    type: OperationType;
    path: Path;
    operationForChild(childName: string): Operation | null;
}
export interface OperationSource {
    fromUser: boolean;
    fromServer: boolean;
    queryId: string | null;
    tagged: boolean;
}
export declare function newOperationSourceUser(): OperationSource;
export declare function newOperationSourceServer(): OperationSource;
export declare function newOperationSourceServerTaggedQuery(queryId: string): OperationSource;
