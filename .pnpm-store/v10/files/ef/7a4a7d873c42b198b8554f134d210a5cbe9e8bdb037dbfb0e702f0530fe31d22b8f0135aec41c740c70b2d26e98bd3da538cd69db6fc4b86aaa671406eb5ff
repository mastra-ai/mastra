"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_1 = require("../utils");
exports.RULE_NAME = 'no-await-sync-queries';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow unnecessary `await` for sync queries',
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
            noAwaitSyncQuery: '`{{ name }}` query is sync so it does not need to be awaited',
        },
        schema: [],
        fixable: 'code',
    },
    defaultOptions: [],
    create(context, _, helpers) {
        return {
            'AwaitExpression > CallExpression'(node) {
                const awaitExpression = node.parent;
                const deepestIdentifierNode = (0, node_utils_1.getDeepestIdentifierNode)(node);
                if (!deepestIdentifierNode) {
                    return;
                }
                if (helpers.isSyncQuery(deepestIdentifierNode)) {
                    context.report({
                        node: deepestIdentifierNode,
                        messageId: 'noAwaitSyncQuery',
                        data: {
                            name: deepestIdentifierNode.name,
                        },
                        fix: (fixer) => {
                            const awaitToken = (0, utils_1.getSourceCode)(context).getFirstToken(awaitExpression);
                            return awaitToken ? fixer.remove(awaitToken) : null;
                        },
                    });
                }
            },
        };
    },
});
