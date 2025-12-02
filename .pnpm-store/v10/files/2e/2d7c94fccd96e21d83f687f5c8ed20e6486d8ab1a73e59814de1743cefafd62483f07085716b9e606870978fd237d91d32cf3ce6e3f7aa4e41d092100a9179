/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runtime = exports.Extensions = void 0;
const extensions_api_client_internal_1 = require("./extensions-api-client-internal");
const validator = require("../utils/validator");
/**
 * The Firebase `Extensions` service interface.
 */
class Extensions {
    /**
     * @param app - The app for this `Extensions` service.
     * @constructor
     * @internal
     */
    constructor(app) {
        this.app = app;
        this.client = new extensions_api_client_internal_1.ExtensionsApiClient(app);
    }
    /**
     * The runtime() method returns a new Runtime, which provides methods to modify an extension instance's runtime data.
     *
     * @remarks
     * This method will throw an error if called outside an Extensions environment.
     *
     * @returns A new {@link Runtime} object.
     */
    runtime() {
        return new Runtime(this.client);
    }
}
exports.Extensions = Extensions;
/**
 * Runtime provides methods to modify an extension instance's runtime data.
 */
class Runtime {
    /**
     * @param client - The API client for this `Runtime` service.
     * @constructor
     * @internal
     */
    constructor(client) {
        this.projectId = this.getProjectId();
        if (!validator.isNonEmptyString(process.env['EXT_INSTANCE_ID'])) {
            throw new extensions_api_client_internal_1.FirebaseExtensionsError('invalid-argument', 'Runtime is only available from within a running Extension instance.');
        }
        this.extensionInstanceId = process.env['EXT_INSTANCE_ID'];
        if (!validator.isNonNullObject(client) || !('updateRuntimeData' in client)) {
            throw new extensions_api_client_internal_1.FirebaseExtensionsError('invalid-argument', 'Must provide a valid ExtensionsApiClient instance to create a new Runtime.');
        }
        this.client = client;
    }
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
    async setProcessingState(state, detailMessage) {
        await this.client.updateRuntimeData(this.projectId, this.extensionInstanceId, {
            processingState: {
                state,
                detailMessage,
            },
        });
    }
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
    async setFatalError(errorMessage) {
        if (!validator.isNonEmptyString(errorMessage)) {
            throw new extensions_api_client_internal_1.FirebaseExtensionsError('invalid-argument', 'errorMessage must not be empty');
        }
        await this.client.updateRuntimeData(this.projectId, this.extensionInstanceId, {
            fatalError: {
                errorMessage,
            },
        });
    }
    getProjectId() {
        const projectId = process.env['PROJECT_ID'];
        if (!validator.isNonEmptyString(projectId)) {
            throw new extensions_api_client_internal_1.FirebaseExtensionsError('invalid-argument', 'PROJECT_ID must not be undefined in Extensions runtime environment');
        }
        return projectId;
    }
}
exports.Runtime = Runtime;
