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
exports.Model = exports.MachineLearning = void 0;
const index_1 = require("../storage/index");
const error_1 = require("../utils/error");
const validator = require("../utils/validator");
const deep_copy_1 = require("../utils/deep-copy");
const utils = require("../utils");
const machine_learning_api_client_1 = require("./machine-learning-api-client");
const machine_learning_utils_1 = require("./machine-learning-utils");
/**
 * The Firebase `MachineLearning` service interface.
 */
class MachineLearning {
    /**
     * @param app - The app for this ML service.
     * @constructor
     * @internal
     */
    constructor(app) {
        if (!validator.isNonNullObject(app) || !('options' in app)) {
            throw new error_1.FirebaseError({
                code: 'machine-learning/invalid-argument',
                message: 'First argument passed to admin.machineLearning() must be a ' +
                    'valid Firebase app instance.',
            });
        }
        this.appInternal = app;
        this.client = new machine_learning_api_client_1.MachineLearningApiClient(app);
    }
    /**
     *  The {@link firebase-admin.app#App} associated with the current `MachineLearning`
     *  service instance.
     */
    get app() {
        return this.appInternal;
    }
    /**
     * Creates a model in the current Firebase project.
     *
     * @param model - The model to create.
     *
     * @returns A Promise fulfilled with the created model.
     */
    createModel(model) {
        return this.signUrlIfPresent(model)
            .then((modelContent) => this.client.createModel(modelContent))
            .then((operation) => this.client.handleOperation(operation))
            .then((modelResponse) => new Model(modelResponse, this.client));
    }
    /**
     * Updates a model's metadata or model file.
     *
     * @param modelId - The ID of the model to update.
     * @param model - The model fields to update.
     *
     * @returns A Promise fulfilled with the updated model.
     */
    updateModel(modelId, model) {
        const updateMask = utils.generateUpdateMask(model);
        return this.signUrlIfPresent(model)
            .then((modelContent) => this.client.updateModel(modelId, modelContent, updateMask))
            .then((operation) => this.client.handleOperation(operation))
            .then((modelResponse) => new Model(modelResponse, this.client));
    }
    /**
     * Publishes a Firebase ML model.
     *
     * A published model can be downloaded to client apps.
     *
     * @param modelId - The ID of the model to publish.
     *
     * @returns A Promise fulfilled with the published model.
     */
    publishModel(modelId) {
        return this.setPublishStatus(modelId, true);
    }
    /**
     * Unpublishes a Firebase ML model.
     *
     * @param modelId - The ID of the model to unpublish.
     *
     * @returns A Promise fulfilled with the unpublished model.
     */
    unpublishModel(modelId) {
        return this.setPublishStatus(modelId, false);
    }
    /**
     * Gets the model specified by the given ID.
     *
     * @param modelId - The ID of the model to get.
     *
     * @returns A Promise fulfilled with the model object.
     */
    getModel(modelId) {
        return this.client.getModel(modelId)
            .then((modelResponse) => new Model(modelResponse, this.client));
    }
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
    listModels(options = {}) {
        return this.client.listModels(options)
            .then((resp) => {
            if (!validator.isNonNullObject(resp)) {
                throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', `Invalid ListModels response: ${JSON.stringify(resp)}`);
            }
            let models = [];
            if (resp.models) {
                models = resp.models.map((rs) => new Model(rs, this.client));
            }
            const result = { models };
            if (resp.nextPageToken) {
                result.pageToken = resp.nextPageToken;
            }
            return result;
        });
    }
    /**
     * Deletes a model from the current project.
     *
     * @param modelId - The ID of the model to delete.
     */
    deleteModel(modelId) {
        return this.client.deleteModel(modelId);
    }
    setPublishStatus(modelId, publish) {
        const updateMask = ['state.published'];
        const options = { state: { published: publish } };
        return this.client.updateModel(modelId, options, updateMask)
            .then((operation) => this.client.handleOperation(operation))
            .then((modelResponse) => new Model(modelResponse, this.client));
    }
    signUrlIfPresent(options) {
        const modelOptions = (0, deep_copy_1.deepCopy)(options);
        if ((0, machine_learning_api_client_1.isGcsTfliteModelOptions)(modelOptions)) {
            return this.signUrl(modelOptions.tfliteModel.gcsTfliteUri)
                .then((uri) => {
                modelOptions.tfliteModel.gcsTfliteUri = uri;
                return modelOptions;
            })
                .catch((err) => {
                throw new machine_learning_utils_1.FirebaseMachineLearningError('internal-error', `Error during signing upload url: ${err.message}`);
            });
        }
        return Promise.resolve(modelOptions);
    }
    signUrl(unsignedUrl) {
        const MINUTES_IN_MILLIS = 60 * 1000;
        const URL_VALID_DURATION = 10 * MINUTES_IN_MILLIS;
        const gcsRegex = /^gs:\/\/([a-z0-9_.-]{3,63})\/(.+)$/;
        const matches = gcsRegex.exec(unsignedUrl);
        if (!matches) {
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-argument', `Invalid unsigned url: ${unsignedUrl}`);
        }
        const bucketName = matches[1];
        const blobName = matches[2];
        const bucket = (0, index_1.getStorage)(this.app).bucket(bucketName);
        const blob = bucket.file(blobName);
        return blob.getSignedUrl({
            action: 'read',
            expires: Date.now() + URL_VALID_DURATION,
        }).then((signUrl) => signUrl[0]);
    }
}
exports.MachineLearning = MachineLearning;
/**
 * A Firebase ML Model output object.
 */
class Model {
    /**
     * @internal
     */
    constructor(model, client) {
        this.model = Model.validateAndClone(model);
        this.client = client;
    }
    /** The ID of the model. */
    get modelId() {
        return extractModelId(this.model.name);
    }
    /**
     * The model's name. This is the name you use from your app to load the
     * model.
     */
    get displayName() {
        return this.model.displayName;
    }
    /**
     * The model's tags, which can be used to group or filter models in list
     * operations.
     */
    get tags() {
        return this.model.tags || [];
    }
    /** The timestamp of the model's creation. */
    get createTime() {
        return new Date(this.model.createTime).toUTCString();
    }
    /** The timestamp of the model's most recent update. */
    get updateTime() {
        return new Date(this.model.updateTime).toUTCString();
    }
    /** Error message when model validation fails. */
    get validationError() {
        return this.model.state?.validationError?.message;
    }
    /** True if the model is published. */
    get published() {
        return this.model.state?.published || false;
    }
    /**
     * The ETag identifier of the current version of the model. This value
     * changes whenever you update any of the model's properties.
     */
    get etag() {
        return this.model.etag;
    }
    /**
     * The hash of the model's `tflite` file. This value changes only when
     * you upload a new TensorFlow Lite model.
     */
    get modelHash() {
        return this.model.modelHash;
    }
    /** Metadata about the model's TensorFlow Lite model file. */
    get tfliteModel() {
        // Make a copy so people can't directly modify the private this.model object.
        return (0, deep_copy_1.deepCopy)(this.model.tfliteModel);
    }
    /**
     * True if the model is locked by a server-side operation. You can't make
     * changes to a locked model. See {@link Model.waitForUnlocked}.
     */
    get locked() {
        return (this.model.activeOperations?.length ?? 0) > 0;
    }
    /**
     * Return the model as a JSON object.
     */
    toJSON() {
        // We can't just return this.model because it has extra fields and
        // different formats etc. So we build the expected model object.
        const jsonModel = {
            modelId: this.modelId,
            displayName: this.displayName,
            tags: this.tags,
            createTime: this.createTime,
            updateTime: this.updateTime,
            published: this.published,
            etag: this.etag,
            locked: this.locked,
        };
        // Also add possibly undefined fields if they exist.
        if (this.validationError) {
            jsonModel['validationError'] = this.validationError;
        }
        if (this.modelHash) {
            jsonModel['modelHash'] = this.modelHash;
        }
        if (this.tfliteModel) {
            jsonModel['tfliteModel'] = this.tfliteModel;
        }
        return jsonModel;
    }
    /**
     * Wait for the model to be unlocked.
     *
     * @param maxTimeMillis - The maximum time in milliseconds to wait.
     *     If not specified, a default maximum of 2 minutes is used.
     *
     * @returns A promise that resolves when the model is unlocked
     *   or the maximum wait time has passed.
     */
    waitForUnlocked(maxTimeMillis) {
        if ((this.model.activeOperations?.length ?? 0) > 0) {
            // The client will always be defined on Models that have activeOperations
            // because models with active operations came back from the server and
            // were constructed with a non-empty client.
            return this.client.handleOperation(this.model.activeOperations[0], { wait: true, maxTimeMillis })
                .then((modelResponse) => {
                this.model = Model.validateAndClone(modelResponse);
            });
        }
        return Promise.resolve();
    }
    static validateAndClone(model) {
        if (!validator.isNonNullObject(model) ||
            !validator.isNonEmptyString(model.name) ||
            !validator.isNonEmptyString(model.createTime) ||
            !validator.isNonEmptyString(model.updateTime) ||
            !validator.isNonEmptyString(model.displayName) ||
            !validator.isNonEmptyString(model.etag)) {
            throw new machine_learning_utils_1.FirebaseMachineLearningError('invalid-server-response', `Invalid Model response: ${JSON.stringify(model)}`);
        }
        const tmpModel = (0, deep_copy_1.deepCopy)(model);
        // If tflite Model is specified, it must have a source of {gcsTfliteUri}
        if (model.tfliteModel &&
            !validator.isNonEmptyString(model.tfliteModel.gcsTfliteUri)) {
            // If we have some other source, ignore the whole tfliteModel.
            delete tmpModel.tfliteModel;
        }
        // Remove '@type' field. We don't need it.
        if (tmpModel['@type']) {
            delete tmpModel['@type'];
        }
        return tmpModel;
    }
}
exports.Model = Model;
function extractModelId(resourceName) {
    return resourceName.split('/').pop();
}
