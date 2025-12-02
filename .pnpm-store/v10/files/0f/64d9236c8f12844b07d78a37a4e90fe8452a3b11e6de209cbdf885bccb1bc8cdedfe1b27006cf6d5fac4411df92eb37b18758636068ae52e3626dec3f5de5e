/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

'use strict';
const { OpenSearchClientError } = require('../errors');

class AwsSigv4SignerError extends OpenSearchClientError {
  constructor(message, data) {
    super(message, data);
    Error.captureStackTrace(this, AwsSigv4SignerError);
    this.name = 'AwsSigv4SignerError';
    this.message = message || 'AwsSigv4Signer Error';
    this.data = data;
  }
}

module.exports = AwsSigv4SignerError;
