/// <reference types="./dynamic-reference-builder.d.ts" />
import { isOperationNodeSource, } from '../operation-node/operation-node-source.js';
import { parseSimpleReferenceExpression } from '../parser/reference-parser.js';
import { isObject, isString } from '../util/object-utils.js';
export class DynamicReferenceBuilder {
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
        return parseSimpleReferenceExpression(this.#dynamicReference);
    }
}
export function isDynamicReferenceBuilder(obj) {
    return (isObject(obj) &&
        isOperationNodeSource(obj) &&
        isString(obj.dynamicReference));
}
