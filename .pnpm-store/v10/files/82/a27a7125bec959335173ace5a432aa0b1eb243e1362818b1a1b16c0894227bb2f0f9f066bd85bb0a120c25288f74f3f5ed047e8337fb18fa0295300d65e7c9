import getPropertyName from './getPropertyName.js';
/**
 * Given an ObjectExpression, this function returns the path of the value of
 * the property with name `propertyName`. if the property is an ObjectMethod we
 * return the ObjectMethod itself.
 */
export default function getPropertyValuePath(path, propertyName) {
    const property = path
        .get('properties')
        .find((propertyPath) => !propertyPath.isSpreadElement() &&
        getPropertyName(propertyPath) === propertyName);
    if (property) {
        return property.isObjectMethod()
            ? property
            : property.get('value');
    }
    return null;
}
