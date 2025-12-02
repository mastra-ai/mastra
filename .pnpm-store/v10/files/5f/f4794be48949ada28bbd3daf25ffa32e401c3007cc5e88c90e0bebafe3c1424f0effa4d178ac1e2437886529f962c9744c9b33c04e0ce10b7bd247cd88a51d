import resolveToValue from './resolveToValue.js';
function isObjectValuesCall(path) {
    if (!path.isCallExpression() || path.node.arguments.length !== 1) {
        return false;
    }
    const callee = path.get('callee');
    if (!callee.isMemberExpression()) {
        return false;
    }
    const object = callee.get('object');
    const property = callee.get('property');
    return (object.isIdentifier({ name: 'Object' }) &&
        property.isIdentifier({ name: 'values' }));
}
// Resolves an ObjectExpression or an ObjectTypeAnnotation
function resolveObjectToPropMap(object) {
    if (object.isObjectExpression()) {
        const values = new Map();
        let error = false;
        object.get('properties').forEach((propPath) => {
            if (error || propPath.isObjectMethod())
                return;
            if (propPath.isObjectProperty()) {
                const key = propPath.get('key');
                let name;
                // Key is either Identifier or Literal
                if (key.isIdentifier()) {
                    name = key.node.name;
                }
                else if (key.isNumericLiteral() || key.isStringLiteral()) {
                    name = `${key.node.value}`;
                }
                else {
                    error = true;
                    return;
                }
                const valuePath = resolveToValue(propPath.get('value'));
                const value = valuePath.isStringLiteral()
                    ? `"${valuePath.node.value}"`
                    : valuePath.isNumericLiteral()
                        ? `${valuePath.node.value}`
                        : // we return null here because there are a lot of cases and we don't know yet what we need to handle
                            'null';
                values.set(name, value);
            }
            else if (propPath.isSpreadElement()) {
                const spreadObject = resolveToValue(propPath.get('argument'));
                const spreadValues = resolveObjectToPropMap(spreadObject);
                if (!spreadValues) {
                    error = true;
                    return;
                }
                for (const entry of spreadValues.entries()) {
                    const [key, value] = entry;
                    values.set(key, value);
                }
            }
        });
        if (!error) {
            return values;
        }
    }
    return null;
}
/**
 * Returns an ArrayExpression which contains all the values resolved from an object
 *
 * Ignores setters in objects
 *
 * Returns null in case of
 *  unresolvable spreads
 *  computed identifier values
 */
export default function resolveObjectValuesToArray(path) {
    if (isObjectValuesCall(path)) {
        const argument = path.get('arguments')[0];
        const objectExpression = resolveToValue(
        // isObjectValuesCall already asserts that there is at least one argument, hence the non-null-assertion
        argument);
        const values = resolveObjectToPropMap(objectExpression);
        if (values) {
            return Array.from(values.values());
        }
    }
    return null;
}
