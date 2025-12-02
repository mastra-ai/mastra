"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessorValue = exports.isSupportedAccessor = exports.isIdentifier = exports.getStringValue = exports.isStringNode = void 0;
const utils_1 = require("@typescript-eslint/utils");
const is_node_of_type_1 = require("./is-node-of-type");
const isStringLiteral = (node, value) => (0, is_node_of_type_1.isLiteral)(node) &&
    typeof node.value === 'string' &&
    (value === undefined || node.value === value);
const isSimpleTemplateLiteral = (node, value) => (0, is_node_of_type_1.isTemplateLiteral)(node) &&
    node.quasis.length === 1 &&
    (value === undefined || node.quasis[0].value.raw === value);
const isStringNode = (node, specifics) => isStringLiteral(node, specifics) || isSimpleTemplateLiteral(node, specifics);
exports.isStringNode = isStringNode;
const getStringValue = (node) => isSimpleTemplateLiteral(node) ? node.quasis[0].value.raw : node.value;
exports.getStringValue = getStringValue;
const isIdentifier = (node, name) => utils_1.ASTUtils.isIdentifier(node) && (name === undefined || node.name === name);
exports.isIdentifier = isIdentifier;
const isSupportedAccessor = (node, value) => (0, exports.isIdentifier)(node, value) || (0, exports.isStringNode)(node, value);
exports.isSupportedAccessor = isSupportedAccessor;
const getAccessorValue = (accessor) => accessor.type === utils_1.AST_NODE_TYPES.Identifier
    ? accessor.name
    : (0, exports.getStringValue)(accessor);
exports.getAccessorValue = getAccessorValue;
