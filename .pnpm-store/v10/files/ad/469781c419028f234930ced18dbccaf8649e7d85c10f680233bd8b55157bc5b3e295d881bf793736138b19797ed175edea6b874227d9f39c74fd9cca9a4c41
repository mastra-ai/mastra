/**
 * Create a custom error class with the ability to define the error
 * code, status, and the help text.
 *
 * ```js
 * export class FileNotFoundException extends Exception {
 *   static status = 500
 *   static code = 'E_FILE_NOT_FOUND'
 * }
 *
 * throw new FileNotFoundException(
 *  `Unable to find file from ${filePath} location`
 * )
 * ```
 */
export declare class Exception extends Error {
    /**
     * Define the error metadata as static properties to avoid
     * setting them repeatedly on the error instance
     */
    static help?: string;
    static code?: string;
    static status?: number;
    static message?: string;
    /**
     * Name of the class that raised the exception.
     */
    name: string;
    /**
     * Optional help description for the error. You can use it to define additional
     * human readable information for the error.
     */
    help?: string;
    /**
     * A machine readable error code. This will allow the error handling logic
     * to narrow down exceptions based upon the error code.
     */
    code?: string;
    /**
     * A status code for the error. Usually helpful when converting errors
     * to HTTP responses.
     */
    status: number;
    constructor(message?: string, options?: ErrorOptions & {
        code?: string;
        status?: number;
    });
    get [Symbol.toStringTag](): string;
    toString(): string;
}
export declare class InvalidArgumentsException extends Exception {
    static code: string;
    static status: number;
}
export declare class RuntimeException extends Exception {
    static code: string;
    static status: number;
}
/**
 * Helper to create an anonymous error class.
 *
 * ```ts
 *
 * const E_RESOURCE_NOT_FOUND = createError<[number]>(
 *   'Unable to find resource with id %d',
 *   'E_RESOURCE_NOT_FOUND'
 * )
 * const id = 1
 * throw new E_RESOURCE_NOT_FOUND([id])
 *```
 */
export declare function createError<T extends any[] = never>(message: string, code: string, status?: number): typeof Exception & T extends never ? {
    new (args?: any, options?: ErrorOptions): Exception;
} : {
    new (args: T, options?: ErrorOptions): Exception;
};
