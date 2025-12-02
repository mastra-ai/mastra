"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveToTestingLibraryFn = exports.getNodeChain = void 0;
const scope_manager_1 = require("@typescript-eslint/scope-manager");
const utils_1 = require("@typescript-eslint/utils");
const node_utils_1 = require("../node-utils");
const is_testing_library_module_1 = require("./is-testing-library-module");
const accessors_1 = require("../node-utils/accessors");
const describeImportDefAsImport = (def) => {
    if ((0, node_utils_1.isTSImportEqualsDeclaration)(def.parent)) {
        return null;
    }
    if ((0, node_utils_1.isImportDefaultSpecifier)(def.node)) {
        return {
            source: def.parent.source.value,
            imported: null,
            local: def.node.local.name,
        };
    }
    if (!(0, node_utils_1.isImportSpecifier)(def.node)) {
        return null;
    }
    if (def.parent.importKind === 'type') {
        return null;
    }
    return {
        source: def.parent.source.value,
        imported: 'name' in def.node.imported
            ? def.node.imported.name
            : def.node.imported.value,
        local: def.node.local.name,
    };
};
const describeVariableDefAsImport = (def) => {
    if (!def.node.init)
        return null;
    const sourceNode = (0, node_utils_1.isCallExpression)(def.node.init) &&
        (0, accessors_1.isIdentifier)(def.node.init.callee, 'require')
        ? def.node.init.arguments[0]
        : utils_1.ASTUtils.isAwaitExpression(def.node.init) &&
            (0, node_utils_1.isImportExpression)(def.node.init.argument)
            ? def.node.init.argument.source
            : null;
    if (!sourceNode || !(0, accessors_1.isStringNode)(sourceNode))
        return null;
    if (!(0, node_utils_1.isProperty)(def.name.parent))
        return null;
    if (!(0, accessors_1.isSupportedAccessor)(def.name.parent.key))
        return null;
    return {
        source: (0, accessors_1.getStringValue)(sourceNode),
        imported: (0, accessors_1.getAccessorValue)(def.name.parent.key),
        local: def.name.name,
    };
};
const describePossibleImportDef = (def) => {
    if (def.type === scope_manager_1.DefinitionType.Variable) {
        return describeVariableDefAsImport(def);
    }
    if (def.type === scope_manager_1.DefinitionType.ImportBinding) {
        return describeImportDefAsImport(def);
    }
    return null;
};
const resolveScope = (scope, identifier) => {
    let currentScope = scope;
    while (currentScope !== null) {
        const ref = currentScope.set.get(identifier);
        if (ref && ref.defs.length > 0) {
            const def = ref.defs[ref.defs.length - 1];
            const importDetails = describePossibleImportDef(def);
            if ((importDetails === null || importDetails === void 0 ? void 0 : importDetails.local) === identifier) {
                return importDetails;
            }
            return 'local';
        }
        currentScope = currentScope.upper;
    }
    return null;
};
const joinChains = (a, b) => (a && b ? [...a, ...b] : null);
const getNodeChain = (node) => {
    if ((0, accessors_1.isSupportedAccessor)(node)) {
        return [node];
    }
    switch (node.type) {
        case utils_1.AST_NODE_TYPES.MemberExpression:
            return joinChains((0, exports.getNodeChain)(node.object), (0, exports.getNodeChain)(node.property));
        case utils_1.AST_NODE_TYPES.CallExpression:
            return (0, exports.getNodeChain)(node.callee);
    }
    return null;
};
exports.getNodeChain = getNodeChain;
const resolveToTestingLibraryFn = (node, context) => {
    const chain = (0, exports.getNodeChain)(node);
    if (!(chain === null || chain === void 0 ? void 0 : chain.length))
        return null;
    const identifier = chain[0];
    const scope = context.sourceCode.getScope(identifier);
    const maybeImport = resolveScope(scope, (0, accessors_1.getAccessorValue)(identifier));
    if (maybeImport === 'local' || maybeImport === null) {
        return null;
    }
    const customModuleSetting = context.settings['testing-library/utils-module'];
    if ((0, is_testing_library_module_1.isTestingLibraryModule)(maybeImport.source, customModuleSetting)) {
        return {
            original: maybeImport.imported,
            local: maybeImport.local,
        };
    }
    return null;
};
exports.resolveToTestingLibraryFn = resolveToTestingLibraryFn;
