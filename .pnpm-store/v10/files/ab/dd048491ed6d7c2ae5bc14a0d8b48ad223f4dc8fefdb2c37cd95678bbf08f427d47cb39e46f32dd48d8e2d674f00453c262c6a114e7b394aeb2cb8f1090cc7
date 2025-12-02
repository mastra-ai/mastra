"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_2 = require("../utils");
exports.RULE_NAME = 'await-async-events';
const FIRE_EVENT_NAME = 'fireEvent';
const USER_EVENT_NAME = 'userEvent';
const USER_EVENT_SETUP_FUNCTION_NAME = 'setup';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce promises from async event methods are handled',
            recommendedConfig: {
                dom: ['error', { eventModule: 'userEvent' }],
                angular: ['error', { eventModule: 'userEvent' }],
                react: ['error', { eventModule: 'userEvent' }],
                vue: ['error', { eventModule: ['fireEvent', 'userEvent'] }],
                svelte: ['error', { eventModule: ['fireEvent', 'userEvent'] }],
                marko: ['error', { eventModule: ['fireEvent', 'userEvent'] }],
            },
        },
        messages: {
            awaitAsyncEvent: 'Promise returned from async event method `{{ name }}` must be handled',
            awaitAsyncEventWrapper: 'Promise returned from `{{ name }}` wrapper over async event method must be handled',
        },
        fixable: 'code',
        schema: [
            {
                type: 'object',
                default: {},
                additionalProperties: false,
                properties: {
                    eventModule: {
                        default: USER_EVENT_NAME,
                        oneOf: [
                            {
                                enum: utils_2.EVENTS_SIMULATORS.concat(),
                                type: 'string',
                            },
                            {
                                items: {
                                    type: 'string',
                                    enum: utils_2.EVENTS_SIMULATORS.concat(),
                                },
                                type: 'array',
                            },
                        ],
                    },
                },
            },
        ],
    },
    defaultOptions: [
        {
            eventModule: USER_EVENT_NAME,
        },
    ],
    create(context, [options], helpers) {
        const functionWrappersNames = [];
        const userEventSetupVars = new Set();
        const setupFunctions = new Map();
        function reportUnhandledNode({ node, closestCallExpression, messageId = 'awaitAsyncEvent', fix, }) {
            if (!(0, node_utils_1.isPromiseHandled)(node)) {
                context.report({
                    node: closestCallExpression.callee,
                    messageId,
                    data: { name: node.name },
                    fix,
                });
            }
        }
        function detectEventMethodWrapper(node) {
            const innerFunction = (0, node_utils_1.getInnermostReturningFunction)(context, node);
            if (innerFunction) {
                functionWrappersNames.push((0, node_utils_1.getFunctionName)(innerFunction));
            }
        }
        function isUserEventSetupCall(node) {
            return (node.type === utils_1.AST_NODE_TYPES.CallExpression &&
                node.callee.type === utils_1.AST_NODE_TYPES.MemberExpression &&
                node.callee.object.type === utils_1.AST_NODE_TYPES.Identifier &&
                node.callee.object.name === USER_EVENT_NAME &&
                node.callee.property.type === utils_1.AST_NODE_TYPES.Identifier &&
                node.callee.property.name === USER_EVENT_SETUP_FUNCTION_NAME);
        }
        const eventModules = typeof options.eventModule === 'string'
            ? [options.eventModule]
            : options.eventModule;
        const isFireEventEnabled = eventModules.includes(FIRE_EVENT_NAME);
        const isUserEventEnabled = eventModules.includes(USER_EVENT_NAME);
        return {
            VariableDeclarator(node) {
                if (!isUserEventEnabled)
                    return;
                if (node.init &&
                    isUserEventSetupCall(node.init) &&
                    node.id.type === utils_1.AST_NODE_TYPES.Identifier) {
                    userEventSetupVars.add(node.id.name);
                }
                if (node.id.type === utils_1.AST_NODE_TYPES.ObjectPattern &&
                    node.init &&
                    node.init.type === utils_1.AST_NODE_TYPES.CallExpression &&
                    node.init.callee.type === utils_1.AST_NODE_TYPES.Identifier) {
                    const functionName = node.init.callee.name;
                    const setupProps = setupFunctions.get(functionName);
                    if (setupProps) {
                        for (const prop of node.id.properties) {
                            if (prop.type === utils_1.AST_NODE_TYPES.Property &&
                                prop.key.type === utils_1.AST_NODE_TYPES.Identifier &&
                                setupProps.has(prop.key.name) &&
                                prop.value.type === utils_1.AST_NODE_TYPES.Identifier) {
                                userEventSetupVars.add(prop.value.name);
                            }
                        }
                    }
                }
            },
            ReturnStatement(node) {
                if (!isUserEventEnabled ||
                    !node.argument ||
                    node.argument.type !== utils_1.AST_NODE_TYPES.ObjectExpression) {
                    return;
                }
                const setupProps = new Set();
                for (const prop of node.argument.properties) {
                    if (prop.type === utils_1.AST_NODE_TYPES.Property &&
                        prop.key.type === utils_1.AST_NODE_TYPES.Identifier) {
                        if (isUserEventSetupCall(prop.value)) {
                            setupProps.add(prop.key.name);
                        }
                        else if (prop.value.type === utils_1.AST_NODE_TYPES.Identifier &&
                            userEventSetupVars.has(prop.value.name)) {
                            setupProps.add(prop.key.name);
                        }
                    }
                }
                if (setupProps.size > 0) {
                    const functionNode = (0, node_utils_1.findClosestFunctionExpressionNode)(node);
                    if (functionNode) {
                        const functionName = (0, node_utils_1.getFunctionName)(functionNode);
                        setupFunctions.set(functionName, setupProps);
                    }
                }
            },
            'CallExpression Identifier'(node) {
                if ((isFireEventEnabled && helpers.isFireEventMethod(node)) ||
                    (isUserEventEnabled &&
                        helpers.isUserEventMethod(node, userEventSetupVars))) {
                    if (node.name === USER_EVENT_SETUP_FUNCTION_NAME) {
                        return;
                    }
                    detectEventMethodWrapper(node);
                    const closestCallExpression = (0, node_utils_1.findClosestCallExpressionNode)(node, true);
                    if (!(closestCallExpression === null || closestCallExpression === void 0 ? void 0 : closestCallExpression.parent)) {
                        return;
                    }
                    const references = (0, node_utils_1.getVariableReferences)(context, closestCallExpression.parent);
                    if (references.length === 0) {
                        reportUnhandledNode({
                            node,
                            closestCallExpression,
                            fix: (fixer) => {
                                if ((0, node_utils_1.isMemberExpression)(node.parent)) {
                                    const functionExpression = (0, node_utils_1.findClosestFunctionExpressionNode)(node);
                                    if (functionExpression) {
                                        const deepestCalleeIdentifier = (0, node_utils_1.getDeepestIdentifierNode)(functionExpression.parent);
                                        if ((deepestCalleeIdentifier === null || deepestCalleeIdentifier === void 0 ? void 0 : deepestCalleeIdentifier.name) === 'forEach') {
                                            return null;
                                        }
                                        const memberExpressionFixer = fixer.insertTextBefore(node.parent, 'await ');
                                        if (functionExpression.async) {
                                            return memberExpressionFixer;
                                        }
                                        else {
                                            functionExpression.async = true;
                                            return [
                                                memberExpressionFixer,
                                                fixer.insertTextBefore(functionExpression, 'async '),
                                            ];
                                        }
                                    }
                                }
                                return null;
                            },
                        });
                    }
                    else {
                        for (const reference of references) {
                            if (utils_1.ASTUtils.isIdentifier(reference.identifier)) {
                                reportUnhandledNode({
                                    node: reference.identifier,
                                    closestCallExpression,
                                });
                            }
                        }
                    }
                }
                else if (functionWrappersNames.includes(node.name)) {
                    const closestCallExpression = (0, node_utils_1.findClosestCallExpressionNode)(node, true);
                    if (!closestCallExpression) {
                        return;
                    }
                    reportUnhandledNode({
                        node,
                        closestCallExpression,
                        messageId: 'awaitAsyncEventWrapper',
                        fix: (fixer) => {
                            const functionExpression = (0, node_utils_1.findClosestFunctionExpressionNode)(node);
                            if (functionExpression) {
                                const nodeFixer = fixer.insertTextBefore(node, 'await ');
                                if (functionExpression.async) {
                                    return nodeFixer;
                                }
                                else {
                                    functionExpression.async = true;
                                    return [
                                        nodeFixer,
                                        fixer.insertTextBefore(functionExpression, 'async '),
                                    ];
                                }
                            }
                            return null;
                        },
                    });
                }
            },
        };
    },
});
