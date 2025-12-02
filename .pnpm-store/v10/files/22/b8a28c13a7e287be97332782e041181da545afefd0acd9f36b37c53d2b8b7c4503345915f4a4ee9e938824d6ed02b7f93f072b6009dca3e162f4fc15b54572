"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseEndBuilder = exports.CaseWhenBuilder = exports.CaseThenBuilder = exports.CaseBuilder = void 0;
const expression_wrapper_js_1 = require("../expression/expression-wrapper.js");
const object_utils_js_1 = require("../util/object-utils.js");
const case_node_js_1 = require("../operation-node/case-node.js");
const when_node_js_1 = require("../operation-node/when-node.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
const value_parser_js_1 = require("../parser/value-parser.js");
class CaseBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    when(...args) {
        return new CaseThenBuilder({
            ...this.#props,
            node: case_node_js_1.CaseNode.cloneWithWhen(this.#props.node, when_node_js_1.WhenNode.create((0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args))),
        });
    }
}
exports.CaseBuilder = CaseBuilder;
class CaseThenBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    then(valueExpression) {
        return new CaseWhenBuilder({
            ...this.#props,
            node: case_node_js_1.CaseNode.cloneWithThen(this.#props.node, (0, value_parser_js_1.isSafeImmediateValue)(valueExpression)
                ? (0, value_parser_js_1.parseSafeImmediateValue)(valueExpression)
                : (0, value_parser_js_1.parseValueExpression)(valueExpression)),
        });
    }
}
exports.CaseThenBuilder = CaseThenBuilder;
class CaseWhenBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    when(...args) {
        return new CaseThenBuilder({
            ...this.#props,
            node: case_node_js_1.CaseNode.cloneWithWhen(this.#props.node, when_node_js_1.WhenNode.create((0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args))),
        });
    }
    else(valueExpression) {
        return new CaseEndBuilder({
            ...this.#props,
            node: case_node_js_1.CaseNode.cloneWith(this.#props.node, {
                else: (0, value_parser_js_1.isSafeImmediateValue)(valueExpression)
                    ? (0, value_parser_js_1.parseSafeImmediateValue)(valueExpression)
                    : (0, value_parser_js_1.parseValueExpression)(valueExpression),
            }),
        });
    }
    end() {
        return new expression_wrapper_js_1.ExpressionWrapper(case_node_js_1.CaseNode.cloneWith(this.#props.node, { isStatement: false }));
    }
    endCase() {
        return new expression_wrapper_js_1.ExpressionWrapper(case_node_js_1.CaseNode.cloneWith(this.#props.node, { isStatement: true }));
    }
}
exports.CaseWhenBuilder = CaseWhenBuilder;
class CaseEndBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    end() {
        return new expression_wrapper_js_1.ExpressionWrapper(case_node_js_1.CaseNode.cloneWith(this.#props.node, { isStatement: false }));
    }
    endCase() {
        return new expression_wrapper_js_1.ExpressionWrapper(case_node_js_1.CaseNode.cloneWith(this.#props.node, { isStatement: true }));
    }
}
exports.CaseEndBuilder = CaseEndBuilder;
