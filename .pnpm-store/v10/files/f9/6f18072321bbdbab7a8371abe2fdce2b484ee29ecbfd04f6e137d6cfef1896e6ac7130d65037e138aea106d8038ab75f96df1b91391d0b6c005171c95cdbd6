"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicReferenceBuilder = void 0;
exports.isDynamicReferenceBuilder = isDynamicReferenceBuilder;
const operation_node_source_js_1 = require("../operation-node/operation-node-source.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
class DynamicReferenceBuilder {
    #dynamicReference;
    get dynamicReference() {
        return this.#dynamicReference;
    }
    /**
     * @private
     *
     * This needs to be here just so that the typings work. Without this
     * the generated .d.ts file contains no reference to the type param R
     * which causes this type to be equal to DynamicReferenceBuilder with
     * any R.
     */
    get refType() {
        return undefined;
    }
    constructor(reference) {
        this.#dynamicReference = reference;
    }
    toOperationNode() {
        return (0, reference_parser_js_1.parseSimpleReferenceExpression)(this.#dynamicReference);
    }
}
exports.DynamicReferenceBuilder = DynamicReferenceBuilder;
function isDynamicReferenceBuilder(obj) {
    return ((0, object_utils_js_1.isObject)(obj) &&
        (0, operation_node_source_js_1.isOperationNodeSource)(obj) &&
        (0, object_utils_js_1.isString)(obj.dynamicReference));
}
