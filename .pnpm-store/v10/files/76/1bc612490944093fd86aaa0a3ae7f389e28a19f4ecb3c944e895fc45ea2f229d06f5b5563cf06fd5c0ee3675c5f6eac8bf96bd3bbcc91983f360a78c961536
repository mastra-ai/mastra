"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnsServiceExtension = void 0;
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
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const MessageAttributes_1 = require("./MessageAttributes");
class SnsServiceExtension {
    requestPreSpanHook(request, _config) {
        let spanKind = api_1.SpanKind.CLIENT;
        let spanName = `SNS ${request.commandName}`;
        const spanAttributes = {
            [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'aws.sns',
        };
        if (request.commandName === 'Publish') {
            spanKind = api_1.SpanKind.PRODUCER;
            spanAttributes[semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION_KIND] =
                semantic_conventions_1.MESSAGINGDESTINATIONKINDVALUES_TOPIC;
            const { TopicArn, TargetArn, PhoneNumber } = request.commandInput;
            spanAttributes[semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION] =
                this.extractDestinationName(TopicArn, TargetArn, PhoneNumber);
            // ToDO: Use SEMATTRS_MESSAGING_DESTINATION_NAME when implemented
            spanAttributes['messaging.destination.name'] =
                TopicArn || TargetArn || PhoneNumber || 'unknown';
            spanName = `${PhoneNumber
                ? 'phone_number'
                : spanAttributes[semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]} send`;
        }
        return {
            isIncoming: false,
            spanAttributes,
            spanKind,
            spanName,
        };
    }
    requestPostSpanHook(request) {
        var _a;
        if (request.commandName === 'Publish') {
            const origMessageAttributes = (_a = request.commandInput['MessageAttributes']) !== null && _a !== void 0 ? _a : {};
            if (origMessageAttributes) {
                request.commandInput['MessageAttributes'] = (0, MessageAttributes_1.injectPropagationContext)(origMessageAttributes);
            }
        }
    }
    responseHook(response, span, tracer, config) { }
    extractDestinationName(topicArn, targetArn, phoneNumber) {
        if (topicArn || targetArn) {
            const arn = topicArn !== null && topicArn !== void 0 ? topicArn : targetArn;
            try {
                return arn.substring(arn.lastIndexOf(':') + 1);
            }
            catch (err) {
                return arn;
            }
        }
        else if (phoneNumber) {
            return phoneNumber;
        }
        else {
            return 'unknown';
        }
    }
}
exports.SnsServiceExtension = SnsServiceExtension;
//# sourceMappingURL=sns.js.map