export function assertNonEmptyArray(arr, message) {
    if (arr.length === 0) {
        throw new Error(message || "Expected a non-empty array");
    }
}
export function assertArrayHasExactly2(arr, message) {
    if (arr.length !== 2) {
        throw new Error(message || "Expected an array with exactly 2 items");
    }
}
export function assertArrayHasExactly1(arr, message) {
    if (arr.length !== 1) {
        throw new Error(message || "Expected an array with exactly 1 item");
    }
}
export function assertArrayHasAtLeast2(arr, message) {
    if (arr.length < 2) {
        throw new Error(message || "Expected an array with at least 2 items");
    }
}
export function isNonEmptyArray(arr) {
    return arr.length > 0;
}
export function isArrayWithAtLeast2(arr) {
    return arr.length >= 2;
}
export function isArrayWithAtLeast3(arr) {
    return arr.length >= 3;
}
export function isArrayWithExactly1(arr) {
    return arr.length === 1;
}
export function isArrayWithExactly2(arr) {
    return arr.length === 2;
}
export function isArrayWithExactly3(arr) {
    return arr.length === 3;
}
/**
 * type-safe version of `arr[arr.length - 1]`
 * @param arr a non empty array
 * @returns the last element of the array
 */
export const lastNonEmpty = (arr) => arr[arr.length - 1];
