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
import { App } from '../app';
import { Bucket } from '@google-cloud/storage';
/**
 * The default `Storage` service if no
 * app is provided or the `Storage` service associated with the provided
 * app.
 */
export declare class Storage {
    private readonly appInternal;
    private readonly storageClient;
    /**
     * Gets a reference to a Cloud Storage bucket.
     *
     * @param name - Optional name of the bucket to be retrieved. If name is not specified,
     * retrieves a reference to the default bucket.
     * @returns A {@link https://cloud.google.com/nodejs/docs/reference/storage/latest/Bucket | Bucket}
     * instance as defined in the `@google-cloud/storage` package.
     */
    bucket(name?: string): Bucket;
    /**
     * Optional app whose `Storage` service to
     * return. If not provided, the default `Storage` service will be returned.
     */
    get app(): App;
}
