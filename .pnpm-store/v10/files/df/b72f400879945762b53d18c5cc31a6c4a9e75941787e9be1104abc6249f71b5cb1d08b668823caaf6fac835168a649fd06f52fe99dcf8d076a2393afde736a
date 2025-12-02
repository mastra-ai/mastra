"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lodashSpecifiersToCjs = lodashSpecifiersToCjs;
/**
 * Turns a generic lodash import into a specific import using the CommonJS
 * lodash package.
 *
 * @param base "lodash" or "lodash/fp"
 * @param specifiers from an AST; assumes they are all ImportSpecifiers
 * @param appendDotJs optional, default is true; adds '.js' to the end of imports
 */
function lodashSpecifiersToCjs(base, specifiers, appendDotJs = true) {
    return specifiers.map(({ imported, local }) => `import ${imported.name !== local.name ? local.name : imported.name} from "${base}/${imported.name}${appendDotJs ? ".js" : ""}";`);
}
//# sourceMappingURL=lodash-specifiers-to-cjs.js.map