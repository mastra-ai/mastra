/*! firebase-admin v13.5.0 */
/*!
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
import { RulesFile as TRulesFile, Ruleset as TRuleset, RulesetMetadata as TRulesetMetadata, RulesetMetadataList as TRulesetMetadataList, SecurityRules as TSecurityRules } from './security-rules';
/**
 * Gets the {@link firebase-admin.security-rules#SecurityRules} service for the default
 * app or a given app.
 *
 * `admin.securityRules()` can be called with no arguments to access the
 * default app's {@link firebase-admin.security-rules#SecurityRules}
 * service, or as `admin.securityRules(app)` to access
 * the {@link firebase-admin.security-rules#SecurityRules}
 * service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the SecurityRules service for the default app
 * var defaultSecurityRules = admin.securityRules();
 * ```
 *
 * @example
 * ```javascript
 * // Get the SecurityRules service for a given app
 * var otherSecurityRules = admin.securityRules(otherApp);
 * ```
 *
 * @param app - Optional app to return the `SecurityRules` service
 *     for. If not provided, the default `SecurityRules` service
 *     is returned.
 * @returns The default `SecurityRules` service if no app is provided, or the
 *   `SecurityRules` service associated with the provided app.
 */
export declare function securityRules(app?: App): securityRules.SecurityRules;
export declare namespace securityRules {
    /**
     * Type alias to {@link firebase-admin.security-rules#RulesFile}.
     */
    type RulesFile = TRulesFile;
    /**
     * Type alias to {@link firebase-admin.security-rules#Ruleset}.
     */
    type Ruleset = TRuleset;
    /**
     * Type alias to {@link firebase-admin.security-rules#RulesetMetadata}.
     */
    type RulesetMetadata = TRulesetMetadata;
    /**
     * Type alias to {@link firebase-admin.security-rules#RulesetMetadataList}.
     */
    type RulesetMetadataList = TRulesetMetadataList;
    /**
     * Type alias to {@link firebase-admin.security-rules#SecurityRules}.
     */
    type SecurityRules = TSecurityRules;
}
