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

class OpenSearchClientError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OpenSearchClientError';
  }
}

class TimeoutError extends OpenSearchClientError {
  constructor(message, meta) {
    super(message);
    Error.captureStackTrace(this, TimeoutError);
    this.name = 'TimeoutError';
    this.message = message || 'Timeout Error';
    this.meta = meta;
  }
}

class ConnectionError extends OpenSearchClientError {
  constructor(message, meta) {
    super(message);
    Error.captureStackTrace(this, ConnectionError);
    this.name = 'ConnectionError';
    this.message = message || 'Connection Error';
    this.meta = meta;
  }
}

class NoLivingConnectionsError extends OpenSearchClientError {
  constructor(message, meta) {
    super(message);
    Error.captureStackTrace(this, NoLivingConnectionsError);
    this.name = 'NoLivingConnectionsError';
    this.message =
      message ||
      'Given the configuration, the ConnectionPool was not able to find a usable Connection for this request.';
    this.meta = meta;
  }
}

class SerializationError extends OpenSearchClientError {
  constructor(message, data) {
    super(message);
    Error.captureStackTrace(this, SerializationError);
    this.name = 'SerializationError';
    this.message = message || 'Serialization Error';
    this.data = data;
  }
}

class DeserializationError extends OpenSearchClientError {
  constructor(message, data) {
    super(message);
    Error.captureStackTrace(this, DeserializationError);
    this.name = 'DeserializationError';
    this.message = message || 'Deserialization Error';
    this.data = data;
  }
}

class ConfigurationError extends OpenSearchClientError {
  constructor(message) {
    super(message);
    Error.captureStackTrace(this, ConfigurationError);
    this.name = 'ConfigurationError';
    this.message = message || 'Configuration Error';
  }
}

class ResponseError extends OpenSearchClientError {
  constructor(meta) {
    super('Response Error');
    Error.captureStackTrace(this, ResponseError);
    this.name = 'ResponseError';
    if (meta.body && meta.body.error && meta.body.error.type) {
      if (Array.isArray(meta.body.error.root_cause)) {
        this.message = meta.body.error.type + ': ';
        this.message += meta.body.error.root_cause
          .map((entry) => `[${entry.type}] Reason: ${entry.reason}`)
          .join('; ');
      } else {
        this.message = meta.body.error.type;
      }
    } else {
      this.message = 'Response Error';
    }
    this.meta = meta;
  }

  get body() {
    return this.meta.body;
  }

  get statusCode() {
    if (this.meta.body && typeof this.meta.body.status === 'number') {
      return this.meta.body.status;
    }
    return this.meta.statusCode;
  }

  get headers() {
    return this.meta.headers;
  }

  toString() {
    return JSON.stringify(this.meta.body);
  }
}

class RequestAbortedError extends OpenSearchClientError {
  constructor(message, meta) {
    super(message);
    Error.captureStackTrace(this, RequestAbortedError);
    this.name = 'RequestAbortedError';
    this.message = message || 'Request aborted';
    this.meta = meta;
  }
}

class NotCompatibleError extends OpenSearchClientError {
  constructor(meta) {
    super('Not Compatible Error');
    Error.captureStackTrace(this, NotCompatibleError);
    this.name = 'NotCompatibleError';
    this.message = 'The client noticed that the server is not a supported distribution';
    this.meta = meta;
  }
}

module.exports = {
  OpenSearchClientError,
  TimeoutError,
  ConnectionError,
  NoLivingConnectionsError,
  SerializationError,
  DeserializationError,
  ConfigurationError,
  ResponseError,
  RequestAbortedError,
  NotCompatibleError,
};
