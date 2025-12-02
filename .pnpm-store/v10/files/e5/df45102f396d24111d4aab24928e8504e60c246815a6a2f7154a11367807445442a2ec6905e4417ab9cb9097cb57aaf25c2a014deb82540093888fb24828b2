"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_1 = require("../utils");
exports.RULE_NAME = 'no-wait-for-multiple-assertions';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallow the use of multiple `expect` calls inside `waitFor`',
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
            noWaitForMultipleAssertion: 'Avoid using multiple assertions within `waitFor` callback',
        },
        schema: [],
        fixable: 'code',
    },
    defaultOptions: [],
    create(context, _, helpers) {
        function getExpectNodes(body) {
            return body.filter((node) => {
                const expressionIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(node);
                if (!expressionIdentifier) {
                    return false;
                }
                return expressionIdentifier.name === 'expect';
            });
        }
        function getExpectArgument(expression) {
            if (!(0, node_utils_1.isCallExpression)(expression)) {
                return null;
            }
            const { callee } = expression;
            if (!(0, node_utils_1.isMemberExpression)(callee)) {
                return null;
            }
            const { object } = callee;
            if (!(0, node_utils_1.isCallExpression)(object) || object.arguments.length === 0) {
                return null;
            }
            return object.arguments[0];
        }
        function reportMultipleAssertion(node) {
            var _a;
            if (!node.parent) {
                return;
            }
            const callExpressionNode = node.parent.parent;
            const callExpressionIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(callExpressionNode);
            if (!callExpressionIdentifier) {
                return;
            }
            if (!helpers.isAsyncUtil(callExpressionIdentifier, ['waitFor'])) {
                return;
            }
            const expectNodes = getExpectNodes(node.body);
            const expectArgumentMap = new Map();
            for (const expectNode of expectNodes) {
                const argument = getExpectArgument(expectNode.expression);
                if (!argument) {
                    continue;
                }
                const argumentText = (0, utils_1.getSourceCode)(context).getText(argument);
                const existingNodes = (_a = expectArgumentMap.get(argumentText)) !== null && _a !== void 0 ? _a : [];
                const newTargetNodes = [...existingNodes, expectNode];
                expectArgumentMap.set(argumentText, newTargetNodes);
            }
            for (const expressionStatements of expectArgumentMap.values()) {
                for (const expressionStatement of expressionStatements.slice(1)) {
                    context.report({
                        node: expressionStatement,
                        messageId: 'noWaitForMultipleAssertion',
                        fix(fixer) {
                            var _a, _b;
                            const sourceCode = (0, utils_1.getSourceCode)(context);
                            const lineStart = sourceCode.getIndexFromLoc({
                                line: expressionStatement.loc.start.line,
                                column: 0,
                            });
                            const lineEnd = sourceCode.getIndexFromLoc({
                                line: expressionStatement.loc.end.line + 1,
                                column: 0,
                            });
                            const lines = sourceCode.getText().split('\n');
                            const line = lines[callExpressionNode.loc.start.line - 1];
                            const indent = (_b = (_a = line.match(/^\s*/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
                            const expressionStatementLines = lines.slice(expressionStatement.loc.start.line - 1, expressionStatement.loc.end.line);
                            const statementText = expressionStatementLines
                                .join('\n')
                                .trimStart();
                            return [
                                fixer.removeRange([lineStart, lineEnd]),
                                fixer.insertTextAfter(callExpressionNode, `\n${indent}${statementText}`),
                            ];
                        },
                    });
                }
            }
        }
        return {
            'CallExpression > ArrowFunctionExpression > BlockStatement': reportMultipleAssertion,
            'CallExpression > FunctionExpression > BlockStatement': reportMultipleAssertion,
        };
    },
});
