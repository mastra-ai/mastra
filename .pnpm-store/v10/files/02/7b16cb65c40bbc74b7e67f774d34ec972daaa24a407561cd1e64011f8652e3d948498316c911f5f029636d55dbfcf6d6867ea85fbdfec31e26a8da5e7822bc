import getPropertyName from './getPropertyName.js';
import { getDocblock } from './docblock.js';
export default function setPropDescription(documentation, propertyPath) {
    const propName = getPropertyName(propertyPath);
    if (!propName)
        return;
    const propDescriptor = documentation.getPropDescriptor(propName);
    if (propDescriptor.description)
        return;
    propDescriptor.description = getDocblock(propertyPath) || '';
}
