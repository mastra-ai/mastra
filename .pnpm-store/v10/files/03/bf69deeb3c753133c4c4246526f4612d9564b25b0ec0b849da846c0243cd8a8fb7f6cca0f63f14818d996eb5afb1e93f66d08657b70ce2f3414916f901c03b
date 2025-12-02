"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSavepointCommand = parseSavepointCommand;
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
function parseSavepointCommand(command, savepointName) {
    return raw_node_js_1.RawNode.createWithChildren([
        raw_node_js_1.RawNode.createWithSql(`${command} `),
        identifier_node_js_1.IdentifierNode.create(savepointName), // ensures savepointName gets sanitized
    ]);
}
