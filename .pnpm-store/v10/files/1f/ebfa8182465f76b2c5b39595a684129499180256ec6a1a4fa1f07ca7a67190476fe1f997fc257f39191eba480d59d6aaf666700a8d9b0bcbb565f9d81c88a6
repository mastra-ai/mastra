"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinBuilder = void 0;
const join_node_js_1 = require("../operation-node/join-node.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
class JoinBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    on(...args) {
        return new JoinBuilder({
            ...this.#props,
            joinNode: join_node_js_1.JoinNode.cloneWithOn(this.#props.joinNode, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)),
        });
    }
    /**
     * Just like {@link WhereInterface.whereRef} but adds an item to the join's
     * `on` clause instead.
     *
     * See {@link WhereInterface.whereRef} for documentation and examples.
     */
    onRef(lhs, op, rhs) {
        return new JoinBuilder({
            ...this.#props,
            joinNode: join_node_js_1.JoinNode.cloneWithOn(this.#props.joinNode, (0, binary_operation_parser_js_1.parseReferentialBinaryOperation)(lhs, op, rhs)),
        });
    }
    /**
     * Adds `on true`.
     */
    onTrue() {
        return new JoinBuilder({
            ...this.#props,
            joinNode: join_node_js_1.JoinNode.cloneWithOn(this.#props.joinNode, raw_node_js_1.RawNode.createWithSql('true')),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#props.joinNode;
    }
}
exports.JoinBuilder = JoinBuilder;
