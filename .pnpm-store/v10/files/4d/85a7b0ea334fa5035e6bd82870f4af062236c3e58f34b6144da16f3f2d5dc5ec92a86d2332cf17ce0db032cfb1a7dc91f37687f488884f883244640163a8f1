"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
exports.RULE_NAME = 'prefer-presence-queries';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        docs: {
            description: 'Ensure appropriate `get*`/`query*` queries are used with their respective matchers',
            recommendedConfig: {
                dom: 'error',
                angular: 'error',
                react: 'error',
                vue: 'error',
                svelte: 'error',
                marko: 'error',
            },
        },
        messages: {
            wrongPresenceQuery: 'Use `getBy*` queries rather than `queryBy*` for checking element is present',
            wrongAbsenceQuery: 'Use `queryBy*` queries rather than `getBy*` for checking element is NOT present',
        },
        fixable: 'code',
        schema: [
            {
                type: 'object',
                additionalProperties: false,
                properties: {
                    presence: {
                        type: 'boolean',
                    },
                    absence: {
                        type: 'boolean',
                    },
                },
            },
        ],
        type: 'suggestion',
    },
    defaultOptions: [
        {
            presence: true,
            absence: true,
        },
    ],
    create(context, [{ absence = true, presence = true }], helpers) {
        return {
            'CallExpression Identifier'(node) {
                const expectCallNode = (0, node_utils_1.findClosestCallNode)(node, 'expect');
                const withinCallNode = (0, node_utils_1.findClosestCallNode)(node, 'within');
                if (!(0, node_utils_1.isMemberExpression)(expectCallNode === null || expectCallNode === void 0 ? void 0 : expectCallNode.parent)) {
                    return;
                }
                if (!helpers.isSyncQuery(node)) {
                    return;
                }
                const isPresenceQuery = helpers.isGetQueryVariant(node);
                const expectStatement = expectCallNode.parent;
                const isPresenceAssert = helpers.isPresenceAssert(expectStatement);
                const isAbsenceAssert = helpers.isAbsenceAssert(expectStatement);
                if (!isPresenceAssert && !isAbsenceAssert) {
                    return;
                }
                if (presence &&
                    (withinCallNode || isPresenceAssert) &&
                    !isPresenceQuery) {
                    const newQueryName = node.name.replace(/^query/, 'get');
                    context.report({
                        node,
                        messageId: 'wrongPresenceQuery',
                        fix: (fixer) => fixer.replaceText(node, newQueryName),
                    });
                }
                else if (!withinCallNode &&
                    absence &&
                    isAbsenceAssert &&
                    isPresenceQuery) {
                    const newQueryName = node.name.replace(/^get/, 'query');
                    context.report({
                        node,
                        messageId: 'wrongAbsenceQuery',
                        fix: (fixer) => fixer.replaceText(node, newQueryName),
                    });
                }
            },
        };
    },
});
