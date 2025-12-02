import { convertToAttr } from "./convertToAttr";
export function marshall(data, options) {
    const attributeValue = convertToAttr(data, options);
    const [key, value] = Object.entries(attributeValue)[0];
    switch (key) {
        case "M":
        case "L":
            return options?.convertTopLevelContainer ? attributeValue : value;
        case "SS":
        case "NS":
        case "BS":
        case "S":
        case "N":
        case "B":
        case "NULL":
        case "BOOL":
        case "$unknown":
        default:
            return attributeValue;
    }
}
