"use strict";
// Copyright 2015 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = exports.DEFAULT_PROJECT_ID_TOKEN = void 0;
/*!
 * @module common/service
 */
const arrify = require("arrify");
const extend = require("extend");
const util_1 = require("./util");
exports.DEFAULT_PROJECT_ID_TOKEN = '{{projectId}}';
class Service {
    /**
     * Service is a base class, meant to be inherited from by a "service," like
     * BigQuery or Storage.
     *
     * This handles making authenticated requests by exposing a `makeReq_`
     * function.
     *
     * @constructor
     * @alias module:common/service
     *
     * @param {object} config - Configuration object.
     * @param {string} config.baseUrl - The base URL to make API requests to.
     * @param {string[]} config.scopes - The scopes required for the request.
     * @param {object=} options - [Configuration object](#/docs).
     */
    constructor(config, options = {}) {
        this.baseUrl = config.baseUrl;
        this.apiEndpoint = config.apiEndpoint;
        this.timeout = options.timeout;
        this.globalInterceptors = arrify(options.interceptors_);
        this.interceptors = [];
        this.packageJson = config.packageJson;
        this.projectId = options.projectId || exports.DEFAULT_PROJECT_ID_TOKEN;
        this.projectIdRequired = config.projectIdRequired !== false;
        this.providedUserAgent = options.userAgent;
        const reqCfg = extend({}, config, {
            projectIdRequired: this.projectIdRequired,
            projectId: this.projectId,
            authClient: options.authClient,
            credentials: options.credentials,
            keyFile: options.keyFilename,
            email: options.email,
            token: options.token,
        });
        this.makeAuthenticatedRequest =
            util_1.util.makeAuthenticatedRequestFactory(reqCfg);
        this.authClient = this.makeAuthenticatedRequest.authClient;
        this.getCredentials = this.makeAuthenticatedRequest.getCredentials;
        const isCloudFunctionEnv = !!process.env.FUNCTION_NAME;
        if (isCloudFunctionEnv) {
            this.interceptors.push({
                request(reqOpts) {
                    reqOpts.forever = false;
                    return reqOpts;
                },
            });
        }
    }
    /**
     * Return the user's custom request interceptors.
     */
    getRequestInterceptors() {
        // Interceptors should be returned in the order they were assigned.
        return [].slice
            .call(this.globalInterceptors)
            .concat(this.interceptors)
            .filter(interceptor => typeof interceptor.request === 'function')
            .map(interceptor => interceptor.request);
    }
    getProjectId(callback) {
        if (!callback) {
            return this.getProjectIdAsync();
        }
        this.getProjectIdAsync().then(p => callback(null, p), callback);
    }
    async getProjectIdAsync() {
        const projectId = await this.authClient.getProjectId();
        if (this.projectId === exports.DEFAULT_PROJECT_ID_TOKEN && projectId) {
            this.projectId = projectId;
        }
        return this.projectId;
    }
    request_(reqOpts, callback) {
        reqOpts = extend(true, {}, reqOpts, { timeout: this.timeout });
        const isAbsoluteUrl = reqOpts.uri.indexOf('http') === 0;
        const uriComponents = [this.baseUrl];
        if (this.projectIdRequired) {
            if (reqOpts.projectId) {
                uriComponents.push('projects');
                uriComponents.push(reqOpts.projectId);
            }
            else {
                uriComponents.push('projects');
                uriComponents.push(this.projectId);
            }
        }
        uriComponents.push(reqOpts.uri);
        if (isAbsoluteUrl) {
            uriComponents.splice(0, uriComponents.indexOf(reqOpts.uri));
        }
        reqOpts.uri = uriComponents
            .map(uriComponent => {
            const trimSlashesRegex = /^\/*|\/*$/g;
            return uriComponent.replace(trimSlashesRegex, '');
        })
            .join('/')
            // Some URIs have colon separators.
            // Bad: https://.../projects/:list
            // Good: https://.../projects:list
            .replace(/\/:/g, ':');
        const requestInterceptors = this.getRequestInterceptors();
        arrify(reqOpts.interceptors_).forEach(interceptor => {
            if (typeof interceptor.request === 'function') {
                requestInterceptors.push(interceptor.request);
            }
        });
        requestInterceptors.forEach(requestInterceptor => {
            reqOpts = requestInterceptor(reqOpts);
        });
        delete reqOpts.interceptors_;
        const pkg = this.packageJson;
        let userAgent = util_1.util.getUserAgentFromPackageJson(pkg);
        if (this.providedUserAgent) {
            userAgent = `${this.providedUserAgent} ${userAgent}`;
        }
        reqOpts.headers = extend({}, reqOpts.headers, {
            'User-Agent': userAgent,
            'x-goog-api-client': `gl-node/${process.versions.node} gccl/${pkg.version}`,
        });
        if (reqOpts.shouldReturnStream) {
            return this.makeAuthenticatedRequest(reqOpts);
        }
        else {
            this.makeAuthenticatedRequest(reqOpts, callback);
        }
    }
    /**
     * Make an authenticated API request.
     *
     * @param {object} reqOpts - Request options that are passed to `request`.
     * @param {string} reqOpts.uri - A URI relative to the baseUrl.
     * @param {function} callback - The callback function passed to `request`.
     */
    request(reqOpts, callback) {
        Service.prototype.request_.call(this, reqOpts, callback);
    }
    /**
     * Make an authenticated API request.
     *
     * @param {object} reqOpts - Request options that are passed to `request`.
     * @param {string} reqOpts.uri - A URI relative to the baseUrl.
     */
    requestStream(reqOpts) {
        const opts = extend(true, reqOpts, { shouldReturnStream: true });
        return Service.prototype.request_.call(this, opts);
    }
}
exports.Service = Service;
//# sourceMappingURL=service.js.map