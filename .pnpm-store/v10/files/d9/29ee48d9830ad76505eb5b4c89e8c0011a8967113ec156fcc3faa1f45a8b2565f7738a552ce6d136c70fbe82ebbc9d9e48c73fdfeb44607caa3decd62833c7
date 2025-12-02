"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_2 = require("../utils");
exports.RULE_NAME = 'no-unnecessary-act';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow wrapping Testing Library utils or empty callbacks in `act`',
            recommendedConfig: {
                dom: false,
                angular: false,
                react: 'error',
                vue: false,
                svelte: false,
                marko: 'error',
            },
        },
        messages: {
            noUnnecessaryActTestingLibraryUtil: 'Avoid wrapping Testing Library util calls in `act`',
            noUnnecessaryActEmptyFunction: 'Avoid wrapping empty function in `act`',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    isStrict: {
                        type: 'boolean',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            isStrict: true,
        },
    ],
    create(context, [{ isStrict = true }], helpers) {
        const userEventInstanceNames = new Set();
        function getStatementIdentifier(statement) {
            const callExpression = (0, node_utils_1.getStatementCallExpression)(statement);
            if (!callExpression &&
                !(0, node_utils_1.isExpressionStatement)(statement) &&
                !(0, node_utils_1.isReturnStatement)(statement)) {
                return null;
            }
            if (callExpression) {
                return (0, node_utils_1.getDeepestIdentifierNode)(callExpression);
            }
            if ((0, node_utils_1.isExpressionStatement)(statement) &&
                utils_1.ASTUtils.isAwaitExpression(statement.expression)) {
                return (0, node_utils_1.getPropertyIdentifierNode)(statement.expression.argument);
            }
            if ((0, node_utils_1.isReturnStatement)(statement) && statement.argument) {
                return (0, node_utils_1.getPropertyIdentifierNode)(statement.argument);
            }
            return null;
        }
        function hasUserEventInstanceName(identifier) {
            var _a;
            if (!(0, node_utils_1.isMemberExpression)(identifier.parent)) {
                return false;
            }
            const propertyIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(identifier.parent);
            return userEventInstanceNames.has((_a = propertyIdentifier === null || propertyIdentifier === void 0 ? void 0 : propertyIdentifier.name) !== null && _a !== void 0 ? _a : '');
        }
        function hasStatementReference(statements, predicate) {
            return statements.some((statement) => {
                const identifier = getStatementIdentifier(statement);
                if (!identifier) {
                    return false;
                }
                return predicate(identifier);
            });
        }
        function hasSomeNonTestingLibraryCall(statements) {
            return hasStatementReference(statements, (identifier) => !helpers.isTestingLibraryUtil(identifier) &&
                !hasUserEventInstanceName(identifier));
        }
        function hasTestingLibraryCall(statements) {
            return hasStatementReference(statements, (identifier) => helpers.isTestingLibraryUtil(identifier) ||
                hasUserEventInstanceName(identifier));
        }
        function checkNoUnnecessaryActFromBlockStatement(blockStatementNode) {
            const functionNode = blockStatementNode.parent;
            const callExpressionNode = functionNode === null || functionNode === void 0 ? void 0 : functionNode.parent;
            if (!callExpressionNode || !functionNode) {
                return;
            }
            const identifierNode = (0, node_utils_1.getDeepestIdentifierNode)(callExpressionNode);
            if (!identifierNode) {
                return;
            }
            if (!helpers.isActUtil(identifierNode)) {
                return;
            }
            if ((0, node_utils_1.isEmptyFunction)(functionNode)) {
                context.report({
                    node: identifierNode,
                    messageId: 'noUnnecessaryActEmptyFunction',
                });
                return;
            }
            const shouldBeReported = isStrict
                ? hasTestingLibraryCall(blockStatementNode.body)
                : !hasSomeNonTestingLibraryCall(blockStatementNode.body);
            if (shouldBeReported) {
                context.report({
                    node: identifierNode,
                    messageId: 'noUnnecessaryActTestingLibraryUtil',
                });
            }
        }
        function checkNoUnnecessaryActFromImplicitReturn(node) {
            var _a;
            const nodeIdentifier = (0, node_utils_1.getDeepestIdentifierNode)(node);
            if (!nodeIdentifier) {
                return;
            }
            const parentCallExpression = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.parent;
            if (!parentCallExpression) {
                return;
            }
            const identifierNode = (0, node_utils_1.getDeepestIdentifierNode)(parentCallExpression);
            if (!identifierNode) {
                return;
            }
            if (!helpers.isActUtil(identifierNode)) {
                return;
            }
            if (!helpers.isTestingLibraryUtil(nodeIdentifier)) {
                return;
            }
            context.report({
                node: identifierNode,
                messageId: 'noUnnecessaryActTestingLibraryUtil',
            });
        }
        function registerUserEventInstance(node) {
            var _a;
            const propertyIdentifier = (0, node_utils_1.getPropertyIdentifierNode)(node);
            const deepestIdentifier = (0, node_utils_1.getDeepestIdentifierNode)(node);
            const testingLibraryFn = (0, utils_2.resolveToTestingLibraryFn)(node, context);
            if ((propertyIdentifier === null || propertyIdentifier === void 0 ? void 0 : propertyIdentifier.name) === (testingLibraryFn === null || testingLibraryFn === void 0 ? void 0 : testingLibraryFn.local) &&
                (deepestIdentifier === null || deepestIdentifier === void 0 ? void 0 : deepestIdentifier.name) === 'setup' &&
                utils_1.ASTUtils.isIdentifier((_a = node.parent) === null || _a === void 0 ? void 0 : _a.id)) {
                userEventInstanceNames.add(node.parent.id.name);
            }
        }
        return {
            'VariableDeclarator > CallExpression': registerUserEventInstance,
            'CallExpression > ArrowFunctionExpression > BlockStatement': checkNoUnnecessaryActFromBlockStatement,
            'CallExpression > FunctionExpression > BlockStatement': checkNoUnnecessaryActFromBlockStatement,
            'CallExpression > ArrowFunctionExpression > CallExpression': checkNoUnnecessaryActFromImplicitReturn,
        };
    },
});
