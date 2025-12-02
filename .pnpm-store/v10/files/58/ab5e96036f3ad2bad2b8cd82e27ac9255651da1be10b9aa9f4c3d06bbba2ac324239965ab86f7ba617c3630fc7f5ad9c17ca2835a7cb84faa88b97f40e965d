import { convertToNative } from "./convertToNative";
export const unmarshall = (data, options) => {
    if (options?.convertWithoutMapWrapper) {
        return convertToNative(data, options);
    }
    return convertToNative({ M: data }, options);
};
