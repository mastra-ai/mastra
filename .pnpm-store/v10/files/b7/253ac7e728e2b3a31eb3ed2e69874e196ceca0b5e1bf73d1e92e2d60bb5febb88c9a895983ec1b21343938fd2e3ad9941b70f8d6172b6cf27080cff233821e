"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KinesisServiceExtension = void 0;
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const api_1 = require("@opentelemetry/api");
const enums_1 = require("../enums");
class KinesisServiceExtension {
    requestPreSpanHook(request, _config) {
        var _a;
        const streamName = (_a = request.commandInput) === null || _a === void 0 ? void 0 : _a.StreamName;
        const spanKind = api_1.SpanKind.CLIENT;
        const spanAttributes = {};
        if (streamName) {
            spanAttributes[enums_1.AttributeNames.AWS_KINESIS_STREAM_NAME] = streamName;
        }
        const isIncoming = false;
        return {
            isIncoming,
            spanAttributes,
            spanKind,
        };
    }
}
exports.KinesisServiceExtension = KinesisServiceExtension;
//# sourceMappingURL=kinesis.js.map