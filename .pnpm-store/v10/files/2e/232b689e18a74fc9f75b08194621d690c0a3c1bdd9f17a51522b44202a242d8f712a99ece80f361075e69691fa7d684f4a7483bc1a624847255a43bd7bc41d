"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_2 = require("../utils");
exports.RULE_NAME = 'no-node-access';
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow direct Node access',
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
            noNodeAccess: 'Avoid direct Node access. Prefer using the methods from Testing Library.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    allowContainerFirstChild: {
                        type: 'boolean',
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [
        {
            allowContainerFirstChild: false,
        },
    ],
    create(context, [{ allowContainerFirstChild = false }], helpers) {
        function showErrorForNodeAccess(node) {
            if (!helpers.isTestingLibraryImported(true)) {
                return;
            }
            const propertyName = utils_1.ASTUtils.isIdentifier(node.property)
                ? node.property.name
                : null;
            if (propertyName &&
                utils_2.ALL_RETURNING_NODES.some((allReturningNode) => allReturningNode === propertyName)) {
                if (allowContainerFirstChild && propertyName === 'firstChild') {
                    return;
                }
                if (utils_1.ASTUtils.isIdentifier(node.object) &&
                    node.object.name === 'props') {
                    return;
                }
                context.report({
                    node,
                    loc: node.property.loc.start,
                    messageId: 'noNodeAccess',
                });
            }
        }
        function getProperty(node) {
            if ((0, node_utils_1.isLiteral)(node)) {
                return node;
            }
            return (0, node_utils_1.getDeepestIdentifierNode)(node);
        }
        return {
            CallExpression(node) {
                if (!(0, node_utils_1.isMemberExpression)(node.callee))
                    return;
                const { callee } = node;
                if (!utils_2.EVENT_HANDLER_METHODS.some((method) => method === utils_1.ASTUtils.getPropertyName(callee))) {
                    return;
                }
                const identifier = (0, node_utils_1.getDeepestIdentifierNode)(callee.object);
                if (!identifier ||
                    !utils_2.ALL_QUERIES_COMBINATIONS.includes(identifier.name)) {
                    return;
                }
                if ((0, utils_2.resolveToTestingLibraryFn)(node, context)) {
                    const property = getProperty(callee.property);
                    context.report({
                        node,
                        loc: property === null || property === void 0 ? void 0 : property.loc.start,
                        messageId: 'noNodeAccess',
                    });
                }
            },
            'ExpressionStatement MemberExpression': showErrorForNodeAccess,
            'VariableDeclarator MemberExpression': showErrorForNodeAccess,
        };
    },
});
