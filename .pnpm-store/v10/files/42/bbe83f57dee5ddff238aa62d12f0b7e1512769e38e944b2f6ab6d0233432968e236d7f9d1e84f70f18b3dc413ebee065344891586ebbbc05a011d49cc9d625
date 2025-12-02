"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompiledQuery = void 0;
const raw_node_js_1 = require("../operation-node/raw-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const query_id_js_1 = require("../util/query-id.js");
exports.CompiledQuery = (0, object_utils_js_1.freeze)({
    raw(sql, parameters = []) {
        return (0, object_utils_js_1.freeze)({
            sql,
            query: raw_node_js_1.RawNode.createWithSql(sql),
            parameters: (0, object_utils_js_1.freeze)(parameters),
            queryId: (0, query_id_js_1.createQueryId)(),
        });
    },
});
