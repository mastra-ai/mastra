"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const adapters_js_1 = require("./io/adapters.js");
const builder_js_1 = require("./builder.js");
const reader_js_1 = require("./ipc/reader.js");
const writer_js_1 = require("./ipc/writer.js");
const iterable_js_1 = require("./io/node/iterable.js");
const builder_js_2 = require("./io/node/builder.js");
const reader_js_2 = require("./io/node/reader.js");
const writer_js_2 = require("./io/node/writer.js");
adapters_js_1.default.toNodeStream = iterable_js_1.toNodeStream;
builder_js_1.Builder['throughNode'] = builder_js_2.builderThroughNodeStream;
reader_js_1.RecordBatchReader['throughNode'] = reader_js_2.recordBatchReaderThroughNodeStream;
writer_js_1.RecordBatchWriter['throughNode'] = writer_js_2.recordBatchWriterThroughNodeStream;
tslib_1.__exportStar(require("./Arrow.dom.js"), exports);

//# sourceMappingURL=Arrow.node.js.map
