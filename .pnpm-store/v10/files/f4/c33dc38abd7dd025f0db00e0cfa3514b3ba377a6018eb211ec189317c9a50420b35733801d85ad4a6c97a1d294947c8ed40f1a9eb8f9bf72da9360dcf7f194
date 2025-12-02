"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const utils_1 = require("../utils");
exports.RULE_NAME = 'no-test-id-queries';
const QUERIES_REGEX = `/^(${utils_1.ALL_QUERIES_VARIANTS.join('|')})TestId$/`;
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Ensure no `data-testid` queries are used',
            recommendedConfig: {
                dom: false,
                angular: false,
                react: false,
                vue: false,
                svelte: false,
                marko: false,
            },
        },
        messages: {
            noTestIdQueries: 'Using `data-testid` queries is not recommended. Use a more descriptive query instead.',
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        return {
            [`CallExpression[callee.property.name=${QUERIES_REGEX}], CallExpression[callee.name=${QUERIES_REGEX}]`](node) {
                context.report({
                    node,
                    messageId: 'noTestIdQueries',
                });
            },
        };
    },
});
