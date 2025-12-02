"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addJsdocs = exports.expandJsdocs = void 0;
const expandJsdocs = (jsdocs) => {
    const lines = jsdocs.split("\n");
    const result = lines.length === 1
        ? lines[0]
        : `\n${lines.map(x => `* ${x}`)
            .join("\n")}\n`;
    return `/**${result}*/\n`;
};
exports.expandJsdocs = expandJsdocs;
const addJsdocs = (schema, parsed) => {
    const description = schema.description;
    if (!description) {
        return parsed;
    }
    return `\n${(0, exports.expandJsdocs)(description)}${parsed}`;
};
exports.addJsdocs = addJsdocs;
