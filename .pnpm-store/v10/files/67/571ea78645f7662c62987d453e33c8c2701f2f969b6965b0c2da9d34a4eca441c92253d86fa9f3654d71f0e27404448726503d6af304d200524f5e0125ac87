"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const add_async_to_function_fix_1 = require("../utils/add-async-to-function-fix");
exports.RULE_NAME = 'await-async-queries';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce promises from async queries to be handled',
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
            awaitAsyncQuery: 'promise returned from `{{ name }}` query must be handled',
            asyncQueryWrapper: 'promise returned from `{{ name }}` wrapper over async query must be handled',
        },
        fixable: 'code',
        schema: [],
    },
    defaultOptions: [],
    create(context, _, helpers) {
        const functionWrappersNames = [];
        function detectAsyncQueryWrapper(node) {
            const innerFunction = (0, node_utils_1.getInnermostReturningFunction)(context, node);
            if (innerFunction) {
                functionWrappersNames.push((0, node_utils_1.getFunctionName)(innerFunction));
            }
        }
        return {
            CallExpression(node) {
                const identifierNode = (0, node_utils_1.getDeepestIdentifierNode)(node);
                if (!identifierNode) {
                    return;
                }
                if (helpers.isAsyncQuery(identifierNode)) {
                    detectAsyncQueryWrapper(identifierNode);
                    const closestCallExpressionNode = (0, node_utils_1.findClosestCallExpressionNode)(node, true);
                    if (!(closestCallExpressionNode === null || closestCallExpressionNode === void 0 ? void 0 : closestCallExpressionNode.parent)) {
                        return;
                    }
                    const references = (0, node_utils_1.getVariableReferences)(context, closestCallExpressionNode.parent);
                    if (references.length === 0) {
                        if (!(0, node_utils_1.isPromiseHandled)(identifierNode)) {
                            context.report({
                                node: identifierNode,
                                messageId: 'awaitAsyncQuery',
                                data: { name: identifierNode.name },
                                fix: (fixer) => {
                                    if ((0, node_utils_1.isMemberExpression)(identifierNode.parent) &&
                                        utils_1.ASTUtils.isIdentifier(identifierNode.parent.object)) {
                                        return fixer.insertTextBefore(identifierNode.parent, 'await ');
                                    }
                                    return fixer.insertTextBefore(identifierNode, 'await ');
                                },
                            });
                            return;
                        }
                    }
                    for (const reference of references) {
                        if (utils_1.ASTUtils.isIdentifier(reference.identifier) &&
                            !(0, node_utils_1.isPromiseHandled)(reference.identifier)) {
                            context.report({
                                node: identifierNode,
                                messageId: 'awaitAsyncQuery',
                                data: { name: identifierNode.name },
                                fix: (fixer) => references.map((ref) => fixer.insertTextBefore(ref.identifier, 'await ')),
                            });
                            return;
                        }
                    }
                }
                else if (functionWrappersNames.includes(identifierNode.name) &&
                    !(0, node_utils_1.isPromiseHandled)(identifierNode)) {
                    context.report({
                        node: identifierNode,
                        messageId: 'asyncQueryWrapper',
                        data: { name: identifierNode.name },
                        fix: (fixer) => {
                            const functionExpression = (0, node_utils_1.findClosestFunctionExpressionNode)(node);
                            if (!functionExpression)
                                return null;
                            let IdentifierNodeFixer;
                            if ((0, node_utils_1.isMemberExpression)(identifierNode.parent)) {
                                IdentifierNodeFixer = fixer.insertTextBefore(identifierNode.parent, 'await ');
                            }
                            else {
                                IdentifierNodeFixer = fixer.insertTextBefore(identifierNode, 'await ');
                            }
                            return (0, add_async_to_function_fix_1.addAsyncToFunctionFix)(fixer, IdentifierNodeFixer, functionExpression);
                        },
                    });
                }
            },
        };
    },
});
