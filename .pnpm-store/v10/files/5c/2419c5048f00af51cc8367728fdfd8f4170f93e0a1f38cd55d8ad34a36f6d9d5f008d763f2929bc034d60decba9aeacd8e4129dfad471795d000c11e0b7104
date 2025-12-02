/*! firebase-admin v13.5.0 */
"use strict";
/*!
 * Copyright 2019 Google Inc.
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
exports.SecurityRules = exports.Ruleset = exports.RulesetMetadataList = void 0;
const validator = require("../utils/validator");
const security_rules_api_client_internal_1 = require("./security-rules-api-client-internal");
const security_rules_internal_1 = require("./security-rules-internal");
/**
 * A page of ruleset metadata.
 */
class RulesetMetadataList {
    /**
     * @internal
     */
    constructor(response) {
        if (!validator.isNonNullObject(response) || !validator.isArray(response.rulesets)) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', `Invalid ListRulesets response: ${JSON.stringify(response)}`);
        }
        this.rulesets = response.rulesets.map((rs) => {
            return {
                name: stripProjectIdPrefix(rs.name),
                createTime: new Date(rs.createTime).toUTCString(),
            };
        });
        if (response.nextPageToken) {
            this.nextPageToken = response.nextPageToken;
        }
    }
}
exports.RulesetMetadataList = RulesetMetadataList;
/**
 * A set of Firebase security rules.
 */
class Ruleset {
    /**
     * @internal
     */
    constructor(ruleset) {
        if (!validator.isNonNullObject(ruleset) ||
            !validator.isNonEmptyString(ruleset.name) ||
            !validator.isNonEmptyString(ruleset.createTime) ||
            !validator.isNonNullObject(ruleset.source)) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', `Invalid Ruleset response: ${JSON.stringify(ruleset)}`);
        }
        this.name = stripProjectIdPrefix(ruleset.name);
        this.createTime = new Date(ruleset.createTime).toUTCString();
        this.source = ruleset.source.files || [];
    }
}
exports.Ruleset = Ruleset;
/**
 * The Firebase `SecurityRules` service interface.
 */
class SecurityRules {
    /**
     * @param app - The app for this SecurityRules service.
     * @constructor
     * @internal
     */
    constructor(app) {
        this.app = app;
        this.client = new security_rules_api_client_internal_1.SecurityRulesApiClient(app);
    }
    /**
     * Gets the {@link Ruleset} identified by the given
     * name. The input name should be the short name string without the project ID
     * prefix. For example, to retrieve the `projects/project-id/rulesets/my-ruleset`,
     * pass the short name "my-ruleset". Rejects with a `not-found` error if the
     * specified `Ruleset` cannot be found.
     *
     * @param name - Name of the `Ruleset` to retrieve.
     * @returns A promise that fulfills with the specified `Ruleset`.
     */
    getRuleset(name) {
        return this.client.getRuleset(name)
            .then((rulesetResponse) => {
            return new Ruleset(rulesetResponse);
        });
    }
    /**
     * Gets the {@link Ruleset} currently applied to
     * Cloud Firestore. Rejects with a `not-found` error if no ruleset is applied
     * on Firestore.
     *
     * @returns A promise that fulfills with the Firestore ruleset.
     */
    getFirestoreRuleset() {
        return this.getRulesetForRelease(SecurityRules.CLOUD_FIRESTORE);
    }
    /**
     * Creates a new {@link Ruleset} from the given
     * source, and applies it to Cloud Firestore.
     *
     * @param source - Rules source to apply.
     * @returns A promise that fulfills when the ruleset is created and released.
     */
    releaseFirestoreRulesetFromSource(source) {
        return Promise.resolve()
            .then(() => {
            const rulesFile = this.createRulesFileFromSource('firestore.rules', source);
            return this.createRuleset(rulesFile);
        })
            .then((ruleset) => {
            return this.releaseFirestoreRuleset(ruleset)
                .then(() => {
                return ruleset;
            });
        });
    }
    /**
     * Applies the specified {@link Ruleset} ruleset
     * to Cloud Firestore.
     *
     * @param ruleset - Name of the ruleset to apply or a `RulesetMetadata` object
     *   containing the name.
     * @returns A promise that fulfills when the ruleset is released.
     */
    releaseFirestoreRuleset(ruleset) {
        return this.releaseRuleset(ruleset, SecurityRules.CLOUD_FIRESTORE);
    }
    /**
     * Gets the {@link Ruleset} currently applied to a
     * Cloud Storage bucket. Rejects with a `not-found` error if no ruleset is applied
     * on the bucket.
     *
     * @param bucket - Optional name of the Cloud Storage bucket to be retrieved. If not
     *   specified, retrieves the ruleset applied on the default bucket configured via
     *   `AppOptions`.
     * @returns A promise that fulfills with the Cloud Storage ruleset.
     */
    getStorageRuleset(bucket) {
        return Promise.resolve()
            .then(() => {
            return this.getBucketName(bucket);
        })
            .then((bucketName) => {
            return this.getRulesetForRelease(`${SecurityRules.FIREBASE_STORAGE}/${bucketName}`);
        });
    }
    /**
     * Creates a new {@link Ruleset} from the given
     * source, and applies it to a Cloud Storage bucket.
     *
     * @param source - Rules source to apply.
     * @param bucket - Optional name of the Cloud Storage bucket to apply the rules on. If
     *   not specified, applies the ruleset on the default bucket configured via
     *   {@link firebase-admin.app#AppOptions}.
     * @returns A promise that fulfills when the ruleset is created and released.
     */
    releaseStorageRulesetFromSource(source, bucket) {
        return Promise.resolve()
            .then(() => {
            // Bucket name is not required until the last step. But since there's a createRuleset step
            // before then, make sure to run this check and fail early if the bucket name is invalid.
            this.getBucketName(bucket);
            const rulesFile = this.createRulesFileFromSource('storage.rules', source);
            return this.createRuleset(rulesFile);
        })
            .then((ruleset) => {
            return this.releaseStorageRuleset(ruleset, bucket)
                .then(() => {
                return ruleset;
            });
        });
    }
    /**
     * Applies the specified {@link Ruleset} ruleset
     * to a Cloud Storage bucket.
     *
     * @param ruleset - Name of the ruleset to apply or a `RulesetMetadata` object
     *   containing the name.
     * @param bucket - Optional name of the Cloud Storage bucket to apply the rules on. If
     *   not specified, applies the ruleset on the default bucket configured via
     *   {@link firebase-admin.app#AppOptions}.
     * @returns A promise that fulfills when the ruleset is released.
     */
    releaseStorageRuleset(ruleset, bucket) {
        return Promise.resolve()
            .then(() => {
            return this.getBucketName(bucket);
        })
            .then((bucketName) => {
            return this.releaseRuleset(ruleset, `${SecurityRules.FIREBASE_STORAGE}/${bucketName}`);
        });
    }
    /**
     * Creates a {@link RulesFile} with the given name
     * and source. Throws an error if any of the arguments are invalid. This is a local
     * operation, and does not involve any network API calls.
     *
     * @example
     * ```javascript
     * const source = '// Some rules source';
     * const rulesFile = admin.securityRules().createRulesFileFromSource(
     *   'firestore.rules', source);
     * ```
     *
     * @param name - Name to assign to the rules file. This is usually a short file name that
     *   helps identify the file in a ruleset.
     * @param source - Contents of the rules file.
     * @returns A new rules file instance.
     */
    createRulesFileFromSource(name, source) {
        if (!validator.isNonEmptyString(name)) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Name must be a non-empty string.');
        }
        let content;
        if (validator.isNonEmptyString(source)) {
            content = source;
        }
        else if (validator.isBuffer(source)) {
            content = source.toString('utf-8');
        }
        else {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Source must be a non-empty string or a Buffer.');
        }
        return {
            name,
            content,
        };
    }
    /**
     * Creates a new {@link Ruleset} from the given {@link RulesFile}.
     *
     * @param file - Rules file to include in the new `Ruleset`.
     * @returns A promise that fulfills with the newly created `Ruleset`.
     */
    createRuleset(file) {
        const ruleset = {
            source: {
                files: [file],
            },
        };
        return this.client.createRuleset(ruleset)
            .then((rulesetResponse) => {
            return new Ruleset(rulesetResponse);
        });
    }
    /**
     * Deletes the {@link Ruleset} identified by the given
     * name. The input name should be the short name string without the project ID
     * prefix. For example, to delete the `projects/project-id/rulesets/my-ruleset`,
     * pass the  short name "my-ruleset". Rejects with a `not-found` error if the
     * specified `Ruleset` cannot be found.
     *
     * @param name - Name of the `Ruleset` to delete.
     * @returns A promise that fulfills when the `Ruleset` is deleted.
     */
    deleteRuleset(name) {
        return this.client.deleteRuleset(name);
    }
    /**
     * Retrieves a page of ruleset metadata.
     *
     * @param pageSize - The page size, 100 if undefined. This is also the maximum allowed
     *   limit.
     * @param nextPageToken - The next page token. If not specified, returns rulesets
     *   starting without any offset.
     * @returns A promise that fulfills with a page of rulesets.
     */
    listRulesetMetadata(pageSize = 100, nextPageToken) {
        return this.client.listRulesets(pageSize, nextPageToken)
            .then((response) => {
            return new RulesetMetadataList(response);
        });
    }
    getRulesetForRelease(releaseName) {
        return this.client.getRelease(releaseName)
            .then((release) => {
            const rulesetName = release.rulesetName;
            if (!validator.isNonEmptyString(rulesetName)) {
                throw new security_rules_internal_1.FirebaseSecurityRulesError('not-found', `Ruleset name not found for ${releaseName}.`);
            }
            return this.getRuleset(stripProjectIdPrefix(rulesetName));
        });
    }
    releaseRuleset(ruleset, releaseName) {
        if (!validator.isNonEmptyString(ruleset) &&
            (!validator.isNonNullObject(ruleset) || !validator.isNonEmptyString(ruleset.name))) {
            const err = new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'ruleset must be a non-empty name or a RulesetMetadata object.');
            return Promise.reject(err);
        }
        const rulesetName = validator.isString(ruleset) ? ruleset : ruleset.name;
        return this.client.updateOrCreateRelease(releaseName, rulesetName)
            .then(() => {
            return;
        });
    }
    getBucketName(bucket) {
        const bucketName = (typeof bucket !== 'undefined') ? bucket : this.app.options.storageBucket;
        if (!validator.isNonEmptyString(bucketName)) {
            throw new security_rules_internal_1.FirebaseSecurityRulesError('invalid-argument', 'Bucket name not specified or invalid. Specify a default bucket name via the ' +
                'storageBucket option when initializing the app, or specify the bucket name ' +
                'explicitly when calling the rules API.');
        }
        return bucketName;
    }
}
exports.SecurityRules = SecurityRules;
SecurityRules.CLOUD_FIRESTORE = 'cloud.firestore';
SecurityRules.FIREBASE_STORAGE = 'firebase.storage';
function stripProjectIdPrefix(name) {
    return name.split('/').pop();
}
