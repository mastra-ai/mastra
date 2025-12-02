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
import { Http2SessionHandler } from '../utils/api-request';
import { SendResponse } from './messaging-api';
/**
 * Class that provides a mechanism to send requests to the Firebase Cloud Messaging backend.
 */
export declare class FirebaseMessagingRequestHandler {
    private readonly httpClient;
    private readonly http2Client;
    /**
     * @param app - The app used to fetch access tokens to sign API requests.
     * @constructor
     */
    constructor(app: App);
    /**
     * Invokes the request handler with the provided request data.
     *
     * @param host - The host to which to send the request.
     * @param path - The path to which to send the request.
     * @param requestData - The request data.
     * @returns A promise that resolves with the response.
     */
    invokeRequestHandler(host: string, path: string, requestData: object): Promise<object>;
    /**
     * Invokes the HTTP/1.1 request handler with the provided request data.
     *
     * @param host - The host to which to send the request.
     * @param path - The path to which to send the request.
     * @param requestData - The request data.
     * @returns A promise that resolves with the {@link SendResponse}.
     */
    invokeHttpRequestHandlerForSendResponse(host: string, path: string, requestData: object): Promise<SendResponse>;
    /**
     * Invokes the HTTP/2 request handler with the provided request data.
     *
     * @param host - The host to which to send the request.
     * @param path - The path to which to send the request.
     * @param requestData - The request data.
     * @returns A promise that resolves with the {@link SendResponse}.
     */
    invokeHttp2RequestHandlerForSendResponse(host: string, path: string, requestData: object, http2SessionHandler: Http2SessionHandler): Promise<SendResponse>;
    private buildSendResponse;
    private buildSendResponseFromError;
}
