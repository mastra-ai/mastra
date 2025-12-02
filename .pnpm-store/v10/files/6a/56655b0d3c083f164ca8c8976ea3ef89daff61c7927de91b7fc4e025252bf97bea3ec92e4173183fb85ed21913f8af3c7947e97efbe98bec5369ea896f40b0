/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * @license
 * Copyright 2021 Google Inc.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskQueue = exports.Functions = void 0;
const functions_api_client_internal_1 = require("./functions-api-client-internal");
const validator = require("../utils/validator");
/**
 * The Firebase `Functions` service interface.
 */
class Functions {
    /**
   * @param app - The app for this `Functions` service.
   * @constructor
   * @internal
   */
    constructor(app) {
        this.app = app;
        this.client = new functions_api_client_internal_1.FunctionsApiClient(app);
    }
    /**
     * Creates a reference to a {@link TaskQueue} for a given function name.
     * The function name can be either:
     *
     * 1) A fully qualified function resource name:
     *     `projects/{project}/locations/{location}/functions/{functionName}`
     *
     * 2) A partial resource name with location and function name, in which case
     *     the runtime project ID is used:
     *     `locations/{location}/functions/{functionName}`
     *
     * 3) A partial function name, in which case the runtime project ID and the default location,
     *     `us-central1`, is used:
     *     `{functionName}`
     *
     * @param functionName - The name of the function.
     * @param extensionId - Optional Firebase extension ID.
     * @returns A promise that fulfills with a `TaskQueue`.
     */
    taskQueue(functionName, extensionId) {
        return new TaskQueue(functionName, this.client, extensionId);
    }
}
exports.Functions = Functions;
/**
 * The `TaskQueue` interface.
 */
class TaskQueue {
    /**
     * @param functionName - The name of the function.
     * @param client - The `FunctionsApiClient` instance.
     * @param extensionId - Optional canonical ID of the extension.
     * @constructor
     * @internal
     */
    constructor(functionName, client, extensionId) {
        this.functionName = functionName;
        this.client = client;
        this.extensionId = extensionId;
        if (!validator.isNonEmptyString(functionName)) {
            throw new functions_api_client_internal_1.FirebaseFunctionsError('invalid-argument', '`functionName` must be a non-empty string.');
        }
        if (!validator.isNonNullObject(client) || !('enqueue' in client)) {
            throw new functions_api_client_internal_1.FirebaseFunctionsError('invalid-argument', 'Must provide a valid FunctionsApiClient instance to create a new TaskQueue.');
        }
        if (typeof extensionId !== 'undefined' && !validator.isString(extensionId)) {
            throw new functions_api_client_internal_1.FirebaseFunctionsError('invalid-argument', '`extensionId` must be a string.');
        }
    }
    /**
     * Creates a task and adds it to the queue. Tasks cannot be updated after creation.
     * This action requires `cloudtasks.tasks.create` IAM permission on the service account.
     *
     * @param data - The data payload of the task.
     * @param opts - Optional options when enqueuing a new task.
     * @returns A promise that resolves when the task has successfully been added to the queue.
     */
    enqueue(data, opts) {
        return this.client.enqueue(data, this.functionName, this.extensionId, opts);
    }
    /**
     * Deletes an enqueued task if it has not yet completed.
     * @param id - the ID of the task, relative to this queue.
     * @returns A promise that resolves when the task has been deleted.
     */
    delete(id) {
        return this.client.delete(id, this.functionName, this.extensionId);
    }
}
exports.TaskQueue = TaskQueue;
