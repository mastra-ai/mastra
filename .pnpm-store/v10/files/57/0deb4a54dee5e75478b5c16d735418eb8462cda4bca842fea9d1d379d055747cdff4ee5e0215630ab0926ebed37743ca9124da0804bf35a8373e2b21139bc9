/*! firebase-admin v13.5.0 */
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
import { App } from '../app';
/**
 * A source file containing some Firebase security rules. The content includes raw
 * source code including text formatting, indentation and comments. Use the
 * {@link SecurityRules.createRulesFileFromSource} method to create new instances of this type.
 */
export interface RulesFile {
    readonly name: string;
    readonly content: string;
}
/**
 * Required metadata associated with a ruleset.
 */
export interface RulesetMetadata {
    /**
     * Name of the `Ruleset` as a short string. This can be directly passed into APIs
     * like {@link SecurityRules.getRuleset} and {@link SecurityRules.deleteRuleset}.
     */
    readonly name: string;
    /**
     * Creation time of the `Ruleset` as a UTC timestamp string.
     */
    readonly createTime: string;
}
/**
 * A page of ruleset metadata.
 */
export declare class RulesetMetadataList {
    /**
     * A batch of ruleset metadata.
     */
    readonly rulesets: RulesetMetadata[];
    /**
     * The next page token if available. This is needed to retrieve the next batch.
     */
    readonly nextPageToken?: string;
}
/**
 * A set of Firebase security rules.
 */
export declare class Ruleset implements RulesetMetadata {
    /**
     * {@inheritdoc RulesetMetadata.name}
     */
    readonly name: string;
    /**
     * {@inheritdoc RulesetMetadata.createTime}
     */
    readonly createTime: string;
    readonly source: RulesFile[];
}
/**
 * The Firebase `SecurityRules` service interface.
 */
export declare class SecurityRules {
    readonly app: App;
    private static readonly CLOUD_FIRESTORE;
    private static readonly FIREBASE_STORAGE;
    private readonly client;
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
    getRuleset(name: string): Promise<Ruleset>;
    /**
     * Gets the {@link Ruleset} currently applied to
     * Cloud Firestore. Rejects with a `not-found` error if no ruleset is applied
     * on Firestore.
     *
     * @returns A promise that fulfills with the Firestore ruleset.
     */
    getFirestoreRuleset(): Promise<Ruleset>;
    /**
     * Creates a new {@link Ruleset} from the given
     * source, and applies it to Cloud Firestore.
     *
     * @param source - Rules source to apply.
     * @returns A promise that fulfills when the ruleset is created and released.
     */
    releaseFirestoreRulesetFromSource(source: string | Buffer): Promise<Ruleset>;
    /**
     * Applies the specified {@link Ruleset} ruleset
     * to Cloud Firestore.
     *
     * @param ruleset - Name of the ruleset to apply or a `RulesetMetadata` object
     *   containing the name.
     * @returns A promise that fulfills when the ruleset is released.
     */
    releaseFirestoreRuleset(ruleset: string | RulesetMetadata): Promise<void>;
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
    getStorageRuleset(bucket?: string): Promise<Ruleset>;
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
    releaseStorageRulesetFromSource(source: string | Buffer, bucket?: string): Promise<Ruleset>;
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
    releaseStorageRuleset(ruleset: string | RulesetMetadata, bucket?: string): Promise<void>;
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
    createRulesFileFromSource(name: string, source: string | Buffer): RulesFile;
    /**
     * Creates a new {@link Ruleset} from the given {@link RulesFile}.
     *
     * @param file - Rules file to include in the new `Ruleset`.
     * @returns A promise that fulfills with the newly created `Ruleset`.
     */
    createRuleset(file: RulesFile): Promise<Ruleset>;
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
    deleteRuleset(name: string): Promise<void>;
    /**
     * Retrieves a page of ruleset metadata.
     *
     * @param pageSize - The page size, 100 if undefined. This is also the maximum allowed
     *   limit.
     * @param nextPageToken - The next page token. If not specified, returns rulesets
     *   starting without any offset.
     * @returns A promise that fulfills with a page of rulesets.
     */
    listRulesetMetadata(pageSize?: number, nextPageToken?: string): Promise<RulesetMetadataList>;
    private getRulesetForRelease;
    private releaseRuleset;
    private getBucketName;
}
