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
export interface Release {
    readonly name: string;
    readonly rulesetName: string;
    readonly createTime?: string;
    readonly updateTime?: string;
}
export interface RulesetContent {
    readonly source: {
        readonly files: Array<{
            name: string;
            content: string;
        }>;
    };
}
export interface RulesetResponse extends RulesetContent {
    readonly name: string;
    readonly createTime: string;
}
export interface ListRulesetsResponse {
    readonly rulesets: Array<{
        name: string;
        createTime: string;
    }>;
    readonly nextPageToken?: string;
}
/**
 * Class that facilitates sending requests to the Firebase security rules backend API.
 *
 * @private
 */
export declare class SecurityRulesApiClient {
    private readonly app;
    private readonly httpClient;
    private projectIdPrefix?;
    constructor(app: App);
    getRuleset(name: string): Promise<RulesetResponse>;
    createRuleset(ruleset: RulesetContent): Promise<RulesetResponse>;
    deleteRuleset(name: string): Promise<void>;
    listRulesets(pageSize?: number, pageToken?: string): Promise<ListRulesetsResponse>;
    getRelease(name: string): Promise<Release>;
    updateOrCreateRelease(name: string, rulesetName: string): Promise<Release>;
    updateRelease(name: string, rulesetName: string): Promise<Release>;
    createRelease(name: string, rulesetName: string): Promise<Release>;
    private getUrl;
    private getProjectIdPrefix;
    /**
     * Gets the specified resource from the rules API. Resource names must be the short names without project
     * ID prefix (e.g. `rulesets/ruleset-name`).
     *
     * @param {string} name Full qualified name of the resource to get.
     * @returns {Promise<T>} A promise that fulfills with the resource.
     */
    private getResource;
    private getReleaseDescription;
    private getRulesetName;
    private sendRequest;
    private toFirebaseError;
}
