"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lodashSpecifiersToEs = lodashSpecifiersToEs;
/**
 * Turns a generic lodash import into a specific import referencing the "lodash-es"
 * pacakge. Note that lodash-es cannot be imported from CommonJS.
 *
 * @param base "lodash" or "lodash/fp"
 * @param specifiers from an AST; assumes they are all ImportSpecifiers
 */
function lodashSpecifiersToEs(base, specifiers) {
    const isFp = base.endsWith("fp");
    return specifiers.map(({ imported, local }) => `import { ${imported.name !== local.name
        ? imported.name + " as " + local.name
        : local.name} } from "lodash-es${isFp ? "/fp" : ""}";`);
}
//# sourceMappingURL=lodash-specifiers-to-es.js.map