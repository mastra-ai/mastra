"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULE_NAME = void 0;
exports.getFindByQueryVariant = getFindByQueryVariant;
const utils_1 = require("@typescript-eslint/utils");
const create_testing_library_rule_1 = require("../create-testing-library-rule");
const node_utils_1 = require("../node-utils");
const utils_2 = require("../utils");
exports.RULE_NAME = 'prefer-find-by';
function getFindByQueryVariant(queryMethod) {
    return queryMethod.includes('All') ? 'findAllBy' : 'findBy';
}
function findRenderDefinitionDeclaration(scope, query) {
    var _a;
    if (!scope) {
        return null;
    }
    const variable = scope.variables.find((v) => v.name === query);
    if (variable) {
        return ((_a = variable.defs
            .map(({ name }) => name)
            .filter(utils_1.ASTUtils.isIdentifier)
            .find(({ name }) => name === query)) !== null && _a !== void 0 ? _a : null);
    }
    return findRenderDefinitionDeclaration(scope.upper, query);
}
exports.default = (0, create_testing_library_rule_1.createTestingLibraryRule)({
    name: exports.RULE_NAME,
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Suggest using `find(All)By*` query instead of `waitFor` + `get(All)By*` to wait for elements',
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
            preferFindBy: 'Prefer `{{queryVariant}}{{queryMethod}}` query over using `waitFor` + `{{prevQuery}}`',
        },
        fixable: 'code',
        schema: [],
    },
    defaultOptions: [],
    create(context, _, helpers) {
        const sourceCode = (0, utils_2.getSourceCode)(context);
        function reportInvalidUsage(node, replacementParams) {
            const { queryMethod, queryVariant, prevQuery, fix } = replacementParams;
            context.report({
                node,
                messageId: 'preferFindBy',
                data: {
                    queryVariant,
                    queryMethod,
                    prevQuery,
                },
                fix,
            });
        }
        function getWrongQueryNameInAssertion(node) {
            if (!(0, node_utils_1.isCallExpression)(node.body) ||
                !(0, node_utils_1.isMemberExpression)(node.body.callee)) {
                return null;
            }
            if ((0, node_utils_1.isCallExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.arguments[0]) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.arguments[0].callee)) {
                return node.body.callee.object.arguments[0].callee;
            }
            if (!utils_1.ASTUtils.isIdentifier(node.body.callee.property)) {
                return null;
            }
            if ((0, node_utils_1.isCallExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.arguments[0]) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object.arguments[0].callee) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.arguments[0].callee.property)) {
                return node.body.callee.object.arguments[0].callee.property;
            }
            if ((0, node_utils_1.isMemberExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object.arguments[0]) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object.object.arguments[0].callee) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.object.arguments[0].callee.property)) {
                return node.body.callee.object.object.arguments[0].callee.property;
            }
            if ((0, node_utils_1.isMemberExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object.arguments[0]) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.object.arguments[0].callee)) {
                return node.body.callee.object.object.arguments[0].callee;
            }
            return node.body.callee.property;
        }
        function getWrongQueryName(node) {
            if (!(0, node_utils_1.isCallExpression)(node.body)) {
                return null;
            }
            if (utils_1.ASTUtils.isIdentifier(node.body.callee) &&
                helpers.isSyncQuery(node.body.callee)) {
                return node.body.callee;
            }
            return getWrongQueryNameInAssertion(node);
        }
        function getCaller(node) {
            if (!(0, node_utils_1.isCallExpression)(node.body) ||
                !(0, node_utils_1.isMemberExpression)(node.body.callee)) {
                return null;
            }
            if (utils_1.ASTUtils.isIdentifier(node.body.callee.object)) {
                return node.body.callee.object.name;
            }
            if ((0, node_utils_1.isCallExpression)(node.body.callee.object) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.callee) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.arguments[0]) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object.arguments[0].callee) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.arguments[0].callee.object)) {
                return node.body.callee.object.arguments[0].callee.object.name;
            }
            if ((0, node_utils_1.isMemberExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object.arguments[0]) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object.object.arguments[0].callee) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.object.arguments[0].callee.object)) {
                return node.body.callee.object.object.arguments[0].callee.object.name;
            }
            return null;
        }
        function isSyncQuery(node) {
            if (!(0, node_utils_1.isCallExpression)(node.body)) {
                return false;
            }
            const isQuery = utils_1.ASTUtils.isIdentifier(node.body.callee) &&
                helpers.isSyncQuery(node.body.callee);
            const isWrappedInPresenceAssert = (0, node_utils_1.isMemberExpression)(node.body.callee) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.arguments[0]) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.arguments[0].callee) &&
                helpers.isSyncQuery(node.body.callee.object.arguments[0].callee) &&
                helpers.isPresenceAssert(node.body.callee);
            const isWrappedInNegatedPresenceAssert = (0, node_utils_1.isMemberExpression)(node.body.callee) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object.arguments[0]) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.object.arguments[0].callee) &&
                helpers.isSyncQuery(node.body.callee.object.object.arguments[0].callee) &&
                helpers.isPresenceAssert(node.body.callee.object);
            return (isQuery || isWrappedInPresenceAssert || isWrappedInNegatedPresenceAssert);
        }
        function isScreenSyncQuery(node) {
            if (!(0, node_utils_1.isArrowFunctionExpression)(node) || !(0, node_utils_1.isCallExpression)(node.body)) {
                return false;
            }
            if (!(0, node_utils_1.isMemberExpression)(node.body.callee) ||
                !utils_1.ASTUtils.isIdentifier(node.body.callee.property)) {
                return false;
            }
            if (!utils_1.ASTUtils.isIdentifier(node.body.callee.object) &&
                !(0, node_utils_1.isCallExpression)(node.body.callee.object) &&
                !(0, node_utils_1.isMemberExpression)(node.body.callee.object)) {
                return false;
            }
            const isWrappedInPresenceAssert = helpers.isPresenceAssert(node.body.callee) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.arguments[0]) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object.arguments[0].callee) &&
                utils_1.ASTUtils.isIdentifier(node.body.callee.object.arguments[0].callee.object);
            const isWrappedInNegatedPresenceAssert = (0, node_utils_1.isMemberExpression)(node.body.callee.object) &&
                helpers.isPresenceAssert(node.body.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object) &&
                (0, node_utils_1.isCallExpression)(node.body.callee.object.object.arguments[0]) &&
                (0, node_utils_1.isMemberExpression)(node.body.callee.object.object.arguments[0].callee);
            return (helpers.isSyncQuery(node.body.callee.property) ||
                isWrappedInPresenceAssert ||
                isWrappedInNegatedPresenceAssert);
        }
        function getQueryArguments(node) {
            if ((0, node_utils_1.isMemberExpression)(node.callee) &&
                (0, node_utils_1.isCallExpression)(node.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.callee.object.arguments[0])) {
                return node.callee.object.arguments[0].arguments;
            }
            if ((0, node_utils_1.isMemberExpression)(node.callee) &&
                (0, node_utils_1.isMemberExpression)(node.callee.object) &&
                (0, node_utils_1.isCallExpression)(node.callee.object.object) &&
                (0, node_utils_1.isCallExpression)(node.callee.object.object.arguments[0])) {
                return node.callee.object.object.arguments[0].arguments;
            }
            return node.arguments;
        }
        return {
            'AwaitExpression > CallExpression'(node) {
                var _a;
                if (!utils_1.ASTUtils.isIdentifier(node.callee) ||
                    !helpers.isAsyncUtil(node.callee, ['waitFor'])) {
                    return;
                }
                const argument = node.arguments[0];
                if (!(0, node_utils_1.isArrowFunctionExpression)(argument)) {
                    return;
                }
                if ((0, node_utils_1.isBlockStatement)(argument.body) && argument.async) {
                    const { body } = argument.body;
                    const declarations = (_a = body
                        .filter(node_utils_1.isVariableDeclaration)) === null || _a === void 0 ? void 0 : _a.flatMap((declaration) => declaration.declarations);
                    const findByDeclarator = declarations.find((declaration) => {
                        if (!utils_1.ASTUtils.isAwaitExpression(declaration.init) ||
                            !(0, node_utils_1.isCallExpression)(declaration.init.argument)) {
                            return false;
                        }
                        const { callee } = declaration.init.argument;
                        const node = (0, node_utils_1.getDeepestIdentifierNode)(callee);
                        return node ? helpers.isFindQueryVariant(node) : false;
                    });
                    const init = utils_1.ASTUtils.isAwaitExpression(findByDeclarator === null || findByDeclarator === void 0 ? void 0 : findByDeclarator.init)
                        ? findByDeclarator.init.argument
                        : null;
                    if (!(0, node_utils_1.isCallExpression)(init)) {
                        return;
                    }
                    const queryIdentifier = (0, node_utils_1.getDeepestIdentifierNode)(init.callee);
                    if (!queryIdentifier || !helpers.isAsyncQuery(queryIdentifier)) {
                        return;
                    }
                    const fullQueryMethod = queryIdentifier.name;
                    const queryMethod = fullQueryMethod.split('By')[1];
                    const queryVariant = getFindByQueryVariant(fullQueryMethod);
                    reportInvalidUsage(node, {
                        queryMethod,
                        queryVariant,
                        prevQuery: fullQueryMethod,
                        fix(fixer) {
                            const { parent: expressionStatement } = node.parent;
                            const bodyText = sourceCode
                                .getText(argument.body)
                                .slice(1, -1)
                                .trim();
                            const { line, column } = expressionStatement.loc.start;
                            const indent = sourceCode.getLines()[line - 1].slice(0, column);
                            const newText = bodyText
                                .split('\n')
                                .map((line) => line.trim())
                                .join(`\n${indent}`);
                            return fixer.replaceText(expressionStatement, newText);
                        },
                    });
                    return;
                }
                if (!(0, node_utils_1.isCallExpression)(argument.body)) {
                    return;
                }
                if (isScreenSyncQuery(argument)) {
                    const caller = getCaller(argument);
                    if (!caller) {
                        return;
                    }
                    const fullQueryMethodNode = getWrongQueryName(argument);
                    if (!fullQueryMethodNode) {
                        return;
                    }
                    const fullQueryMethod = fullQueryMethodNode.name;
                    const waitOptions = node.arguments[1];
                    let waitOptionsSourceCode = '';
                    if ((0, node_utils_1.isObjectExpression)(waitOptions)) {
                        waitOptionsSourceCode = `, ${sourceCode.getText(waitOptions)}`;
                    }
                    const queryVariant = getFindByQueryVariant(fullQueryMethod);
                    const callArguments = getQueryArguments(argument.body);
                    const queryMethod = fullQueryMethod.split('By')[1];
                    if (!queryMethod) {
                        return;
                    }
                    reportInvalidUsage(node, {
                        queryMethod,
                        queryVariant,
                        prevQuery: fullQueryMethod,
                        fix(fixer) {
                            const property = argument.body
                                .callee.property;
                            if (helpers.isCustomQuery(property)) {
                                return null;
                            }
                            const newCode = `${caller}.${queryVariant}${queryMethod}(${callArguments
                                .map((callArgNode) => sourceCode.getText(callArgNode))
                                .join(', ')}${waitOptionsSourceCode})`;
                            return fixer.replaceText(node, newCode);
                        },
                    });
                    return;
                }
                if (!isSyncQuery(argument)) {
                    return;
                }
                const fullQueryMethodNode = getWrongQueryName(argument);
                if (!fullQueryMethodNode) {
                    return;
                }
                const fullQueryMethod = fullQueryMethodNode.name;
                const queryMethod = fullQueryMethod.split('By')[1];
                const queryVariant = getFindByQueryVariant(fullQueryMethod);
                const callArguments = getQueryArguments(argument.body);
                reportInvalidUsage(node, {
                    queryMethod,
                    queryVariant,
                    prevQuery: fullQueryMethod,
                    fix(fixer) {
                        if (helpers.isCustomQuery(argument.body
                            .callee)) {
                            return null;
                        }
                        const findByMethod = `${queryVariant}${queryMethod}`;
                        const allFixes = [];
                        const newCode = `${findByMethod}(${callArguments
                            .map((callArgNode) => sourceCode.getText(callArgNode))
                            .join(', ')})`;
                        allFixes.push(fixer.replaceText(node, newCode));
                        const definition = findRenderDefinitionDeclaration((0, utils_2.getScope)(context, fullQueryMethodNode), fullQueryMethod);
                        if (!definition) {
                            return allFixes;
                        }
                        if (definition.parent &&
                            (0, node_utils_1.isObjectPattern)(definition.parent.parent)) {
                            const allVariableDeclarations = definition.parent.parent;
                            if (allVariableDeclarations.properties.some((p) => (0, node_utils_1.isProperty)(p) &&
                                utils_1.ASTUtils.isIdentifier(p.key) &&
                                p.key.name === findByMethod)) {
                                return allFixes;
                            }
                            const textDestructuring = sourceCode.getText(allVariableDeclarations);
                            const text = textDestructuring.replace(/(\s*})$/, `, ${findByMethod}$1`);
                            allFixes.push(fixer.replaceText(allVariableDeclarations, text));
                        }
                        return allFixes;
                    },
                });
            },
        };
    },
});
