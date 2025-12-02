export declare function assertNonEmptyArray<T>(arr: T[], message?: string): asserts arr is [T, ...T[]];
export declare function assertArrayHasExactly2<T>(arr: T[], message?: string): asserts arr is [T, T];
export declare function assertArrayHasExactly1<T>(arr: T[], message?: string): asserts arr is [T];
export declare function assertArrayHasAtLeast2<T>(arr: T[], message?: string): asserts arr is [T, T, ...T[]];
export declare function isNonEmptyArray<T>(arr: T[]): arr is [T, ...T[]];
export declare function isArrayWithAtLeast2<T>(arr: T[]): arr is [T, T, ...T[]];
export declare function isArrayWithAtLeast3<T>(arr: T[]): arr is [T, T, T, ...T[]];
export declare function isArrayWithExactly1<T>(arr: T[]): arr is [T];
export declare function isArrayWithExactly2<T>(arr: T[]): arr is [T, T];
export declare function isArrayWithExactly3<T>(arr: T[]): arr is [T, T, T];
/**
 * type-safe version of `arr[arr.length - 1]`
 * @param arr a non empty array
 * @returns the last element of the array
 */
export declare const lastNonEmpty: <T>(arr: [T, ...T[]]) => T;
