"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetOperationNode = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
/**
 * @internal
 */
exports.SetOperationNode = (0, object_utils_js_1.freeze)({
    is(node) {
        return node.kind === 'SetOperationNode';
    },
    create(operator, expression, all) {
        return (0, object_utils_js_1.freeze)({
            kind: 'SetOperationNode',
            operator,
            expression,
            all,
        });
    },
});
