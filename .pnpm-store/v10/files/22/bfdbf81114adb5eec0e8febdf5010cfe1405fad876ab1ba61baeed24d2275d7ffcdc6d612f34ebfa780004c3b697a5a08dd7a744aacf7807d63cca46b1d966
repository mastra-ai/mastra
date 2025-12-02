"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaServiceExtension = void 0;
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
const api_2 = require("@opentelemetry/api");
class LambdaCommands {
}
LambdaCommands.Invoke = 'Invoke';
class LambdaServiceExtension {
    constructor() {
        this.requestPostSpanHook = (request) => {
            switch (request.commandName) {
                case LambdaCommands.Invoke:
                    {
                        if (request.commandInput) {
                            request.commandInput.ClientContext = injectLambdaPropagationContext(request.commandInput.ClientContext);
                        }
                    }
                    break;
            }
        };
        this.extractFunctionName = (commandInput) => {
            return commandInput === null || commandInput === void 0 ? void 0 : commandInput.FunctionName;
        };
    }
    requestPreSpanHook(request, _config) {
        const functionName = this.extractFunctionName(request.commandInput);
        let spanAttributes = {};
        let spanName;
        switch (request.commandName) {
            case 'Invoke':
                spanAttributes = {
                    [semantic_conventions_1.SEMATTRS_FAAS_INVOKED_NAME]: functionName,
                    [semantic_conventions_1.SEMATTRS_FAAS_INVOKED_PROVIDER]: 'aws',
                };
                if (request.region) {
                    spanAttributes[semantic_conventions_1.SEMATTRS_FAAS_INVOKED_REGION] = request.region;
                }
                spanName = `${functionName} ${LambdaCommands.Invoke}`;
                break;
        }
        return {
            isIncoming: false,
            spanAttributes,
            spanKind: api_1.SpanKind.CLIENT,
            spanName,
        };
    }
    responseHook(response, span, tracer, config) {
        switch (response.request.commandName) {
            case LambdaCommands.Invoke:
                {
                    span.setAttribute(semantic_conventions_1.SEMATTRS_FAAS_EXECUTION, response.requestId);
                }
                break;
        }
    }
}
exports.LambdaServiceExtension = LambdaServiceExtension;
const injectLambdaPropagationContext = (clientContext) => {
    try {
        const propagatedContext = {};
        api_2.propagation.inject(api_2.context.active(), propagatedContext);
        const parsedClientContext = clientContext
            ? JSON.parse(Buffer.from(clientContext, 'base64').toString('utf8'))
            : {};
        const updatedClientContext = Object.assign(Object.assign({}, parsedClientContext), { Custom: Object.assign(Object.assign({}, parsedClientContext.Custom), propagatedContext) });
        const encodedClientContext = Buffer.from(JSON.stringify(updatedClientContext)).toString('base64');
        // The length of client context is capped at 3583 bytes of base64 encoded data
        // (https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html#API_Invoke_RequestSyntax)
        if (encodedClientContext.length > 3583) {
            api_1.diag.warn('lambda instrumentation: cannot set context propagation on lambda invoke parameters due to ClientContext length limitations.');
            return clientContext;
        }
        return encodedClientContext;
    }
    catch (e) {
        api_1.diag.debug('lambda instrumentation: failed to set context propagation on ClientContext', e);
        return clientContext;
    }
};
//# sourceMappingURL=lambda.js.map