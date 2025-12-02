"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findClosestCallExpressionNode = findClosestCallExpressionNode;
exports.findClosestVariableDeclaratorNode = findClosestVariableDeclaratorNode;
exports.findClosestFunctionExpressionNode = findClosestFunctionExpressionNode;
exports.findClosestCallNode = findClosestCallNode;
exports.hasThenProperty = hasThenProperty;
exports.hasPromiseHandlerProperty = hasPromiseHandlerProperty;
exports.hasChainedPromiseHandler = hasChainedPromiseHandler;
exports.isPromiseIdentifier = isPromiseIdentifier;
exports.isPromiseAll = isPromiseAll;
exports.isPromiseAllSettled = isPromiseAllSettled;
exports.isPromisesArrayResolved = isPromisesArrayResolved;
exports.isPromiseHandled = isPromiseHandled;
exports.getVariableReferences = getVariableReferences;
exports.getInnermostFunctionScope = getInnermostFunctionScope;
exports.getFunctionReturnStatementNode = getFunctionReturnStatementNode;
exports.getPropertyIdentifierNode = getPropertyIdentifierNode;
exports.getDeepestIdentifierNode = getDeepestIdentifierNode;
exports.getReferenceNode = getReferenceNode;
exports.getFunctionName = getFunctionName;
exports.getImportModuleName = getImportModuleName;
exports.getAssertNodeInfo = getAssertNodeInfo;
exports.hasClosestExpectHandlesPromise = hasClosestExpectHandlesPromise;
exports.getInnermostReturningFunction = getInnermostReturningFunction;
exports.hasImportMatch = hasImportMatch;
exports.getStatementCallExpression = getStatementCallExpression;
exports.isEmptyFunction = isEmptyFunction;
exports.findImportSpecifier = findImportSpecifier;
const scope_manager_1 = require("@typescript-eslint/scope-manager");
const utils_1 = require("@typescript-eslint/utils");
const utils_2 = require("../utils");
const is_node_of_type_1 = require("./is-node-of-type");
__exportStar(require("./is-node-of-type"), exports);
const ValidLeftHandSideExpressions = [
    utils_1.AST_NODE_TYPES.CallExpression,
    utils_1.AST_NODE_TYPES.ClassExpression,
    utils_1.AST_NODE_TYPES.ClassDeclaration,
    utils_1.AST_NODE_TYPES.FunctionExpression,
    utils_1.AST_NODE_TYPES.Literal,
    utils_1.AST_NODE_TYPES.TemplateLiteral,
    utils_1.AST_NODE_TYPES.MemberExpression,
    utils_1.AST_NODE_TYPES.ArrayExpression,
    utils_1.AST_NODE_TYPES.ArrayPattern,
    utils_1.AST_NODE_TYPES.ClassExpression,
    utils_1.AST_NODE_TYPES.FunctionExpression,
    utils_1.AST_NODE_TYPES.Identifier,
    utils_1.AST_NODE_TYPES.JSXElement,
    utils_1.AST_NODE_TYPES.JSXFragment,
    utils_1.AST_NODE_TYPES.JSXOpeningElement,
    utils_1.AST_NODE_TYPES.MetaProperty,
    utils_1.AST_NODE_TYPES.ObjectExpression,
    utils_1.AST_NODE_TYPES.ObjectPattern,
    utils_1.AST_NODE_TYPES.Super,
    utils_1.AST_NODE_TYPES.ThisExpression,
    utils_1.AST_NODE_TYPES.TSNullKeyword,
    utils_1.AST_NODE_TYPES.TaggedTemplateExpression,
    utils_1.AST_NODE_TYPES.TSNonNullExpression,
    utils_1.AST_NODE_TYPES.TSAsExpression,
    utils_1.AST_NODE_TYPES.ArrowFunctionExpression,
];
function findClosestCallExpressionNode(node, shouldRestrictInnerScope = false) {
    if ((0, is_node_of_type_1.isCallExpression)(node)) {
        return node;
    }
    if (!(node === null || node === void 0 ? void 0 : node.parent)) {
        return null;
    }
    if (shouldRestrictInnerScope &&
        !ValidLeftHandSideExpressions.includes(node.parent.type)) {
        return null;
    }
    return findClosestCallExpressionNode(node.parent, shouldRestrictInnerScope);
}
function findClosestVariableDeclaratorNode(node) {
    if (!node) {
        return null;
    }
    if (utils_1.ASTUtils.isVariableDeclarator(node)) {
        return node;
    }
    return findClosestVariableDeclaratorNode(node.parent);
}
function findClosestFunctionExpressionNode(node) {
    if (!node) {
        return null;
    }
    if ((0, is_node_of_type_1.isArrowFunctionExpression)(node) ||
        (0, is_node_of_type_1.isFunctionExpression)(node) ||
        (0, is_node_of_type_1.isFunctionDeclaration)(node)) {
        return node;
    }
    return findClosestFunctionExpressionNode(node.parent);
}
function findClosestCallNode(node, name) {
    if (!node.parent) {
        return null;
    }
    if ((0, is_node_of_type_1.isCallExpression)(node) &&
        utils_1.ASTUtils.isIdentifier(node.callee) &&
        node.callee.name === name) {
        return node;
    }
    else {
        return findClosestCallNode(node.parent, name);
    }
}
function hasThenProperty(node) {
    return ((0, is_node_of_type_1.isMemberExpression)(node) &&
        utils_1.ASTUtils.isIdentifier(node.property) &&
        node.property.name === 'then');
}
function hasPromiseHandlerProperty(node) {
    return ((0, is_node_of_type_1.isMemberExpression)(node) &&
        utils_1.ASTUtils.isIdentifier(node.property) &&
        ['then', 'catch', 'finally'].includes(node.property.name));
}
function hasChainedPromiseHandler(node) {
    const parent = node.parent;
    if ((0, is_node_of_type_1.isCallExpression)(parent) && parent.parent) {
        return hasPromiseHandlerProperty(parent.parent);
    }
    return !!parent && hasPromiseHandlerProperty(parent);
}
function isPromiseIdentifier(node) {
    return utils_1.ASTUtils.isIdentifier(node) && node.name === 'Promise';
}
function isPromiseAll(node) {
    return ((0, is_node_of_type_1.isMemberExpression)(node.callee) &&
        isPromiseIdentifier(node.callee.object) &&
        utils_1.ASTUtils.isIdentifier(node.callee.property) &&
        node.callee.property.name === 'all');
}
function isPromiseAllSettled(node) {
    return ((0, is_node_of_type_1.isMemberExpression)(node.callee) &&
        isPromiseIdentifier(node.callee.object) &&
        utils_1.ASTUtils.isIdentifier(node.callee.property) &&
        node.callee.property.name === 'allSettled');
}
function isPromisesArrayResolved(node) {
    const closestCallExpression = findClosestCallExpressionNode(node, true);
    if (!closestCallExpression) {
        return false;
    }
    return (!!closestCallExpression.parent &&
        (0, is_node_of_type_1.isArrayExpression)(closestCallExpression.parent) &&
        (0, is_node_of_type_1.isCallExpression)(closestCallExpression.parent.parent) &&
        (isPromiseAll(closestCallExpression.parent.parent) ||
            isPromiseAllSettled(closestCallExpression.parent.parent)));
}
function isPromiseHandled(nodeIdentifier) {
    const closestCallExpressionNode = findClosestCallExpressionNode(nodeIdentifier, true);
    const callRootExpression = closestCallExpressionNode == null
        ? null
        : getRootExpression(closestCallExpressionNode);
    const suspiciousNodes = [nodeIdentifier, callRootExpression].filter((node) => node != null);
    return suspiciousNodes.some((node) => {
        if (!node.parent)
            return false;
        if (utils_1.ASTUtils.isAwaitExpression(node.parent))
            return true;
        if ((0, is_node_of_type_1.isArrowFunctionExpression)(node.parent) ||
            (0, is_node_of_type_1.isReturnStatement)(node.parent))
            return true;
        if (hasClosestExpectHandlesPromise(node.parent))
            return true;
        if (hasChainedPromiseHandler(node))
            return true;
        if (isPromisesArrayResolved(node))
            return true;
    });
}
function getRootExpression(expression) {
    const { parent } = expression;
    if (parent == null)
        return expression;
    switch (parent.type) {
        case utils_1.AST_NODE_TYPES.ConditionalExpression:
            return getRootExpression(parent);
        case utils_1.AST_NODE_TYPES.LogicalExpression: {
            let rootExpression;
            switch (parent.operator) {
                case '??':
                case '||':
                    rootExpression = getRootExpression(parent);
                    break;
                case '&&':
                    rootExpression =
                        parent.right === expression
                            ? getRootExpression(parent)
                            : expression;
                    break;
            }
            return rootExpression !== null && rootExpression !== void 0 ? rootExpression : expression;
        }
        case utils_1.AST_NODE_TYPES.SequenceExpression:
            return parent.expressions[parent.expressions.length - 1] === expression
                ? getRootExpression(parent)
                : expression;
        case utils_1.AST_NODE_TYPES.ChainExpression:
            return getRootExpression(parent);
        default:
            return expression;
    }
}
function getVariableReferences(context, node) {
    var _a, _b, _c;
    if (utils_1.ASTUtils.isVariableDeclarator(node)) {
        return (_c = (_b = (_a = (0, utils_2.getDeclaredVariables)(context, node)[0]) === null || _a === void 0 ? void 0 : _a.references) === null || _b === void 0 ? void 0 : _b.slice(1)) !== null && _c !== void 0 ? _c : [];
    }
    return [];
}
function getInnermostFunctionScope(context, asyncQueryNode) {
    const innermostScope = utils_1.ASTUtils.getInnermostScope((0, utils_2.getScope)(context, asyncQueryNode), asyncQueryNode);
    if (innermostScope.type === scope_manager_1.ScopeType.function &&
        utils_1.ASTUtils.isFunction(innermostScope.block)) {
        return innermostScope;
    }
    return null;
}
function getFunctionReturnStatementNode(functionNode) {
    if ((0, is_node_of_type_1.isBlockStatement)(functionNode.body)) {
        const returnStatementNode = functionNode.body.body.find((statement) => (0, is_node_of_type_1.isReturnStatement)(statement));
        if (!returnStatementNode) {
            return null;
        }
        return returnStatementNode.argument;
    }
    else if (functionNode.expression) {
        return functionNode.body;
    }
    return null;
}
function getPropertyIdentifierNode(node) {
    if (utils_1.ASTUtils.isIdentifier(node)) {
        return node;
    }
    if ((0, is_node_of_type_1.isMemberExpression)(node)) {
        return getPropertyIdentifierNode(node.object);
    }
    if ((0, is_node_of_type_1.isCallExpression)(node)) {
        return getPropertyIdentifierNode(node.callee);
    }
    if ((0, is_node_of_type_1.isExpressionStatement)(node) || (0, is_node_of_type_1.isChainExpression)(node)) {
        return getPropertyIdentifierNode(node.expression);
    }
    if (utils_1.ASTUtils.isAwaitExpression(node)) {
        return getPropertyIdentifierNode(node.argument);
    }
    return null;
}
function getDeepestIdentifierNode(node) {
    if (utils_1.ASTUtils.isIdentifier(node)) {
        return node;
    }
    if ((0, is_node_of_type_1.isChainExpression)(node)) {
        return getDeepestIdentifierNode(node.expression);
    }
    if ((0, is_node_of_type_1.isMemberExpression)(node) && utils_1.ASTUtils.isIdentifier(node.property)) {
        return node.property;
    }
    if ((0, is_node_of_type_1.isCallExpression)(node)) {
        return getDeepestIdentifierNode(node.callee);
    }
    if (utils_1.ASTUtils.isAwaitExpression(node)) {
        return getDeepestIdentifierNode(node.argument);
    }
    return null;
}
function getReferenceNode(node) {
    if (node.parent &&
        ((0, is_node_of_type_1.isMemberExpression)(node.parent) || (0, is_node_of_type_1.isCallExpression)(node.parent))) {
        return getReferenceNode(node.parent);
    }
    return node;
}
function getFunctionName(node) {
    var _a, _b;
    return ((_b = (_a = utils_1.ASTUtils.getFunctionNameWithKind(node)
        .match(/('\w+')/g)) === null || _a === void 0 ? void 0 : _a[0].replace(/'/g, '')) !== null && _b !== void 0 ? _b : '');
}
function getImportModuleName(node) {
    if ((0, is_node_of_type_1.isImportDeclaration)(node) && typeof node.source.value === 'string') {
        return node.source.value;
    }
    if ((0, is_node_of_type_1.isCallExpression)(node) &&
        (0, is_node_of_type_1.isLiteral)(node.arguments[0]) &&
        typeof node.arguments[0].value === 'string') {
        return node.arguments[0].value;
    }
    return undefined;
}
function getAssertNodeInfo(node) {
    const emptyInfo = { matcher: null, isNegated: false };
    if (!(0, is_node_of_type_1.isCallExpression)(node.object) ||
        !utils_1.ASTUtils.isIdentifier(node.object.callee)) {
        return emptyInfo;
    }
    if (node.object.callee.name !== 'expect') {
        return emptyInfo;
    }
    let matcher = utils_1.ASTUtils.getPropertyName(node);
    const isNegated = matcher === 'not';
    if (isNegated) {
        matcher =
            node.parent && (0, is_node_of_type_1.isMemberExpression)(node.parent)
                ? utils_1.ASTUtils.getPropertyName(node.parent)
                : null;
    }
    if (!matcher) {
        return emptyInfo;
    }
    return { matcher, isNegated };
}
const matcherNamesHandlePromise = [
    'resolves',
    'rejects',
    'toResolve',
    'toReject',
    'toBeRejected',
    'toBeRejectedWith',
    'toBeRejectedWithError',
    'toBePending',
    'toBeResolved',
    'toBeResolvedTo',
];
function hasClosestExpectHandlesPromise(node) {
    if ((0, is_node_of_type_1.isCallExpression)(node) &&
        utils_1.ASTUtils.isIdentifier(node.callee) &&
        node.parent &&
        (0, is_node_of_type_1.isMemberExpression)(node.parent) &&
        ['expect', 'expectAsync'].includes(node.callee.name)) {
        const expectMatcher = node.parent.property;
        return (utils_1.ASTUtils.isIdentifier(expectMatcher) &&
            matcherNamesHandlePromise.includes(expectMatcher.name));
    }
    if (!node.parent) {
        return false;
    }
    return hasClosestExpectHandlesPromise(node.parent);
}
function getInnermostReturningFunction(context, node) {
    const functionScope = getInnermostFunctionScope(context, node);
    if (!functionScope) {
        return undefined;
    }
    const returnStatementNode = getFunctionReturnStatementNode(functionScope.block);
    if (!returnStatementNode) {
        return undefined;
    }
    const returnStatementIdentifier = getDeepestIdentifierNode(returnStatementNode);
    if ((returnStatementIdentifier === null || returnStatementIdentifier === void 0 ? void 0 : returnStatementIdentifier.name) !== node.name) {
        return undefined;
    }
    return functionScope.block;
}
function hasImportMatch(importNode, identifierName) {
    if (utils_1.ASTUtils.isIdentifier(importNode)) {
        return importNode.name === identifierName;
    }
    return importNode.local.name === identifierName;
}
function getCallExpressionFromNode(node) {
    if ((0, is_node_of_type_1.isCallExpression)(node)) {
        return node;
    }
    if ((0, is_node_of_type_1.isChainExpression)(node)) {
        return getCallExpressionFromNode(node.expression);
    }
    if (utils_1.ASTUtils.isAwaitExpression(node)) {
        return getCallExpressionFromNode(node.argument);
    }
    if ((0, is_node_of_type_1.isAssignmentExpression)(node)) {
        return getCallExpressionFromNode(node.right);
    }
    return null;
}
function getStatementCallExpression(statement) {
    if ((0, is_node_of_type_1.isExpressionStatement)(statement)) {
        return getCallExpressionFromNode(statement.expression);
    }
    if ((0, is_node_of_type_1.isReturnStatement)(statement)) {
        return getCallExpressionFromNode(statement.argument);
    }
    if ((0, is_node_of_type_1.isVariableDeclaration)(statement)) {
        for (const declaration of statement.declarations) {
            return getCallExpressionFromNode(declaration.init);
        }
    }
    return null;
}
function isEmptyFunction(node) {
    if (utils_1.ASTUtils.isFunction(node) && (0, is_node_of_type_1.isBlockStatement)(node.body)) {
        return node.body.body.length === 0;
    }
    return false;
}
function findImportSpecifier(specifierName, node) {
    if ((0, is_node_of_type_1.isImportDeclaration)(node)) {
        const namedExport = node.specifiers.find((n) => {
            return ((0, is_node_of_type_1.isImportSpecifier)(n) &&
                utils_1.ASTUtils.isIdentifier(n.imported) &&
                [n.imported.name, n.local.name].includes(specifierName));
        });
        if (namedExport) {
            return namedExport;
        }
        return node.specifiers.find((n) => (0, is_node_of_type_1.isImportNamespaceSpecifier)(n));
    }
    else {
        if (!utils_1.ASTUtils.isVariableDeclarator(node.parent)) {
            return undefined;
        }
        const requireNode = node.parent;
        if (utils_1.ASTUtils.isIdentifier(requireNode.id)) {
            return requireNode.id;
        }
        if (!(0, is_node_of_type_1.isObjectPattern)(requireNode.id)) {
            return undefined;
        }
        const property = requireNode.id.properties.find((n) => (0, is_node_of_type_1.isProperty)(n) &&
            utils_1.ASTUtils.isIdentifier(n.key) &&
            n.key.name === specifierName);
        if (!property) {
            return undefined;
        }
        return property.key;
    }
}
