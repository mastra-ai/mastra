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
exports.getMachineLearning = getMachineLearning;
/**
 * Firebase Machine Learning.
 *
 * @packageDocumentation
 */
const app_1 = require("../app");
const machine_learning_1 = require("./machine-learning");
var machine_learning_2 = require("./machine-learning");
Object.defineProperty(exports, "MachineLearning", { enumerable: true, get: function () { return machine_learning_2.MachineLearning; } });
Object.defineProperty(exports, "Model", { enumerable: true, get: function () { return machine_learning_2.Model; } });
/**
 * Gets the {@link MachineLearning} service for the default app or a given app.
 *
 * `getMachineLearning()` can be called with no arguments to access the
 * default app's `MachineLearning` service or as `getMachineLearning(app)` to access
 * the `MachineLearning` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the MachineLearning service for the default app
 * const defaultMachineLearning = getMachineLearning();
 * ```
 *
 * @example
 * ```javascript
 * // Get the MachineLearning service for a given app
 * const otherMachineLearning = getMachineLearning(otherApp);
 * ```
 *
 * @param app - Optional app whose `MachineLearning` service to
 *   return. If not provided, the default `MachineLearning` service
 *   will be returned.
 *
 * @returns The default `MachineLearning` service if no app is provided or the
 *   `MachineLearning` service associated with the provided app.
 */
function getMachineLearning(app) {
    if (typeof app === 'undefined') {
        app = (0, app_1.getApp)();
    }
    const firebaseApp = app;
    return firebaseApp.getOrInitService('machineLearning', (app) => new machine_learning_1.MachineLearning(app));
}
