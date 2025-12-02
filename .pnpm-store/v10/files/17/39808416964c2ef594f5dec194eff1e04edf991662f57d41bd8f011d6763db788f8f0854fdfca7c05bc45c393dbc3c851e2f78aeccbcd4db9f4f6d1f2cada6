"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const pubsub_propagation_1 = require("../src/pubsub-propagation");
const contrib_test_utils_1 = require("@opentelemetry/contrib-test-utils");
const api_1 = require("@opentelemetry/api");
const expect_1 = require("expect");
(0, contrib_test_utils_1.registerInstrumentationTestingProvider)();
const tracer = api_1.trace.getTracer('test');
afterEach(() => {
    (0, contrib_test_utils_1.resetMemoryExporter)();
});
describe('Pubsub propagation', () => {
    it('Span ends immediately when the function returns a non-promise', () => {
        const messages = [{}];
        pubsub_propagation_1.default.patchMessagesArrayToStartProcessSpans({
            messages,
            tracer,
            parentContext: api_1.ROOT_CONTEXT,
            messageToSpanDetails: () => ({
                name: 'test',
                parentContext: api_1.ROOT_CONTEXT,
                attributes: {},
            }),
        });
        pubsub_propagation_1.default.patchArrayForProcessSpans(messages, tracer, api_1.ROOT_CONTEXT);
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(0);
        messages.map(x => x);
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(1);
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)()[0]).toMatchObject({ name: 'test process' });
    });
    it('Span ends on promise-resolution', () => {
        const messages = [{}];
        pubsub_propagation_1.default.patchMessagesArrayToStartProcessSpans({
            messages,
            tracer,
            parentContext: api_1.ROOT_CONTEXT,
            messageToSpanDetails: () => ({
                name: 'test',
                parentContext: api_1.ROOT_CONTEXT,
                attributes: {},
            }),
        });
        pubsub_propagation_1.default.patchArrayForProcessSpans(messages, tracer, api_1.ROOT_CONTEXT);
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(0);
        let resolve;
        messages.map(() => new Promise(res => {
            resolve = res;
        }));
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(0);
        // @ts-expect-error Typescript thinks this value is used before assignment
        resolve(undefined);
        // We use setTimeout here to make sure our assertions run
        // after the promise resolves
        return new Promise(res => setTimeout(res, 0)).then(() => {
            (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(1);
            (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)()[0]).toMatchObject({ name: 'test process' });
        });
    });
    it('Span ends on promise-rejection', () => {
        const messages = [{}];
        pubsub_propagation_1.default.patchMessagesArrayToStartProcessSpans({
            messages,
            tracer,
            parentContext: api_1.ROOT_CONTEXT,
            messageToSpanDetails: () => ({
                name: 'test',
                parentContext: api_1.ROOT_CONTEXT,
                attributes: {},
            }),
        });
        pubsub_propagation_1.default.patchArrayForProcessSpans(messages, tracer, api_1.ROOT_CONTEXT);
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(0);
        let reject;
        messages.map(() => new Promise((_, rej) => {
            reject = rej;
        }));
        (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(0);
        // @ts-expect-error Typescript thinks this value is used before assignment
        reject(new Error('Failed'));
        // We use setTimeout here to make sure our assertions run
        // after the promise resolves
        return new Promise(res => setTimeout(res, 0)).then(() => {
            (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)().length).toBe(1);
            (0, expect_1.expect)((0, contrib_test_utils_1.getTestSpans)()[0]).toMatchObject({ name: 'test process' });
        });
    });
});
//# sourceMappingURL=pubsub-propagation.test.js.map