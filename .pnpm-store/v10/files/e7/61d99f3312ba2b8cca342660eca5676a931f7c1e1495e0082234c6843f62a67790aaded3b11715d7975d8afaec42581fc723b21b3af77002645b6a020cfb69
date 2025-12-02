"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOnModifyForeignAction = parseOnModifyForeignAction;
const references_node_js_1 = require("../operation-node/references-node.js");
function parseOnModifyForeignAction(action) {
    if (references_node_js_1.ON_MODIFY_FOREIGN_ACTIONS.includes(action)) {
        return action;
    }
    throw new Error(`invalid OnModifyForeignAction ${action}`);
}
