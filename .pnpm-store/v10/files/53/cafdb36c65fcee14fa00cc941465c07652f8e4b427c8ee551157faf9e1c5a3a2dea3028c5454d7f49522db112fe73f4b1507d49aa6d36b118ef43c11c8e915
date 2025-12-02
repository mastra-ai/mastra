/*! firebase-admin v13.5.0 */
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
import { App } from '../app';
import { TaskOptions } from './functions-api';
/**
 * The Firebase `Functions` service interface.
 */
export declare class Functions {
    readonly app: App;
    private readonly client;
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
    taskQueue<Args = Record<string, any>>(functionName: string, extensionId?: string): TaskQueue<Args>;
}
/**
 * The `TaskQueue` interface.
 */
export declare class TaskQueue<Args = Record<string, any>> {
    private readonly functionName;
    private readonly client;
    private readonly extensionId?;
    /**
     * Creates a task and adds it to the queue. Tasks cannot be updated after creation.
     * This action requires `cloudtasks.tasks.create` IAM permission on the service account.
     *
     * @param data - The data payload of the task.
     * @param opts - Optional options when enqueuing a new task.
     * @returns A promise that resolves when the task has successfully been added to the queue.
     */
    enqueue(data: Args, opts?: TaskOptions): Promise<void>;
    /**
     * Deletes an enqueued task if it has not yet completed.
     * @param id - the ID of the task, relative to this queue.
     * @returns A promise that resolves when the task has been deleted.
     */
    delete(id: string): Promise<void>;
}
