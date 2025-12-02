"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CTEBuilder = void 0;
const common_table_expression_node_js_1 = require("../operation-node/common-table-expression-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
class CTEBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Makes the common table expression materialized.
     */
    materialized() {
        return new CTEBuilder({
            ...this.#props,
            node: common_table_expression_node_js_1.CommonTableExpressionNode.cloneWith(this.#props.node, {
                materialized: true,
            }),
        });
    }
    /**
     * Makes the common table expression not materialized.
     */
    notMaterialized() {
        return new CTEBuilder({
            ...this.#props,
            node: common_table_expression_node_js_1.CommonTableExpressionNode.cloneWith(this.#props.node, {
                materialized: false,
            }),
        });
    }
    toOperationNode() {
        return this.#props.node;
    }
}
exports.CTEBuilder = CTEBuilder;
