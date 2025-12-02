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
import { App } from '../app';
import { ListModelsOptions, ModelOptions } from './machine-learning-api-client';
/** Response object for a listModels operation. */
export interface ListModelsResult {
    /** A list of models in your project. */
    readonly models: Model[];
    /**
     * A token you can use to retrieve the next page of results. If null, the
     * current page is the final page.
     */
    readonly pageToken?: string;
}
/**
 * A TensorFlow Lite Model output object
 */
export interface TFLiteModel {
    /** The size of the model. */
    readonly sizeBytes: number;
    /** The URI from which the model was originally provided to Firebase. */
    readonly gcsTfliteUri?: string;
}
/**
 * The Firebase `MachineLearning` service interface.
 */
export declare class MachineLearning {
    private readonly client;
    private readonly appInternal;
    /**
     *  The {@link firebase-admin.app#App} associated with the current `MachineLearning`
     *  service instance.
     */
    get app(): App;
    /**
     * Creates a model in the current Firebase project.
     *
     * @param model - The model to create.
     *
     * @returns A Promise fulfilled with the created model.
     */
    createModel(model: ModelOptions): Promise<Model>;
    /**
     * Updates a model's metadata or model file.
     *
     * @param modelId - The ID of the model to update.
     * @param model - The model fields to update.
     *
     * @returns A Promise fulfilled with the updated model.
     */
    updateModel(modelId: string, model: ModelOptions): Promise<Model>;
    /**
     * Publishes a Firebase ML model.
     *
     * A published model can be downloaded to client apps.
     *
     * @param modelId - The ID of the model to publish.
     *
     * @returns A Promise fulfilled with the published model.
     */
    publishModel(modelId: string): Promise<Model>;
    /**
     * Unpublishes a Firebase ML model.
     *
     * @param modelId - The ID of the model to unpublish.
     *
     * @returns A Promise fulfilled with the unpublished model.
     */
    unpublishModel(modelId: string): Promise<Model>;
    /**
     * Gets the model specified by the given ID.
     *
     * @param modelId - The ID of the model to get.
     *
     * @returns A Promise fulfilled with the model object.
     */
    getModel(modelId: string): Promise<Model>;
    /**
     * Lists the current project's models.
     *
     * @param options - The listing options.
     *
     * @returns A promise that
     *     resolves with the current (filtered) list of models and the next page
     *     token. For the last page, an empty list of models and no page token
     *     are returned.
     */
    listModels(options?: ListModelsOptions): Promise<ListModelsResult>;
    /**
     * Deletes a model from the current project.
     *
     * @param modelId - The ID of the model to delete.
     */
    deleteModel(modelId: string): Promise<void>;
    private setPublishStatus;
    private signUrlIfPresent;
    private signUrl;
}
/**
 * A Firebase ML Model output object.
 */
export declare class Model {
    private model;
    private readonly client?;
    /** The ID of the model. */
    get modelId(): string;
    /**
     * The model's name. This is the name you use from your app to load the
     * model.
     */
    get displayName(): string;
    /**
     * The model's tags, which can be used to group or filter models in list
     * operations.
     */
    get tags(): string[];
    /** The timestamp of the model's creation. */
    get createTime(): string;
    /** The timestamp of the model's most recent update. */
    get updateTime(): string;
    /** Error message when model validation fails. */
    get validationError(): string | undefined;
    /** True if the model is published. */
    get published(): boolean;
    /**
     * The ETag identifier of the current version of the model. This value
     * changes whenever you update any of the model's properties.
     */
    get etag(): string;
    /**
     * The hash of the model's `tflite` file. This value changes only when
     * you upload a new TensorFlow Lite model.
     */
    get modelHash(): string | undefined;
    /** Metadata about the model's TensorFlow Lite model file. */
    get tfliteModel(): TFLiteModel | undefined;
    /**
     * True if the model is locked by a server-side operation. You can't make
     * changes to a locked model. See {@link Model.waitForUnlocked}.
     */
    get locked(): boolean;
    /**
     * Return the model as a JSON object.
     */
    toJSON(): {
        [key: string]: any;
    };
    /**
     * Wait for the model to be unlocked.
     *
     * @param maxTimeMillis - The maximum time in milliseconds to wait.
     *     If not specified, a default maximum of 2 minutes is used.
     *
     * @returns A promise that resolves when the model is unlocked
     *   or the maximum wait time has passed.
     */
    waitForUnlocked(maxTimeMillis?: number): Promise<void>;
    private static validateAndClone;
}
