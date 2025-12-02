"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderByItemBuilder = void 0;
const collate_node_js_1 = require("../operation-node/collate-node.js");
const order_by_item_node_js_1 = require("../operation-node/order-by-item-node.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
class OrderByItemBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Adds `desc` to the `order by` item.
     *
     * See {@link asc} for the opposite.
     */
    desc() {
        return new OrderByItemBuilder({
            node: order_by_item_node_js_1.OrderByItemNode.cloneWith(this.#props.node, {
                direction: raw_node_js_1.RawNode.createWithSql('desc'),
            }),
        });
    }
    /**
     * Adds `asc` to the `order by` item.
     *
     * See {@link desc} for the opposite.
     */
    asc() {
        return new OrderByItemBuilder({
            node: order_by_item_node_js_1.OrderByItemNode.cloneWith(this.#props.node, {
                direction: raw_node_js_1.RawNode.createWithSql('asc'),
            }),
        });
    }
    /**
     * Adds `nulls last` to the `order by` item.
     *
     * This is only supported by some dialects like PostgreSQL and SQLite.
     *
     * See {@link nullsFirst} for the opposite.
     */
    nullsLast() {
        return new OrderByItemBuilder({
            node: order_by_item_node_js_1.OrderByItemNode.cloneWith(this.#props.node, { nulls: 'last' }),
        });
    }
    /**
     * Adds `nulls first` to the `order by` item.
     *
     * This is only supported by some dialects like PostgreSQL and SQLite.
     *
     * See {@link nullsLast} for the opposite.
     */
    nullsFirst() {
        return new OrderByItemBuilder({
            node: order_by_item_node_js_1.OrderByItemNode.cloneWith(this.#props.node, { nulls: 'first' }),
        });
    }
    /**
     * Adds `collate <collationName>` to the `order by` item.
     */
    collate(collation) {
        return new OrderByItemBuilder({
            node: order_by_item_node_js_1.OrderByItemNode.cloneWith(this.#props.node, {
                collation: collate_node_js_1.CollateNode.create(collation),
            }),
        });
    }
    toOperationNode() {
        return this.#props.node;
    }
}
exports.OrderByItemBuilder = OrderByItemBuilder;
