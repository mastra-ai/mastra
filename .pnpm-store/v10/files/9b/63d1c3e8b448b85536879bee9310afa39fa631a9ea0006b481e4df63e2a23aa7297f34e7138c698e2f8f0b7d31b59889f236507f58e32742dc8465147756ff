"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSchemableIdentifier = parseSchemableIdentifier;
const schemable_identifier_node_js_1 = require("../operation-node/schemable-identifier-node.js");
function parseSchemableIdentifier(id) {
    const SCHEMA_SEPARATOR = '.';
    if (id.includes(SCHEMA_SEPARATOR)) {
        const parts = id.split(SCHEMA_SEPARATOR).map(trim);
        if (parts.length === 2) {
            return schemable_identifier_node_js_1.SchemableIdentifierNode.createWithSchema(parts[0], parts[1]);
        }
        else {
            throw new Error(`invalid schemable identifier ${id}`);
        }
    }
    else {
        return schemable_identifier_node_js_1.SchemableIdentifierNode.create(id);
    }
}
function trim(str) {
    return str.trim();
}
