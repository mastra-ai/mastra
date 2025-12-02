/*!
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { grpc } from 'google-gax';
/**
 * Exception to be thrown during failed ordered publish.
 *
 * @class
 * @extends Error
 */
export declare class PublishError extends Error implements grpc.ServiceError {
    code: grpc.status;
    details: string;
    metadata: grpc.Metadata;
    orderingKey: string;
    error: grpc.ServiceError;
    constructor(key: string, err: grpc.ServiceError);
}
