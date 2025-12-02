import { JSONValue, JSONParseError, TypeValidationError, APICallError } from '@ai-sdk/provider';
import { z, ZodSchema } from 'zod';

declare function combineHeaders(...headers: Array<Record<string, string | undefined> | undefined>): Record<string, string | undefined>;

/**
 * Converts an AsyncIterator to a ReadableStream.
 *
 * @template T - The type of elements produced by the AsyncIterator.
 * @param { <T>} iterator - The AsyncIterator to convert.
 * @returns {ReadableStream<T>} - A ReadableStream that provides the same data as the AsyncIterator.
 */
declare function convertAsyncIteratorToReadableStream<T>(iterator: AsyncIterator<T>): ReadableStream<T>;

/**
 * Creates a Promise that resolves after a specified delay
 * @param delayInMs - The delay duration in milliseconds. If null or undefined, resolves immediately.
 * @returns A Promise that resolves after the specified delay
 */
declare function delay(delayInMs?: number | null): Promise<void>;

/**
Extracts the headers from a response object and returns them as a key-value object.

@param response - The response object to extract headers from.
@returns The headers as a key-value object.
*/
declare function extractResponseHeaders(response: Response): Record<string, string>;

/**
 * Fetch function type (standardizes the version of fetch used).
 */
type FetchFunction = typeof globalThis.fetch;

/**
Creates an ID generator.
The total length of the ID is the sum of the prefix, separator, and random part length.
Non-secure.

@param alphabet - The alphabet to use for the ID. Default: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.
@param prefix - The prefix of the ID to generate. Default: ''.
@param separator - The separator between the prefix and the random part of the ID. Default: '-'.
@param size - The size of the random part of the ID to generate. Default: 16.
 */
declare const createIdGenerator: ({ prefix, size: defaultSize, alphabet, separator, }?: {
    prefix?: string;
    separator?: string;
    size?: number;
    alphabet?: string;
}) => ((size?: number) => string);
/**
A function that generates an ID.
 */
type IDGenerator = () => string;
/**
Generates a 16-character random string to use for IDs. Not secure.

@param size - The size of the ID to generate. Default: 16.
 */
declare const generateId: (size?: number) => string;

declare function getErrorMessage(error: unknown | undefined): string;

/**
 * Used to mark validator functions so we can support both Zod and custom schemas.
 */
declare const validatorSymbol: unique symbol;
type ValidationResult<OBJECT> = {
    success: true;
    value: OBJECT;
} | {
    success: false;
    error: Error;
};
type Validator<OBJECT = unknown> = {
    /**
     * Used to mark validator functions so we can support both Zod and custom schemas.
     */
    [validatorSymbol]: true;
    /**
     * Optional. Validates that the structure of a value matches this schema,
     * and returns a typed version of the value if it does.
     */
    readonly validate?: (value: unknown) => ValidationResult<OBJECT>;
};
/**
 * Create a validator.
 *
 * @param validate A validation function for the schema.
 */
declare function validator<OBJECT>(validate?: undefined | ((value: unknown) => ValidationResult<OBJECT>)): Validator<OBJECT>;
declare function isValidator(value: unknown): value is Validator;
declare function asValidator<OBJECT>(value: Validator<OBJECT> | z.Schema<OBJECT, z.ZodTypeDef, any>): Validator<OBJECT>;
declare function zodValidator<OBJECT>(zodSchema: z.Schema<OBJECT, z.ZodTypeDef, any>): Validator<OBJECT>;

/**
 * Parses a JSON string into an unknown object.
 *
 * @param text - The JSON string to parse.
 * @returns {JSONValue} - The parsed JSON object.
 */
declare function parseJSON(options: {
    text: string;
    schema?: undefined;
}): JSONValue;
/**
 * Parses a JSON string into a strongly-typed object using the provided schema.
 *
 * @template T - The type of the object to parse the JSON into.
 * @param {string} text - The JSON string to parse.
 * @param {Validator<T>} schema - The schema to use for parsing the JSON.
 * @returns {T} - The parsed object.
 */
declare function parseJSON<T>(options: {
    text: string;
    schema: ZodSchema<T> | Validator<T>;
}): T;
type ParseResult<T> = {
    success: true;
    value: T;
    rawValue: unknown;
} | {
    success: false;
    error: JSONParseError | TypeValidationError;
};
/**
 * Safely parses a JSON string and returns the result as an object of type `unknown`.
 *
 * @param text - The JSON string to parse.
 * @returns {object} Either an object with `success: true` and the parsed data, or an object with `success: false` and the error that occurred.
 */
declare function safeParseJSON(options: {
    text: string;
    schema?: undefined;
}): ParseResult<JSONValue>;
/**
 * Safely parses a JSON string into a strongly-typed object, using a provided schema to validate the object.
 *
 * @template T - The type of the object to parse the JSON into.
 * @param {string} text - The JSON string to parse.
 * @param {Validator<T>} schema - The schema to use for parsing the JSON.
 * @returns An object with either a `success` flag and the parsed and typed data, or a `success` flag and an error object.
 */
declare function safeParseJSON<T>(options: {
    text: string;
    schema: ZodSchema<T> | Validator<T>;
}): ParseResult<T>;
declare function isParsableJson(input: string): boolean;

type ResponseHandler<RETURN_TYPE> = (options: {
    url: string;
    requestBodyValues: unknown;
    response: Response;
}) => PromiseLike<{
    value: RETURN_TYPE;
    rawValue?: unknown;
    responseHeaders?: Record<string, string>;
}>;
declare const createJsonErrorResponseHandler: <T>({ errorSchema, errorToMessage, isRetryable, }: {
    errorSchema: ZodSchema<T>;
    errorToMessage: (error: T) => string;
    isRetryable?: (response: Response, error?: T) => boolean;
}) => ResponseHandler<APICallError>;
declare const createEventSourceResponseHandler: <T>(chunkSchema: ZodSchema<T>) => ResponseHandler<ReadableStream<ParseResult<T>>>;
declare const createJsonStreamResponseHandler: <T>(chunkSchema: ZodSchema<T>) => ResponseHandler<ReadableStream<ParseResult<T>>>;
declare const createJsonResponseHandler: <T>(responseSchema: ZodSchema<T>) => ResponseHandler<T>;
declare const createBinaryResponseHandler: () => ResponseHandler<Uint8Array>;
declare const createStatusCodeErrorResponseHandler: () => ResponseHandler<APICallError>;

declare const getFromApi: <T>({ url, headers, successfulResponseHandler, failedResponseHandler, abortSignal, fetch, }: {
    url: string;
    headers?: Record<string, string | undefined>;
    failedResponseHandler: ResponseHandler<Error>;
    successfulResponseHandler: ResponseHandler<T>;
    abortSignal?: AbortSignal;
    fetch?: FetchFunction;
}) => Promise<{
    value: T;
    rawValue?: unknown;
    responseHeaders?: Record<string, string>;
}>;

declare function isAbortError(error: unknown): error is Error;

declare function loadApiKey({ apiKey, environmentVariableName, apiKeyParameterName, description, }: {
    apiKey: string | undefined;
    environmentVariableName: string;
    apiKeyParameterName?: string;
    description: string;
}): string;

/**
 * Loads an optional `string` setting from the environment or a parameter.
 *
 * @param settingValue - The setting value.
 * @param environmentVariableName - The environment variable name.
 * @returns The setting value.
 */
declare function loadOptionalSetting({ settingValue, environmentVariableName, }: {
    settingValue: string | undefined;
    environmentVariableName: string;
}): string | undefined;

/**
 * Loads a `string` setting from the environment or a parameter.
 *
 * @param settingValue - The setting value.
 * @param environmentVariableName - The environment variable name.
 * @param settingName - The setting name.
 * @param description - The description of the setting.
 * @returns The setting value.
 */
declare function loadSetting({ settingValue, environmentVariableName, settingName, description, }: {
    settingValue: string | undefined;
    environmentVariableName: string;
    settingName: string;
    description: string;
}): string;

declare const postJsonToApi: <T>({ url, headers, body, failedResponseHandler, successfulResponseHandler, abortSignal, fetch, }: {
    url: string;
    headers?: Record<string, string | undefined>;
    body: unknown;
    failedResponseHandler: ResponseHandler<APICallError>;
    successfulResponseHandler: ResponseHandler<T>;
    abortSignal?: AbortSignal;
    fetch?: FetchFunction;
}) => Promise<{
    value: T;
    rawValue?: unknown;
    responseHeaders?: Record<string, string>;
}>;
declare const postToApi: <T>({ url, headers, body, successfulResponseHandler, failedResponseHandler, abortSignal, fetch, }: {
    url: string;
    headers?: Record<string, string | undefined>;
    body: {
        content: string | FormData | Uint8Array;
        values: unknown;
    };
    failedResponseHandler: ResponseHandler<Error>;
    successfulResponseHandler: ResponseHandler<T>;
    abortSignal?: AbortSignal;
    fetch?: FetchFunction;
}) => Promise<{
    value: T;
    rawValue?: unknown;
    responseHeaders?: Record<string, string>;
}>;

type Resolvable<T> = T | Promise<T> | (() => T) | (() => Promise<T>);
/**
 * Resolves a value that could be a raw value, a Promise, a function returning a value,
 * or a function returning a Promise.
 */
declare function resolve<T>(value: Resolvable<T>): Promise<T>;

/**
 * Removes entries from a record where the value is null or undefined.
 * @param record - The input object whose entries may be null or undefined.
 * @returns A new object containing only entries with non-null and non-undefined values.
 */
declare function removeUndefinedEntries<T>(record: Record<string, T | undefined>): Record<string, T>;

declare function convertBase64ToUint8Array(base64String: string): Uint8Array;
declare function convertUint8ArrayToBase64(array: Uint8Array): string;

/**
 * Validates the types of an unknown object using a schema and
 * return a strongly-typed object.
 *
 * @template T - The type of the object to validate.
 * @param {string} options.value - The object to validate.
 * @param {Validator<T>} options.schema - The schema to use for validating the JSON.
 * @returns {T} - The typed object.
 */
declare function validateTypes<T>({ value, schema: inputSchema, }: {
    value: unknown;
    schema: z.Schema<T, z.ZodTypeDef, any> | Validator<T>;
}): T;
/**
 * Safely validates the types of an unknown object using a schema and
 * return a strongly-typed object.
 *
 * @template T - The type of the object to validate.
 * @param {string} options.value - The JSON object to validate.
 * @param {Validator<T>} options.schema - The schema to use for validating the JSON.
 * @returns An object with either a `success` flag and the parsed and typed data, or a `success` flag and an error object.
 */
declare function safeValidateTypes<T>({ value, schema, }: {
    value: unknown;
    schema: z.Schema<T, z.ZodTypeDef, any> | Validator<T>;
}): {
    success: true;
    value: T;
} | {
    success: false;
    error: TypeValidationError;
};

declare function withoutTrailingSlash(url: string | undefined): string | undefined;

/**
Typed tool call that is returned by generateText and streamText.
It contains the tool call ID, the tool name, and the tool arguments.
 */
interface ToolCall<NAME extends string, ARGS> {
    /**
  ID of the tool call. This ID is used to match the tool call with the tool result.
   */
    toolCallId: string;
    /**
  Name of the tool that is being called.
   */
    toolName: NAME;
    /**
  Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
     */
    args: ARGS;
}
/**
 * @deprecated Use `ToolCall` instead.
 */
type CoreToolCall<NAME extends string, ARGS> = ToolCall<NAME, ARGS>;

/**
Typed tool result that is returned by `generateText` and `streamText`.
It contains the tool call ID, the tool name, the tool arguments, and the tool result.
 */
interface ToolResult<NAME extends string, ARGS, RESULT> {
    /**
  ID of the tool call. This ID is used to match the tool call with the tool result.
     */
    toolCallId: string;
    /**
  Name of the tool that was called.
     */
    toolName: NAME;
    /**
  Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
       */
    args: ARGS;
    /**
  Result of the tool call. This is the result of the tool's execution.
       */
    result: RESULT;
}
/**
 * @deprecated Use `ToolResult` instead.
 */
type CoreToolResult<NAME extends string, ARGS, RESULT> = ToolResult<NAME, ARGS, RESULT>;

export { type CoreToolCall, type CoreToolResult, type FetchFunction, type IDGenerator, type ParseResult, type Resolvable, type ResponseHandler, type ToolCall, type ToolResult, type ValidationResult, type Validator, asValidator, combineHeaders, convertAsyncIteratorToReadableStream, convertBase64ToUint8Array, convertUint8ArrayToBase64, createBinaryResponseHandler, createEventSourceResponseHandler, createIdGenerator, createJsonErrorResponseHandler, createJsonResponseHandler, createJsonStreamResponseHandler, createStatusCodeErrorResponseHandler, delay, extractResponseHeaders, generateId, getErrorMessage, getFromApi, isAbortError, isParsableJson, isValidator, loadApiKey, loadOptionalSetting, loadSetting, parseJSON, postJsonToApi, postToApi, removeUndefinedEntries, resolve, safeParseJSON, safeValidateTypes, validateTypes, validator, validatorSymbol, withoutTrailingSlash, zodValidator };
