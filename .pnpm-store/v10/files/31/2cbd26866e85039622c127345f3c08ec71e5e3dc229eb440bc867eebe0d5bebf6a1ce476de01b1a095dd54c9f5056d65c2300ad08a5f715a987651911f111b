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

const { Client } = require('./lib/Client');
const Transport = require('./lib/Transport');
const { ConnectionPool } = require('./lib/pool');
const Connection = require('./lib/Connection');
const Serializer = require('./lib/Serializer');
const errors = require('./lib/errors');

const events = {
  RESPONSE: 'response',
  REQUEST: 'request',
  SNIFF: 'sniff',
  RESURRECT: 'resurrect',
  SERIALIZATION: 'serialization',
  DESERIALIZATION: 'deserialization',
};

module.exports = {
  Client,
  Transport,
  ConnectionPool,
  Connection,
  Serializer,
  errors,
  events,
};
