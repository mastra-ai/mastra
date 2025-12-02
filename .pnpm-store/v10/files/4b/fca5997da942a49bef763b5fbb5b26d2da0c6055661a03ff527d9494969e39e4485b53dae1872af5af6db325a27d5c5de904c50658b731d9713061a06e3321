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

import Transport, {
  ApiError,
  ApiResponse,
} from './lib/Transport';
import Connection from './lib/Connection';
import {
  ConnectionPool,
  BaseConnectionPool,
  CloudConnectionPool,
  ResurrectEvent,
} from './lib/pool';
import Serializer from './lib/Serializer';
import * as errors from './lib/errors';
import * as API from './api';
import * as Types from './api/_types';
import { Client, ClientOptions, NodeOptions, ClientExtendsCallbackOptions } from './lib/Client';

declare const events: {
  SERIALIZATION: string;
  REQUEST: string;
  DESERIALIZATION: string;
  RESPONSE: string;
  SNIFF: string;
  RESURRECT: string;
};

export {
  API,
  Types,
  Client,
  Transport,
  ConnectionPool,
  BaseConnectionPool,
  CloudConnectionPool,
  Connection,
  Serializer,
  events,
  errors,
  ApiError,
  ApiResponse,
  ResurrectEvent,
  ClientOptions,
  NodeOptions,
  ClientExtendsCallbackOptions,
};
