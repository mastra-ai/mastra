import resolveToValue from './resolveToValue.js';
function isObjectKeysCall(path) {
    if (!path.isCallExpression() || path.get('arguments').length !== 1) {
        return false;
    }
    const callee = path.get('callee');
    if (!callee.isMemberExpression()) {
        return false;
    }
    const object = callee.get('object');
    const property = callee.get('property');
    return (object.isIdentifier({ name: 'Object' }) &&
        property.isIdentifier({ name: 'keys' }));
}
function isWhitelistedObjectProperty(path) {
    if (path.isSpreadElement())
        return true;
    if (path.isObjectProperty() ||
        (path.isObjectMethod() &&
            (path.node.kind === 'get' || path.node.kind === 'set'))) {
        const key = path.get('key');
        return ((key.isIdentifier() && !path.node.computed) ||
            key.isStringLiteral() ||
            key.isNumericLiteral());
    }
    return false;
}
function isWhiteListedObjectTypeProperty(path) {
    return (path.isObjectTypeProperty() ||
        path.isObjectTypeSpreadProperty() ||
        path.isTSPropertySignature());
}
// Resolves an ObjectExpression or an ObjectTypeAnnotation
export function resolveObjectToNameArray(objectPath, raw = false) {
    if ((objectPath.isObjectExpression() &&
        objectPath.get('properties').every(isWhitelistedObjectProperty)) ||
        (objectPath.isObjectTypeAnnotation() &&
            objectPath.get('properties').every(isWhiteListedObjectTypeProperty)) ||
        (objectPath.isTSTypeLiteral() &&
            objectPath.get('members').every(isWhiteListedObjectTypeProperty))) {
        let values = [];
        let error = false;
        const properties = objectPath.isTSTypeLiteral()
            ? objectPath.get('members')
            : objectPath.get('properties');
        properties.forEach((propPath) => {
            if (error)
                return;
            if (propPath.isObjectProperty() ||
                propPath.isObjectMethod() ||
                propPath.isObjectTypeProperty() ||
                propPath.isTSPropertySignature()) {
                const key = propPath.get('key');
                // Key is either Identifier or Literal
                const name = key.isIdentifier()
                    ? key.node.name
                    : raw
                        ? key.node.extra?.raw
                        : `${key.node.value}`;
                values.push(name);
            }
            else if (propPath.isSpreadElement() ||
                propPath.isObjectTypeSpreadProperty()) {
                let spreadObject = resolveToValue(propPath.get('argument'));
                if (spreadObject.isGenericTypeAnnotation()) {
                    const typeAliasRight = resolveToValue(spreadObject.get('id')).get('right');
                    if (typeAliasRight.isObjectTypeAnnotation()) {
                        spreadObject = resolveToValue(typeAliasRight);
                    }
                }
                const spreadValues = resolveObjectToNameArray(spreadObject);
                if (!spreadValues) {
                    error = true;
                    return;
                }
                values = [...values, ...spreadValues];
            }
        });
        if (!error) {
            return values;
        }
    }
    return null;
}
/**
 * Returns an ArrayExpression which contains all the keys resolved from an object
 *
 * Ignores setters in objects
 *
 * Returns null in case of
 *  unresolvable spreads
 *  computed identifier keys
 */
export default function resolveObjectKeysToArray(path) {
    if (isObjectKeysCall(path)) {
        const argument = path.get('arguments')[0];
        const objectExpression = resolveToValue(
        // isObjectKeysCall already asserts that there is at least one argument, hence the non-null-assertion
        argument);
        const values = resolveObjectToNameArray(objectExpression);
        if (values) {
            const nodes = values
                //filter duplicates
                .filter((value, index, array) => array.indexOf(value) === index)
                .map((value) => `"${value}"`);
            return nodes;
        }
    }
    return null;
}
