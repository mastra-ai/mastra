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
 * Firebase Remote Config.
 *
 * @packageDocumentation
 */
import { App } from '../app';
import { RemoteConfig } from './remote-config';
export { AndCondition, CustomSignalCondition, CustomSignalOperator, DefaultConfig, EvaluationContext, ExplicitParameterValue, FetchResponseData, GetServerTemplateOptions, InAppDefaultValue, InitServerTemplateOptions, ListVersionsOptions, ListVersionsResult, MicroPercentRange, NamedCondition, OneOfCondition, OrCondition, ParameterValueType, PercentConditionOperator, PercentCondition, PredefinedSignals, RemoteConfigCondition, RemoteConfigParameter, RemoteConfigParameterGroup, RemoteConfigParameterValue, RemoteConfigTemplate, RemoteConfigUser, ServerConfig, ServerTemplate, ServerTemplateData, ServerTemplateDataType, TagColor, UserProvidedSignals, Value, ValueSource, Version, } from './remote-config-api';
export { RemoteConfig, RemoteConfigFetchResponse } from './remote-config';
/**
 * Gets the {@link RemoteConfig} service for the default app or a given app.
 *
 * `getRemoteConfig()` can be called with no arguments to access the default
 * app's `RemoteConfig` service or as `getRemoteConfig(app)` to access the
 * `RemoteConfig` service associated with a specific app.
 *
 * @example
 * ```javascript
 * // Get the `RemoteConfig` service for the default app
 * const defaultRemoteConfig = getRemoteConfig();
 * ```
 *
 * @example
 * ```javascript
 * // Get the `RemoteConfig` service for a given app
 * const otherRemoteConfig = getRemoteConfig(otherApp);
 * ```
 *
 * @param app - Optional app for which to return the `RemoteConfig` service.
 *   If not provided, the default `RemoteConfig` service is returned.
 *
 * @returns The default `RemoteConfig` service if no
 *   app is provided, or the `RemoteConfig` service associated with the provided
 *   app.
 */
export declare function getRemoteConfig(app?: App): RemoteConfig;
