"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const USER_EVENT_ASYNC_EXCEPTIONS = ['type', 'keyboard'];
const FIRE_EVENT_OPTION = 'fire-event';
const USER_EVENT_OPTION = 'user-event';
const VALID_EVENT_MODULES = [FIRE_EVENT_OPTION, USER_EVENT_OPTION];
const DEFAULT_EVENT_MODULES = [FIRE_EVENT_OPTION];
exports.RULE_NAME = 'no-await-sync-events';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow unnecessary `await` for sync events',
            recommendedConfig: {
                dom: ['error', { eventModules: DEFAULT_EVENT_MODULES }],
                angular: ['error', { eventModules: DEFAULT_EVENT_MODULES }],
                react: ['error', { eventModules: DEFAULT_EVENT_MODULES }],
                vue: false,
                svelte: false,
                marko: false,
            },
        },
        messages: {
            noAwaitSyncEvents: '`{{ name }}` is sync and does not need `await` operator',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    eventModules: {
                        type: 'array',
                        items: { type: 'string', enum: VALID_EVENT_MODULES },
                        minItems: 1,
                        default: DEFAULT_EVENT_MODULES,
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [{ eventModules: DEFAULT_EVENT_MODULES }],
    create(context, [options], helpers) {
        const { eventModules = DEFAULT_EVENT_MODULES } = options;
        let hasDelayDeclarationOrAssignmentGTZero;
        return {
            VariableDeclaration(node) {
                hasDelayDeclarationOrAssignmentGTZero = node.declarations.some((property) => utils_1.ASTUtils.isIdentifier(property.id) &&
                    property.id.name === 'delay' &&
                    (0, node_utils_1.isLiteral)(property.init) &&
                    property.init.value &&
                    Number.isInteger(property.init.value) &&
                    Number(property.init.value) > 0);
            },
            AssignmentExpression(node) {
                if (utils_1.ASTUtils.isIdentifier(node.left) &&
                    node.left.name === 'delay' &&
                    (0, node_utils_1.isLiteral)(node.right) &&
                    node.right.value !== null) {
                    hasDelayDeclarationOrAssignmentGTZero =
                        Number.isInteger(node.right.value) && Number(node.right.value) > 0;
                }
            },
            'AwaitExpression > CallExpression'(node) {
                var _a;
                const simulateEventFunctionIdentifier = (0, node_utils_1.getDeepestIdentifierNode)(node);
                if (!simulateEventFunctionIdentifier) {
                    return;
                }
                const isUserEventMethod = helpers.isUserEventMethod(simulateEventFunctionIdentifier);
                const isFireEventMethod = helpers.isFireEventMethod(simulateEventFunctionIdentifier);
                const isSimulateEventMethod = isUserEventMethod || isFireEventMethod;
                if (!isSimulateEventMethod) {
                    return;
                }
                if (isFireEventMethod && !eventModules.includes(FIRE_EVENT_OPTION)) {
                    return;
                }
                if (isUserEventMethod && !eventModules.includes(USER_EVENT_OPTION)) {
                    return;
                }
                const lastArg = node.arguments[node.arguments.length - 1];
                const hasDelayProperty = (0, node_utils_1.isObjectExpression)(lastArg) &&
                    lastArg.properties.some((property) => (0, node_utils_1.isProperty)(property) &&
                        utils_1.ASTUtils.isIdentifier(property.key) &&
                        property.key.name === 'delay');
                const hasDelayLiteralGTZero = (0, node_utils_1.isObjectExpression)(lastArg) &&
                    lastArg.properties.some((property) => (0, node_utils_1.isProperty)(property) &&
                        utils_1.ASTUtils.isIdentifier(property.key) &&
                        property.key.name === 'delay' &&
                        (0, node_utils_1.isLiteral)(property.value) &&
                        !!property.value.value &&
                        Number.isInteger(property.value.value) &&
                        Number(property.value.value) > 0);
                const simulateEventFunctionName = simulateEventFunctionIdentifier.name;
                if (USER_EVENT_ASYNC_EXCEPTIONS.includes(simulateEventFunctionName) &&
                    hasDelayProperty &&
                    (hasDelayDeclarationOrAssignmentGTZero || hasDelayLiteralGTZero)) {
                    return;
                }
                const eventModuleName = (_a = (0, node_utils_1.getPropertyIdentifierNode)(node)) === null || _a === void 0 ? void 0 : _a.name;
                const eventFullName = eventModuleName
                    ? `${eventModuleName}.${simulateEventFunctionName}`
                    : simulateEventFunctionName;
                context.report({
                    node,
                    messageId: 'noAwaitSyncEvents',
                    data: {
                        name: eventFullName,
                    },
                });
            },
        };
    },
});
