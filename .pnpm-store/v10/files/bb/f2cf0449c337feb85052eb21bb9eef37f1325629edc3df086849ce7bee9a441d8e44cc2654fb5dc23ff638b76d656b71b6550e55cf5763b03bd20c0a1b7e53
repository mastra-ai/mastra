import printValue from './printValue.js';
export default function getParameterName(parameterPath) {
    if (parameterPath.isIdentifier()) {
        return parameterPath.node.name;
    }
    else if (parameterPath.isAssignmentPattern()) {
        return getParameterName(parameterPath.get('left'));
    }
    else if (parameterPath.isObjectPattern() ||
        parameterPath.isArrayPattern()) {
        return printValue(parameterPath);
    }
    else if (parameterPath.isRestElement()) {
        return `...${getParameterName(parameterPath.get('argument'))}`;
    }
    else if (parameterPath.isTSParameterProperty()) {
        return getParameterName(parameterPath.get('parameter'));
    }
    else if (parameterPath.isVoidPattern()) {
        return 'void';
    }
    throw new TypeError('Parameter name must be one of Identifier, AssignmentPattern, ArrayPattern, ' +
        `ObjectPattern, RestElement, or VoidPattern instead got ${parameterPath.node.type}`);
}
