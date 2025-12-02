"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globals = globals;
async function globals(cxn) {
    const globalsMap = new Map();
    const version = await cxn.queryRequiredSingle(`select sys::get_version().major;`);
    if (version === 1) {
        return globalsMap;
    }
    const QUERY = `
    WITH
      MODULE schema
    SELECT schema::Global {
      id,
      name,
      target_id := .target.id,
      card := ("One" IF .required ELSE "One" IF EXISTS .default ELSE "AtMostOne")
        IF <str>.cardinality = "One" ELSE
        ("AtLeastOne" IF .required ELSE "Many"),
      has_default := exists .default,
    }
    ORDER BY .name;
  `;
    const allGlobals = JSON.parse(await cxn.queryJSON(QUERY));
    for (const g of allGlobals) {
        globalsMap.set(g.id, g);
    }
    return globalsMap;
}
