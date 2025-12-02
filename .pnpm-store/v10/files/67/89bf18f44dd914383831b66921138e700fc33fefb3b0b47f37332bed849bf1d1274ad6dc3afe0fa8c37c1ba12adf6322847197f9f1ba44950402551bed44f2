"use strict";
// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.protos = exports.AdaptationClient = exports.SpeechClient = exports.v2 = exports.v1p1beta1 = exports.v1 = void 0;
const helpers_1 = require("./helpers");
const v1p1beta1 = require("./v1p1beta1");
exports.v1p1beta1 = v1p1beta1;
const v1 = require("./v1");
exports.v1 = v1;
const v2 = require("./v2");
exports.v2 = v2;
// The following code is adapted from http://www.typescriptlang.org/docs/handbook/mixins.html
// tslint:disable-next-line no-any
Object.defineProperty(v1.SpeechClient.prototype, 'streamingRecognize', Object.getOwnPropertyDescriptor(helpers_1.ImprovedStreamingClient.prototype, 'streamingRecognize'));
Object.defineProperty(v1p1beta1.SpeechClient.prototype, 'streamingRecognize', Object.getOwnPropertyDescriptor(helpers_1.ImprovedStreamingClient.prototype, 'streamingRecognize'));
Object.defineProperty(v2.SpeechClient.prototype, 'streamingRecognize', Object.getOwnPropertyDescriptor(helpers_1.ImprovedStreamingClient.prototype, 'streamingRecognize'));
const SpeechClient = v1.SpeechClient;
exports.SpeechClient = SpeechClient;
const AdaptationClient = v1.AdaptationClient;
exports.AdaptationClient = AdaptationClient;
// For compatibility with JavaScript libraries we need to provide this default export:
// tslint:disable-next-line no-default-export
exports.default = { v1, v1p1beta1, v2, SpeechClient, AdaptationClient };
const protos = require("../protos/protos");
exports.protos = protos;
//# sourceMappingURL=index.js.map