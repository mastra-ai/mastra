"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqsServiceExtension = void 0;
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
const propagation_utils_1 = require("@opentelemetry/propagation-utils");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const MessageAttributes_1 = require("./MessageAttributes");
class SqsServiceExtension {
    constructor() {
        this.requestPostSpanHook = (request) => {
            var _a, _b;
            switch (request.commandName) {
                case 'SendMessage':
                    {
                        const origMessageAttributes = (_a = request.commandInput['MessageAttributes']) !== null && _a !== void 0 ? _a : {};
                        if (origMessageAttributes) {
                            request.commandInput['MessageAttributes'] =
                                (0, MessageAttributes_1.injectPropagationContext)(origMessageAttributes);
                        }
                    }
                    break;
                case 'SendMessageBatch':
                    {
                        const entries = (_b = request.commandInput) === null || _b === void 0 ? void 0 : _b.Entries;
                        if (Array.isArray(entries)) {
                            entries.forEach((messageParams) => {
                                var _a;
                                messageParams.MessageAttributes = (0, MessageAttributes_1.injectPropagationContext)((_a = messageParams.MessageAttributes) !== null && _a !== void 0 ? _a : {});
                            });
                        }
                    }
                    break;
            }
        };
        this.responseHook = (response, span, tracer, config) => {
            var _a, _b;
            switch (response.request.commandName) {
                case 'SendMessage':
                    span.setAttribute(semantic_conventions_1.SEMATTRS_MESSAGING_MESSAGE_ID, (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.MessageId);
                    break;
                case 'SendMessageBatch':
                    // TODO: How should this be handled?
                    break;
                case 'ReceiveMessage': {
                    const messages = (_b = response === null || response === void 0 ? void 0 : response.data) === null || _b === void 0 ? void 0 : _b.Messages;
                    if (messages) {
                        const queueUrl = this.extractQueueUrl(response.request.commandInput);
                        const queueName = this.extractQueueNameFromUrl(queueUrl);
                        propagation_utils_1.pubsubPropagation.patchMessagesArrayToStartProcessSpans({
                            messages,
                            parentContext: api_1.trace.setSpan(api_1.context.active(), span),
                            tracer,
                            messageToSpanDetails: (message) => ({
                                name: queueName !== null && queueName !== void 0 ? queueName : 'unknown',
                                parentContext: api_1.propagation.extract(api_1.ROOT_CONTEXT, (0, MessageAttributes_1.extractPropagationContext)(message, config.sqsExtractContextPropagationFromPayload), MessageAttributes_1.contextGetter),
                                attributes: {
                                    [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'aws.sqs',
                                    [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: queueName,
                                    [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION_KIND]: semantic_conventions_1.MESSAGINGDESTINATIONKINDVALUES_QUEUE,
                                    [semantic_conventions_1.SEMATTRS_MESSAGING_MESSAGE_ID]: message.MessageId,
                                    [semantic_conventions_1.SEMATTRS_MESSAGING_URL]: queueUrl,
                                    [semantic_conventions_1.SEMATTRS_MESSAGING_OPERATION]: semantic_conventions_1.MESSAGINGOPERATIONVALUES_PROCESS,
                                },
                            }),
                            processHook: (span, message) => { var _a; return (_a = config.sqsProcessHook) === null || _a === void 0 ? void 0 : _a.call(config, span, { message }); },
                        });
                        propagation_utils_1.pubsubPropagation.patchArrayForProcessSpans(messages, tracer, api_1.context.active());
                    }
                    break;
                }
            }
        };
        this.extractQueueUrl = (commandInput) => {
            return commandInput === null || commandInput === void 0 ? void 0 : commandInput.QueueUrl;
        };
        this.extractQueueNameFromUrl = (queueUrl) => {
            if (!queueUrl)
                return undefined;
            const segments = queueUrl.split('/');
            if (segments.length === 0)
                return undefined;
            return segments[segments.length - 1];
        };
    }
    requestPreSpanHook(request, _config) {
        const queueUrl = this.extractQueueUrl(request.commandInput);
        const queueName = this.extractQueueNameFromUrl(queueUrl);
        let spanKind = api_1.SpanKind.CLIENT;
        let spanName;
        const spanAttributes = {
            [semantic_conventions_1.SEMATTRS_MESSAGING_SYSTEM]: 'aws.sqs',
            [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION_KIND]: semantic_conventions_1.MESSAGINGDESTINATIONKINDVALUES_QUEUE,
            [semantic_conventions_1.SEMATTRS_MESSAGING_DESTINATION]: queueName,
            [semantic_conventions_1.SEMATTRS_MESSAGING_URL]: queueUrl,
        };
        let isIncoming = false;
        switch (request.commandName) {
            case 'ReceiveMessage':
                {
                    isIncoming = true;
                    spanKind = api_1.SpanKind.CONSUMER;
                    spanName = `${queueName} receive`;
                    spanAttributes[semantic_conventions_1.SEMATTRS_MESSAGING_OPERATION] =
                        semantic_conventions_1.MESSAGINGOPERATIONVALUES_RECEIVE;
                    request.commandInput.MessageAttributeNames =
                        (0, MessageAttributes_1.addPropagationFieldsToAttributeNames)(request.commandInput.MessageAttributeNames, api_1.propagation.fields());
                }
                break;
            case 'SendMessage':
            case 'SendMessageBatch':
                spanKind = api_1.SpanKind.PRODUCER;
                spanName = `${queueName} send`;
                break;
        }
        return {
            isIncoming,
            spanAttributes,
            spanKind,
            spanName,
        };
    }
}
exports.SqsServiceExtension = SqsServiceExtension;
//# sourceMappingURL=sqs.js.map