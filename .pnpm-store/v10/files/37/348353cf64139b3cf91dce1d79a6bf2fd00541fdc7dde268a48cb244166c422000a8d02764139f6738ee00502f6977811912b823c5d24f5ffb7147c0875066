"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const ast_utils_1 = require("@typescript-eslint/utils/ast-utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_1 = require("../utils");
exports.RULE_NAME = 'no-wait-for-side-effects';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallow the use of side effects in `waitFor`',
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
            noSideEffectsWaitFor: 'Avoid using side effects within `waitFor` callback',
        },
        schema: [],
        fixable: 'code',
    },
    defaultOptions: [],
    create(context, _, helpers) {
        const sourceCode = (0, utils_1.getSourceCode)(context);
        function isCallerWaitFor(node) {
            if (!node.parent) {
                return false;
            }
            const callExpressionNode = node.parent.parent;
            const callExpressionIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(callExpressionNode);
            return (!!callExpressionIdentifier &&
                helpers.isAsyncUtil(callExpressionIdentifier, ['waitFor']));
        }
        function isCallerThen(node) {
            if (!node.parent) {
                return false;
            }
            const callExpressionNode = node.parent.parent;
            return (0, node_utils_1.hasThenProperty)(callExpressionNode.callee);
        }
        function isRenderInVariableDeclaration(node) {
            return ((0, node_utils_1.isVariableDeclaration)(node) &&
                node.declarations.some(helpers.isRenderVariableDeclarator));
        }
        function isRenderInExpressionStatement(node) {
            if (!(0, node_utils_1.isExpressionStatement)(node) ||
                !(0, node_utils_1.isAssignmentExpression)(node.expression)) {
                return false;
            }
            const expressionIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(node.expression.right);
            if (!expressionIdentifier) {
                return false;
            }
            return helpers.isRenderUtil(expressionIdentifier);
        }
        function isRenderInAssignmentExpression(node) {
            if (!(0, node_utils_1.isAssignmentExpression)(node)) {
                return false;
            }
            const expressionIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(node.right);
            if (!expressionIdentifier) {
                return false;
            }
            return helpers.isRenderUtil(expressionIdentifier);
        }
        function isRenderInSequenceAssignment(node) {
            if (!(0, node_utils_1.isSequenceExpression)(node)) {
                return false;
            }
            return node.expressions.some(isRenderInAssignmentExpression);
        }
        function isSideEffectInVariableDeclaration(node) {
            return node.declarations.some((declaration) => {
                if ((0, node_utils_1.isCallExpression)(declaration.init)) {
                    const test = (0, node_utils_1.getPropertyIdentifierNode)(declaration.init);
                    if (!test) {
                        return false;
                    }
                    return (helpers.isFireEventUtil(test) ||
                        helpers.isUserEventUtil(test) ||
                        helpers.isRenderUtil(test));
                }
                return false;
            });
        }
        function getSideEffectNodes(body) {
            return body.filter((node) => {
                if (!(0, node_utils_1.isExpressionStatement)(node) && !(0, node_utils_1.isVariableDeclaration)(node)) {
                    return false;
                }
                if (isRenderInVariableDeclaration(node) ||
                    isRenderInExpressionStatement(node)) {
                    return true;
                }
                if ((0, node_utils_1.isVariableDeclaration)(node) &&
                    isSideEffectInVariableDeclaration(node)) {
                    return true;
                }
                const expressionIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(node);
                if (!expressionIdentifier) {
                    return false;
                }
                return (helpers.isFireEventUtil(expressionIdentifier) ||
                    helpers.isUserEventUtil(expressionIdentifier) ||
                    helpers.isRenderUtil(expressionIdentifier));
            });
        }
        function reportSideEffects(node) {
            if (!isCallerWaitFor(node)) {
                return;
            }
            if (isCallerThen(node)) {
                return;
            }
            const sideEffects = getSideEffectNodes(node.body);
            sideEffects.forEach((sideEffectNode) => context.report({
                node: sideEffectNode,
                messageId: 'noSideEffectsWaitFor',
                fix(fixer) {
                    var _a, _b;
                    const { parent: callExpressionNode } = node.parent;
                    const targetNode = (0, ast_utils_1.isAwaitExpression)(callExpressionNode.parent)
                        ? callExpressionNode.parent
                        : callExpressionNode;
                    const lines = sourceCode.getText().split('\n');
                    const line = lines[targetNode.loc.start.line - 1];
                    const indent = (_b = (_a = line.match(/^\s*/)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '';
                    const sideEffectLines = lines.slice(sideEffectNode.loc.start.line - 1, sideEffectNode.loc.end.line);
                    const sideEffectNodeText = sideEffectLines.join('\n').trimStart();
                    if (sideEffects.length === node.body.length &&
                        sideEffects.length === 1) {
                        const tokenAfter = sourceCode.getTokenAfter(targetNode);
                        return [
                            fixer.insertTextBefore(targetNode, sideEffectNodeText),
                            (tokenAfter === null || tokenAfter === void 0 ? void 0 : tokenAfter.value) === ';'
                                ? fixer.removeRange([
                                    targetNode.range[0],
                                    tokenAfter.range[1],
                                ])
                                : fixer.remove(targetNode),
                        ];
                    }
                    const lineStart = sourceCode.getIndexFromLoc({
                        line: sideEffectNode.loc.start.line,
                        column: 0,
                    });
                    const lineEnd = sourceCode.getIndexFromLoc({
                        line: sideEffectNode.loc.end.line + 1,
                        column: 0,
                    });
                    return [
                        fixer.insertTextBefore(targetNode, sideEffectNodeText + '\n' + indent),
                        fixer.removeRange([lineStart, lineEnd]),
                    ];
                },
            }));
        }
        function reportImplicitReturnSideEffect(node) {
            if (!isCallerWaitFor(node)) {
                return;
            }
            const expressionIdentifier = (0, node_utils_1.isCallExpression)(node)
                ? (0, node_utils_1.getPropertyIdentifierNode)(node.callee)
                : null;
            if (!expressionIdentifier &&
                !isRenderInAssignmentExpression(node) &&
                !isRenderInSequenceAssignment(node)) {
                return;
            }
            if (expressionIdentifier &&
                !helpers.isFireEventUtil(expressionIdentifier) &&
                !helpers.isUserEventUtil(expressionIdentifier) &&
                !helpers.isRenderUtil(expressionIdentifier)) {
                return;
            }
            context.report({
                node,
                messageId: 'noSideEffectsWaitFor',
                fix: (fixer) => {
                    const { parent: callExpressionNode } = node.parent;
                    const targetNode = (0, ast_utils_1.isAwaitExpression)(callExpressionNode.parent)
                        ? callExpressionNode.parent
                        : callExpressionNode;
                    return fixer.replaceText(targetNode, sourceCode.getText(node));
                },
            });
        }
        return {
            'CallExpression > ArrowFunctionExpression > BlockStatement': reportSideEffects,
            'CallExpression > ArrowFunctionExpression > CallExpression': reportImplicitReturnSideEffect,
            'CallExpression > ArrowFunctionExpression > AssignmentExpression': reportImplicitReturnSideEffect,
            'CallExpression > ArrowFunctionExpression > SequenceExpression': reportImplicitReturnSideEffect,
            'CallExpression > FunctionExpression > BlockStatement': reportSideEffects,
        };
    },
});
