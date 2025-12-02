"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AndWrapper = exports.OrWrapper = exports.AliasedExpressionWrapper = exports.ExpressionWrapper = void 0;
const alias_node_js_1 = require("../operation-node/alias-node.js");
const and_node_js_1 = require("../operation-node/and-node.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const or_node_js_1 = require("../operation-node/or-node.js");
const parens_node_js_1 = require("../operation-node/parens-node.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
class ExpressionWrapper {
    #node;
    constructor(node) {
        this.#node = node;
    }
    /** @private */
    get expressionType() {
        return undefined;
    }
    as(alias) {
        return new AliasedExpressionWrapper(this, alias);
    }
    or(...args) {
        return new OrWrapper(or_node_js_1.OrNode.create(this.#node, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)));
    }
    and(...args) {
        return new AndWrapper(and_node_js_1.AndNode.create(this.#node, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)));
    }
    /**
     * Change the output type of the expression.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `ExpressionWrapper` with a new output type.
     */
    $castTo() {
        return new ExpressionWrapper(this.#node);
    }
    /**
     * Omit null from the expression's type.
     *
     * This function can be useful in cases where you know an expression can't be
     * null, but Kysely is unable to infer it.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of `this` with a new output type.
     */
    $notNull() {
        return new ExpressionWrapper(this.#node);
    }
    toOperationNode() {
        return this.#node;
    }
}
exports.ExpressionWrapper = ExpressionWrapper;
class AliasedExpressionWrapper {
    #expr;
    #alias;
    constructor(expr, alias) {
        this.#expr = expr;
        this.#alias = alias;
    }
    /** @private */
    get expression() {
        return this.#expr;
    }
    /** @private */
    get alias() {
        return this.#alias;
    }
    toOperationNode() {
        return alias_node_js_1.AliasNode.create(this.#expr.toOperationNode(), (0, operation_node_source_js_1.isOperationNodeSource)(this.#alias)
            ? this.#alias.toOperationNode()
            : identifier_node_js_1.IdentifierNode.create(this.#alias));
    }
}
exports.AliasedExpressionWrapper = AliasedExpressionWrapper;
class OrWrapper {
    #node;
    constructor(node) {
        this.#node = node;
    }
    /** @private */
    get expressionType() {
        return undefined;
    }
    as(alias) {
        return new AliasedExpressionWrapper(this, alias);
    }
    or(...args) {
        return new OrWrapper(or_node_js_1.OrNode.create(this.#node, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)));
    }
    /**
     * Change the output type of the expression.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `OrWrapper` with a new output type.
     */
    $castTo() {
        return new OrWrapper(this.#node);
    }
    toOperationNode() {
        return parens_node_js_1.ParensNode.create(this.#node);
    }
}
exports.OrWrapper = OrWrapper;
class AndWrapper {
    #node;
    constructor(node) {
        this.#node = node;
    }
    /** @private */
    get expressionType() {
        return undefined;
    }
    as(alias) {
        return new AliasedExpressionWrapper(this, alias);
    }
    and(...args) {
        return new AndWrapper(and_node_js_1.AndNode.create(this.#node, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)));
    }
    /**
     * Change the output type of the expression.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `AndWrapper` with a new output type.
     */
    $castTo() {
        return new AndWrapper(this.#node);
    }
    toOperationNode() {
        return parens_node_js_1.ParensNode.create(this.#node);
    }
}
exports.AndWrapper = AndWrapper;
