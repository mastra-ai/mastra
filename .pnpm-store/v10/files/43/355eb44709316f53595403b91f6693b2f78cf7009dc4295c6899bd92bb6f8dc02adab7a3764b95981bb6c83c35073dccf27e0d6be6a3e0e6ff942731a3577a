import { visitors } from '@babel/traverse';
import getNameOrValue from './getNameOrValue.js';
import { String as toString } from './expressionTo.js';
import isReactForwardRefCall from './isReactForwardRefCall.js';
function resolveName(path) {
    if (path.isVariableDeclaration()) {
        const declarations = path.get('declarations');
        if (declarations.length > 1) {
            throw new TypeError('Got unsupported VariableDeclaration. VariableDeclaration must only ' +
                'have a single VariableDeclarator. Got ' +
                declarations.length +
                ' declarations.');
        }
        // VariableDeclarator always has at least one declaration, hence the non-null-assertion
        const id = declarations[0].get('id');
        if (id.isIdentifier()) {
            return id.node.name;
        }
        return;
    }
    if (path.isFunctionDeclaration()) {
        const id = path.get('id');
        if (id.isIdentifier()) {
            return id.node.name;
        }
        return;
    }
    // When we check ObjectMethod we simply ignore it as assigning
    // to it is technicaly possible but rare
    if (path.isObjectMethod()) {
        return;
    }
    if (path.isFunctionExpression() ||
        path.isArrowFunctionExpression() ||
        path.isTaggedTemplateExpression() ||
        path.isCallExpression() ||
        isReactForwardRefCall(path)) {
        let currentPath = path;
        while (currentPath.parentPath) {
            if (currentPath.parentPath.isVariableDeclarator()) {
                const id = currentPath.parentPath.get('id');
                if (id.isIdentifier()) {
                    return id.node.name;
                }
                return;
            }
            currentPath = currentPath.parentPath;
        }
        return;
    }
    throw new TypeError('Attempted to resolveName for an unsupported path. resolveName does not accept ' +
        path.node.type +
        '".');
}
const explodedVisitors = visitors.explode({
    AssignmentExpression: {
        enter: function (path, state) {
            const memberPath = path.get('left');
            if (!memberPath.isMemberExpression()) {
                return;
            }
            const property = memberPath.get('property');
            if (((!memberPath.node.computed && property.isIdentifier()) ||
                property.isStringLiteral() ||
                property.isNumericLiteral()) &&
                getNameOrValue(property) === state.memberName &&
                toString(memberPath.get('object')) === state.localName) {
                state.result = path.get('right');
                path.stop();
            }
        },
    },
});
export default function getMemberExpressionValuePath(variableDefinition, memberName) {
    const localName = resolveName(variableDefinition);
    if (!localName) {
        // likely an immediately exported and therefore nameless/anonymous node
        // passed in
        return null;
    }
    const state = {
        localName,
        memberName,
        result: null,
    };
    variableDefinition.hub.file.traverse(explodedVisitors, state);
    return state.result;
}
