// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import streamAdapters from './io/adapters.js';
import { Builder } from './builder.js';
import { RecordBatchReader } from './ipc/reader.js';
import { RecordBatchWriter } from './ipc/writer.js';
import { toNodeStream } from './io/node/iterable.js';
import { builderThroughNodeStream } from './io/node/builder.js';
import { recordBatchReaderThroughNodeStream } from './io/node/reader.js';
import { recordBatchWriterThroughNodeStream } from './io/node/writer.js';

streamAdapters.toNodeStream = toNodeStream;
Builder['throughNode'] = builderThroughNodeStream;
RecordBatchReader['throughNode'] = recordBatchReaderThroughNodeStream;
RecordBatchWriter['throughNode'] = recordBatchWriterThroughNodeStream;

export * from './Arrow.dom.js';
