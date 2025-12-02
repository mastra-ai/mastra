/*! firebase-admin v13.5.0 */
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
/**
 * Firebase ML Model input objects
 */
export interface ModelOptionsBase {
    displayName?: string;
    tags?: string[];
}
export interface GcsTfliteModelOptions extends ModelOptionsBase {
    tfliteModel: {
        gcsTfliteUri: string;
    };
}
export type ModelOptions = ModelOptionsBase | GcsTfliteModelOptions;
/**
 * Interface representing options for listing Models.
 */
export interface ListModelsOptions {
    /**
     * An expression that specifies how to filter the results.
     *
     * Examples:
     *
     * ```
     * display_name = your_model
     * display_name : experimental_*
     * tags: face_detector AND tags: experimental
     * state.published = true
     * ```
     *
     * See https://firebase.google.com/docs/ml/manage-hosted-models#list_your_projects_models
     */
    filter?: string;
    /** The number of results to return in each page. */
    pageSize?: number;
    /** A token that specifies the result page to return. */
    pageToken?: string;
}
export interface StatusErrorResponse {
    readonly code: number;
    readonly message: string;
}
export type ModelUpdateOptions = ModelOptions & {
    state?: {
        published?: boolean;
    };
};
export declare function isGcsTfliteModelOptions(options: ModelOptions): options is GcsTfliteModelOptions;
export interface ModelContent {
    readonly displayName?: string;
    readonly tags?: string[];
    readonly state?: {
        readonly validationError?: StatusErrorResponse;
        readonly published?: boolean;
    };
    readonly tfliteModel?: {
        readonly gcsTfliteUri?: string;
        readonly sizeBytes: number;
    };
}
export interface ModelResponse extends ModelContent {
    readonly name: string;
    readonly createTime: string;
    readonly updateTime: string;
    readonly etag: string;
    readonly modelHash?: string;
    readonly activeOperations?: OperationResponse[];
}
export interface ListModelsResponse {
    readonly models?: ModelResponse[];
    readonly nextPageToken?: string;
}
export interface OperationResponse {
    readonly name?: string;
    readonly metadata?: {
        [key: string]: any;
    };
    readonly done: boolean;
    readonly error?: StatusErrorResponse;
    readonly response?: ModelResponse;
}
