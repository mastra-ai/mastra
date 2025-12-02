/*! firebase-admin v13.5.0 */
/*!
 * @license
 * Copyright 2022 Google Inc.
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
import { SettableProcessingState } from './extensions-api';
/**
 * The Firebase `Extensions` service interface.
 */
export declare class Extensions {
    readonly app: App;
    private readonly client;
    /**
     * The runtime() method returns a new Runtime, which provides methods to modify an extension instance's runtime data.
     *
     * @remarks
     * This method will throw an error if called outside an Extensions environment.
     *
     * @returns A new {@link Runtime} object.
     */
    runtime(): Runtime;
}
/**
 * Runtime provides methods to modify an extension instance's runtime data.
 */
export declare class Runtime {
    private projectId;
    private extensionInstanceId;
    private readonly client;
    /**
     * Sets the processing state of an extension instance.
     *
     * @remarks
     * Use this method to report the results of a lifecycle event handler.
     *
     * If the lifecycle event failed & the extension instance will no longer work
     * correctly, use {@link Runtime.setFatalError} instead.
     *
     * To report the status of function calls other than lifecycle event handlers,
     * use `console.log` or the Cloud Functions logger SDK.
     *
     * @param state - The state to set the instance to.
     * @param detailMessage - A message explaining the results of the lifecycle function.
     */
    setProcessingState(state: SettableProcessingState, detailMessage: string): Promise<void>;
    /**
     * Reports a fatal error while running a lifecycle event handler.
     *
     * @remarks
     * Call this method when a lifecycle event handler fails in a way that makes
     * the Instance inoperable.
     * If the lifecycle event failed but the instance will still work as expected,
     * call `setProcessingState` with the "PROCESSING_WARNING" or
     * "PROCESSING_FAILED" state instead.
     *
     * @param errorMessage - A message explaining what went wrong and how to fix it.
     */
    setFatalError(errorMessage: string): Promise<void>;
    private getProjectId;
}
