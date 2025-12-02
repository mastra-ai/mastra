/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

'use strict';

const result = { body: null, statusCode: null, headers: null, warnings: null };
const kConfigErr = Symbol('configuration error');

function noop() {}

function parsePathParam(param) {
  if (param == null || param === '') return null;
  return encodeURIComponent(param);
}

function handleMissingParam(param, apiModule, callback) {
  const err = new apiModule[kConfigErr]('Missing required parameter: ' + param);
  if (callback) {
    process.nextTick(callback, err, result);
    return { then: noop, catch: noop, abort: noop };
  }
  return Promise.reject(err);
}

function normalizeArguments(params, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof params === 'function' || params == null) {
    callback = params;
    params = {};
    options = {};
  }
  return [params, options, callback];
}

// function apiFunc (bindObj, cache, path) { // Used for lazy loading but not compatible with Webpack
//   return function (...args) {
//     if (!cache[path]) cache[path] = require(path).bind(bindObj);
//     return cache[path](...args);
//   }
// }

function logMemoryUsage(context = '') {
  const memoryUsage = process.memoryUsage();
  console.log(`Memory usage: ${context}
    RSS: ${Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100} MB
    Heap Total: ${Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100} MB
    Heap Used: ${Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100} MB
    External: ${Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100} MB`);
}

module.exports = {
  handleMissingParam,
  parsePathParam,
  normalizeArguments,
  noop,
  kConfigErr,
  logMemoryUsage,
};
