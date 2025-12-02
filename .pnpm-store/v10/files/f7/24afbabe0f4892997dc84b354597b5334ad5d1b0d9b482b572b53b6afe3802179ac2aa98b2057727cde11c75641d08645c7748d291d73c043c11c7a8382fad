"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
exports.RULE_NAME = 'prefer-implicit-assert';
const isCalledUsingSomeObject = (node) => (0, node_utils_1.isMemberExpression)(node.parent) &&
    node.parent.object.type === utils_1.AST_NODE_TYPES.Identifier;
const isCalledInExpect = (node, isAsyncQuery) => {
    if (isAsyncQuery) {
        return ((0, node_utils_1.isCallExpression)(node.parent) &&
            utils_1.ASTUtils.isAwaitExpression(node.parent.parent) &&
            (0, node_utils_1.isCallExpression)(node.parent.parent.parent) &&
            utils_1.ASTUtils.isIdentifier(node.parent.parent.parent.callee) &&
            node.parent.parent.parent.callee.name === 'expect');
    }
    return ((0, node_utils_1.isCallExpression)(node.parent) &&
        (0, node_utils_1.isCallExpression)(node.parent.parent) &&
        utils_1.ASTUtils.isIdentifier(node.parent.parent.callee) &&
        node.parent.parent.callee.name === 'expect');
};
const reportError = (context, node, queryType) => {
    if (node) {
        return context.report({
            node,
            messageId: 'preferImplicitAssert',
            data: {
                queryType,
            },
        });
    }
};
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Suggest using implicit assertions for getBy* & findBy* queries',
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
            preferImplicitAssert: "Don't wrap `{{queryType}}` query with `expect` & presence matchers like `toBeInTheDocument` or `not.toBeNull` as `{{queryType}}` queries fail implicitly when element is not found",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context, _, helpers) {
        const findQueryCalls = [];
        const getQueryCalls = [];
        return {
            'CallExpression Identifier'(node) {
                if (helpers.isFindQueryVariant(node)) {
                    findQueryCalls.push(node);
                }
                if (helpers.isGetQueryVariant(node)) {
                    getQueryCalls.push(node);
                }
            },
            'Program:exit'() {
                findQueryCalls.forEach((queryCall) => {
                    var _a, _b, _c, _d, _e, _f;
                    const isAsyncQuery = true;
                    const node = isCalledUsingSomeObject(queryCall) ? queryCall.parent : queryCall;
                    if (node) {
                        if (isCalledInExpect(node, isAsyncQuery)) {
                            if ((0, node_utils_1.isMemberExpression)((_c = (_b = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.parent) === null || _c === void 0 ? void 0 : _c.parent) &&
                                ((_f = (_e = (_d = node.parent) === null || _d === void 0 ? void 0 : _d.parent) === null || _e === void 0 ? void 0 : _e.parent) === null || _f === void 0 ? void 0 : _f.parent.property.type) ===
                                    utils_1.AST_NODE_TYPES.Identifier &&
                                helpers.isPresenceAssert(node.parent.parent.parent.parent)) {
                                return reportError(context, node, 'findBy*');
                            }
                        }
                    }
                });
                getQueryCalls.forEach((queryCall) => {
                    var _a, _b, _c, _d;
                    const isAsyncQuery = false;
                    const node = isCalledUsingSomeObject(queryCall) ? queryCall.parent : queryCall;
                    if (node) {
                        if (isCalledInExpect(node, isAsyncQuery)) {
                            if ((0, node_utils_1.isMemberExpression)((_b = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.parent) &&
                                ((_d = (_c = node.parent) === null || _c === void 0 ? void 0 : _c.parent) === null || _d === void 0 ? void 0 : _d.parent.property.type) ===
                                    utils_1.AST_NODE_TYPES.Identifier &&
                                helpers.isPresenceAssert(node.parent.parent.parent)) {
                                return reportError(context, node, 'getBy*');
                            }
                        }
                    }
                });
            },
        };
    },
});
