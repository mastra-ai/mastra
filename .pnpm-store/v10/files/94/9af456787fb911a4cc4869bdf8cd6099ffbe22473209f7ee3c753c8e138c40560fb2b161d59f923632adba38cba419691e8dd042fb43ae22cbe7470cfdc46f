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

const { stringify } = require('querystring');
const debug = require('debug')('opensearch');
const sjson = require('secure-json-parse');
const { SerializationError, DeserializationError } = require('./errors');
const kJsonOptions = Symbol('secure json parse options');
const JSON11 = require('json11');

const isBigIntSupported = typeof BigInt !== 'undefined';

class Serializer {
  constructor(opts = {}) {
    const disable = opts.disablePrototypePoisoningProtection;
    this[kJsonOptions] = {
      protoAction: disable === true || disable === 'proto' ? 'ignore' : 'error',
      constructorAction: disable === true || disable === 'constructor' ? 'ignore' : 'error',
      enableLongNumeralSupport: opts.enableLongNumeralSupport === true,
    };
  }

  serialize(object) {
    debug('Serializing', object);
    let json;
    let numeralsAreNumbers = true;
    const checkForBigInts = (key, val) => {
      if (typeof val === 'bigint') {
        numeralsAreNumbers = false;
        // Number() is much faster than parseInt() on BigInt values
        return Number(val);
      }
      return val;
    };
    const shouldHandleLongNumerals =
      isBigIntSupported && this[kJsonOptions].enableLongNumeralSupport;
    try {
      /* When handling long numerals is not requested or the platform doesn't support BigInt, the
       * result of JSON.stringify are returned.
       *
       * When long numerals should be handled:
       *   Use JSON.stringify to check if any value is a BigInt:
       *   * If no BigInt values are found, the result of JSON.stringify is good enough to be returned.
       *   * Only If a BigInt value is found, JSON11.stringify is employed and its result is returned.
       */
      json = JSON.stringify(object, shouldHandleLongNumerals ? checkForBigInts : null);

      if (shouldHandleLongNumerals && !numeralsAreNumbers) {
        try {
          // With `withBigInt: false`, valid JSON is produced while maintaining accuracy
          const temp = JSON11.stringify(object, {
            withBigInt: false,
            quote: '"',
            quoteNames: true,
          });
          if (temp) json = temp;
        } catch (ex) {
          // Do nothing: JSON.stringify succeeded but JSON11.stringify failed; return the
          // JSON.stringify result.
        }
      }
    } catch (err) {
      throw new SerializationError(err.message, object);
    }
    return json;
  }

  deserialize(json) {
    debug('Deserializing', json);
    let object;
    let numeralsAreNumbers = true;
    const checkForLargeNumerals = (key, val) => {
      if (
        numeralsAreNumbers &&
        typeof val === 'number' &&
        (val < Number.MIN_SAFE_INTEGER || val > Number.MAX_SAFE_INTEGER)
      ) {
        numeralsAreNumbers = false;
      }

      return val;
    };
    const shouldHandleLongNumerals =
      isBigIntSupported && this[kJsonOptions].enableLongNumeralSupport;
    try {
      /* When handling long numerals is not requested or the platform doesn't support BigInt, the
       * result of sjson.parse are returned.
       *
       * When long numerals should be handled:
       *   Use sjson.parse to check if any value is outside the range of safe integers:
       *   * If no long numerals are found, the result of sjson.parse is good enough to be returned.
       *   * Only If long numerals are found, JSON11.parse is employed and its result is returned.
       */
      object = sjson.parse(
        json,
        shouldHandleLongNumerals ? checkForLargeNumerals : null,
        this[kJsonOptions]
      );

      if (shouldHandleLongNumerals && !numeralsAreNumbers) {
        try {
          const temp = JSON11.parse(json, null, { withLongNumerals: true });
          if (temp) {
            object = temp;
          }
        } catch (ex) {
          // Do nothing: sjson.parse succeeded but JSON11.parse failed; return the sjson.parse result
        }
      }
    } catch (err) {
      throw new DeserializationError(err.message, json);
    }
    return object;
  }

  ndserialize(array) {
    debug('ndserialize', array);
    if (Array.isArray(array) === false) {
      throw new SerializationError('The argument provided is not an array', array);
    }
    let ndjson = '';
    for (let i = 0, len = array.length; i < len; i++) {
      if (typeof array[i] === 'string') {
        ndjson += array[i] + '\n';
      } else {
        ndjson += this.serialize(array[i]) + '\n';
      }
    }
    return ndjson;
  }

  qserialize(object) {
    debug('qserialize', object);
    if (object == null) return '';
    if (typeof object === 'string') return object;
    // arrays should be serialized as comma separated list
    const keys = Object.keys(object);
    for (let i = 0, len = keys.length; i < len; i++) {
      const key = keys[i];
      // OpenSearch will complain about keys without a value
      if (object[key] === undefined) {
        delete object[key];
      } else if (Array.isArray(object[key]) === true) {
        object[key] = object[key].join(',');
      }
    }
    return stringify(object);
  }
}

module.exports = Serializer;
