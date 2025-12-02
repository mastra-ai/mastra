import getMembers from '../utils/getMembers.js';
/**
 * Returns true of the prop is required, according to its type definition
 */
export default function isRequiredPropType(path) {
    return getMembers(path).some(({ computed, path: memberPath }) => (!computed && memberPath.isIdentifier({ name: 'isRequired' })) ||
        memberPath.isStringLiteral({ value: 'isRequired' }));
}
