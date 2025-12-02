"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.functions = void 0;
exports.replaceNumberTypes = replaceNumberTypes;
const strictMap_1 = require("../strictMap");
const types_1 = require("./types");
const functions = async (cxn) => {
    const functionsJson = await cxn.queryJSON(`
    with module schema
    select Function {
      id,
      name,
      annotations: {
        name,
        @value
      } filter .name = 'std::description',
      return_type: {id, name},
      return_typemod,
      params: {
        name,
        type: {id, name},
        kind,
        typemod,
        hasDefault := exists .default,
      } order by @index,
      preserves_optionality,
    } filter .internal = false
  `);
    const functionMap = new strictMap_1.StrictMap();
    const seenFuncDefHashes = new Set();
    for (const func of JSON.parse(functionsJson)) {
        const { name } = func;
        const funcDef = {
            ...func,
            description: func.annotations[0]?.["@value"],
        };
        replaceNumberTypes(funcDef);
        const hash = hashFuncDef(funcDef);
        if (!seenFuncDefHashes.has(hash)) {
            if (!functionMap.has(name)) {
                functionMap.set(name, [funcDef]);
            }
            else {
                functionMap.get(name).push(funcDef);
            }
            seenFuncDefHashes.add(hash);
        }
    }
    return functionMap;
};
exports.functions = functions;
function replaceNumberTypes(def) {
    if (types_1.typeMapping.has(def.return_type.id)) {
        const type = types_1.typeMapping.get(def.return_type.id);
        def.return_type = {
            id: type.id,
            name: type.name,
        };
    }
    for (const param of def.params) {
        if (types_1.typeMapping.has(param.type.id)) {
            const type = types_1.typeMapping.get(param.type.id);
            param.type = {
                id: type.id,
                name: type.name,
            };
        }
    }
}
function hashFuncDef(def) {
    return JSON.stringify({
        name: def.name,
        return_type: def.return_type.id,
        return_typemod: def.return_typemod,
        params: def.params
            .map((param) => JSON.stringify({
            kind: param.kind,
            type: param.type.id,
            typemod: param.typemod,
            hasDefault: !!param.hasDefault,
        }))
            .sort(),
        preserves_optionality: def.preserves_optionality,
    });
}
