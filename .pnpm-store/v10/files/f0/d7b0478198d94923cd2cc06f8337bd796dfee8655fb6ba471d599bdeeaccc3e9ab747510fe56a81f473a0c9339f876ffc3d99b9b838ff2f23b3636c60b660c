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
import { ListModelsResult as TListModelsResult, MachineLearning as TMachineLearning, Model as TModel, TFLiteModel as TTFLiteModel } from './machine-learning';
import { GcsTfliteModelOptions as TGcsTfliteModelOptions, ListModelsOptions as TListModelsOptions, ModelOptions as TModelOptions, ModelOptionsBase as TModelOptionsBase } from './machine-learning-api-client';
/**
 * Gets the {@link firebase-admin.machine-learning#MachineLearning} service for the
 * default app or a given app.
 *
 * `admin.machineLearning()` can be called with no arguments to access the
 * default app's `MachineLearning` service or as `admin.machineLearning(app)` to access
 * the `MachineLearning` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the MachineLearning service for the default app
 * var defaultMachineLearning = admin.machineLearning();
 * ```
 *
 * @example
 * ```javascript
 * // Get the MachineLearning service for a given app
 * var otherMachineLearning = admin.machineLearning(otherApp);
 * ```
 *
 * @param app - Optional app whose `MachineLearning` service to
 *   return. If not provided, the default `MachineLearning` service
 *   will be returned.
 *
 * @returns The default `MachineLearning` service if no app is provided or the
 *   `MachineLearning` service associated with the provided app.
 */
export declare function machineLearning(app?: App): machineLearning.MachineLearning;
export declare namespace machineLearning {
    /**
     * Type alias to {@link firebase-admin.machine-learning#ListModelsResult}.
     */
    type ListModelsResult = TListModelsResult;
    /**
     * Type alias to {@link firebase-admin.machine-learning#MachineLearning}.
     */
    type MachineLearning = TMachineLearning;
    /**
     * Type alias to {@link firebase-admin.machine-learning#Model}.
     */
    type Model = TModel;
    /**
     * Type alias to {@link firebase-admin.machine-learning#TFLiteModel}.
     */
    type TFLiteModel = TTFLiteModel;
    /**
     * Type alias to {@link firebase-admin.machine-learning#GcsTfliteModelOptions}.
     */
    type GcsTfliteModelOptions = TGcsTfliteModelOptions;
    /**
     * Type alias to {@link firebase-admin.machine-learning#ListModelsOptions}.
     */
    type ListModelsOptions = TListModelsOptions;
    /**
     * Type alias to {@link firebase-admin.machine-learning#ModelOptions}.
     */
    type ModelOptions = TModelOptions;
    /**
     * Type alias to {@link firebase-admin.machine-learning#ModelOptionsBase}.
     */
    type ModelOptionsBase = TModelOptionsBase;
}
