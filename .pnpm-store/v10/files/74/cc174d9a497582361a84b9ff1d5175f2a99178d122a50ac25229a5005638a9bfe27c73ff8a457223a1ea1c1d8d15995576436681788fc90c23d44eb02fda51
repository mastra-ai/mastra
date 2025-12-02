/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2020 Google Inc.
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
exports.SecurityRules = exports.RulesetMetadataList = exports.Ruleset = void 0;
exports.getSecurityRules = getSecurityRules;
/**
 * Security Rules for Cloud Firestore and Cloud Storage.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const security_rules_1 = require("./security-rules");
var security_rules_2 = require("./security-rules");
Object.defineProperty(exports, "Ruleset", { enumerable: true, get: function () { return security_rules_2.Ruleset; } });
Object.defineProperty(exports, "RulesetMetadataList", { enumerable: true, get: function () { return security_rules_2.RulesetMetadataList; } });
Object.defineProperty(exports, "SecurityRules", { enumerable: true, get: function () { return security_rules_2.SecurityRules; } });
/**
 * Gets the {@link SecurityRules} service for the default app or a given app.
 *
 * `admin.securityRules()` can be called with no arguments to access the
 * default app's `SecurityRules` service, or as `admin.securityRules(app)` to access
 * the `SecurityRules` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the SecurityRules service for the default app
 * const defaultSecurityRules = getSecurityRules();
 * ```
 *
 * @example
 * ```javascript
 * // Get the SecurityRules service for a given app
 * const otherSecurityRules = getSecurityRules(otherApp);
 * ```
 *
 * @param app - Optional app to return the `SecurityRules` service
 *     for. If not provided, the default `SecurityRules` service
 *     is returned.
 * @returns The default `SecurityRules` service if no app is provided, or the
 *   `SecurityRules` service associated with the provided app.
 */
function getSecurityRules(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('securityRules', (app) => new security_rules_1.SecurityRules(app));
}
