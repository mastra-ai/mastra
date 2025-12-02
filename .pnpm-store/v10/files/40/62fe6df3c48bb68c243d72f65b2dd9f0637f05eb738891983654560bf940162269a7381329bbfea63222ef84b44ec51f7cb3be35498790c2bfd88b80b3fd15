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
import { App } from '../app/index';
/**
 * Class that provides mechanism to send requests to the FIS backend endpoints.
 */
export declare class FirebaseInstallationsRequestHandler {
    private readonly app;
    private readonly host;
    private readonly timeout;
    private readonly httpClient;
    private path;
    /**
     * @param app - The app used to fetch access tokens to sign API requests.
     *
     * @constructor
     */
    constructor(app: App);
    deleteInstallation(fid: string): Promise<void>;
    /**
     * Invokes the request handler based on the API settings object passed.
     *
     * @param apiSettings - The API endpoint settings to apply to request and response.
     * @returns A promise that resolves when the request is complete.
     */
    private invokeRequestHandler;
    private getPathPrefix;
}
