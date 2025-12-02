/*! firebase-admin v13.5.0 */
"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auth = void 0;
const auth_api_request_1 = require("./auth-api-request");
const tenant_manager_1 = require("./tenant-manager");
const base_auth_1 = require("./base-auth");
const project_config_manager_1 = require("./project-config-manager");
/**
 * Auth service bound to the provided app.
 * An Auth instance can have multiple tenants.
 */
class Auth extends base_auth_1.BaseAuth {
    /**
     * @param app - The app for this Auth service.
     * @constructor
     * @internal
     */
    constructor(app) {
        super(app, new auth_api_request_1.AuthRequestHandler(app));
        this.app_ = app;
        this.tenantManager_ = new tenant_manager_1.TenantManager(app);
        this.projectConfigManager_ = new project_config_manager_1.ProjectConfigManager(app);
    }
    /**
     * Returns the app associated with this Auth instance.
     *
     * @returns The app associated with this Auth instance.
     */
    get app() {
        return this.app_;
    }
    /**
     * Returns the tenant manager instance associated with the current project.
     *
     * @returns The tenant manager instance associated with the current project.
     */
    tenantManager() {
        return this.tenantManager_;
    }
    /**
     * Returns the project config manager instance associated with the current project.
     *
     * @returns The project config manager instance associated with the current project.
     */
    projectConfigManager() {
        return this.projectConfigManager_;
    }
}
exports.Auth = Auth;
