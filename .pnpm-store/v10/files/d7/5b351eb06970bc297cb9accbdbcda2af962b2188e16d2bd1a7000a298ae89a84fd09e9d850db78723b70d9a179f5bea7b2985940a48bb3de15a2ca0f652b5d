"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPropagationFieldsToAttributeNames = exports.extractPropagationContext = exports.injectPropagationContext = exports.contextGetter = exports.contextSetter = exports.MAX_MESSAGE_ATTRIBUTES = void 0;
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
// https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-quotas.html
exports.MAX_MESSAGE_ATTRIBUTES = 10;
class ContextSetter {
    set(carrier, key, value) {
        carrier[key] = {
            DataType: 'String',
            StringValue: value,
        };
    }
}
exports.contextSetter = new ContextSetter();
class ContextGetter {
    keys(carrier) {
        if (carrier == null) {
            return [];
        }
        return Object.keys(carrier);
    }
    get(carrier, key) {
        var _a, _b;
        return ((_a = carrier === null || carrier === void 0 ? void 0 : carrier[key]) === null || _a === void 0 ? void 0 : _a.StringValue) || ((_b = carrier === null || carrier === void 0 ? void 0 : carrier[key]) === null || _b === void 0 ? void 0 : _b.Value);
    }
}
exports.contextGetter = new ContextGetter();
const injectPropagationContext = (attributesMap) => {
    const attributes = attributesMap !== null && attributesMap !== void 0 ? attributesMap : {};
    if (Object.keys(attributes).length + api_1.propagation.fields().length <=
        exports.MAX_MESSAGE_ATTRIBUTES) {
        api_1.propagation.inject(api_1.context.active(), attributes, exports.contextSetter);
    }
    else {
        api_1.diag.warn('aws-sdk instrumentation: cannot set context propagation on SQS/SNS message due to maximum amount of MessageAttributes');
    }
    return attributes;
};
exports.injectPropagationContext = injectPropagationContext;
const extractPropagationContext = (message, sqsExtractContextPropagationFromPayload) => {
    const propagationFields = api_1.propagation.fields();
    const hasPropagationFields = Object.keys(message.MessageAttributes || []).some(attr => propagationFields.includes(attr));
    if (hasPropagationFields) {
        return message.MessageAttributes;
    }
    else if (sqsExtractContextPropagationFromPayload && message.Body) {
        try {
            const payload = JSON.parse(message.Body);
            return payload.MessageAttributes;
        }
        catch (_a) {
            api_1.diag.debug('failed to parse SQS payload to extract context propagation, trace might be incomplete.');
        }
    }
    return undefined;
};
exports.extractPropagationContext = extractPropagationContext;
const addPropagationFieldsToAttributeNames = (messageAttributeNames = [], propagationFields) => {
    return messageAttributeNames.length
        ? Array.from(new Set([...messageAttributeNames, ...propagationFields]))
        : propagationFields;
};
exports.addPropagationFieldsToAttributeNames = addPropagationFieldsToAttributeNames;
//# sourceMappingURL=MessageAttributes.js.map