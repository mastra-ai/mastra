import getNameOrValue from './getNameOrValue.js';
export default function getClassMemberValuePath(classDefinition, memberName) {
    const classMember = classDefinition
        .get('body')
        .get('body')
        .find((memberPath) => {
        if ((memberPath.isClassMethod() && memberPath.node.kind !== 'set') ||
            memberPath.isClassProperty()) {
            const key = memberPath.get('key');
            return ((!memberPath.node.computed || key.isLiteral()) &&
                getNameOrValue(key) === memberName);
        }
        return false;
    });
    if (classMember) {
        // For ClassProperty we return the value and for ClassMethod
        // we return itself
        return classMember.isClassMethod()
            ? classMember
            : classMember.get('value');
    }
    return null;
}
