import * as openapi_types from 'openapi-types';
import { OpenAPIV3_1 } from 'openapi-types';
import { Env, Input, Context, Next, MiddlewareHandler, ValidationTargets, Hono } from 'hono';
import { TypedResponse, RouterRoute, ValidationTargets as ValidationTargets$1, BlankEnv, Input as Input$1, BlankInput, Schema, BlankSchema, MiddlewareHandler as MiddlewareHandler$1 } from 'hono/types';
import { loadVendor as loadVendor$2, ToOpenAPISchemaContext } from '@standard-community/standard-openapi';
import { Hook } from '@hono/standard-validator';
import { loadVendor as loadVendor$1 } from '@standard-community/standard-json';
import { StatusCode } from 'hono/utils/http-status';
import { JSONSchema7 } from 'json-schema';

/** The Standard Schema interface. */
interface StandardSchemaV1<Input = unknown, Output = Input> {
    /** The Standard Schema properties. */
    readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
declare namespace StandardSchemaV1 {
    /** The Standard Schema properties interface. */
    export interface Props<Input = unknown, Output = Input> {
        /** The version number of the standard. */
        readonly version: 1;
        /** The vendor name of the schema library. */
        readonly vendor: string;
        /** Validates unknown input values. */
        readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
        /** Inferred types associated with the schema. */
        readonly types?: Types<Input, Output> | undefined;
    }
    /** The result interface of the validate function. */
    export type Result<Output> = SuccessResult<Output> | FailureResult;
    /** The result interface if validation succeeds. */
    export interface SuccessResult<Output> {
        /** The typed output value. */
        readonly value: Output;
        /** The non-existent issues. */
        readonly issues?: undefined;
    }
    /** The result interface if validation fails. */
    export interface FailureResult {
        /** The issues of failed validation. */
        readonly issues: ReadonlyArray<Issue>;
    }
    /** The issue interface of the failure output. */
    export interface Issue {
        /** The error message of the issue. */
        readonly message: string;
        /** The path of the issue, if any. */
        readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    }
    /** The path segment interface of the issue. */
    export interface PathSegment {
        /** The key representing a path segment. */
        readonly key: PropertyKey;
    }
    /** The Standard Schema types interface. */
    export interface Types<Input = unknown, Output = Input> {
        /** The input type of the schema. */
        readonly input: Input;
        /** The output type of the schema. */
        readonly output: Output;
    }
    /** Infers the input type of a Standard Schema. */
    export type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["input"];
    /** Infers the output type of a Standard Schema. */
    export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema["~standard"]["types"]>["output"];
    export {  };
}

declare function loadVendor(vendor: string, fn: {
    toJSONSchema?: Parameters<typeof loadVendor$1>[1];
    toOpenAPISchema?: Parameters<typeof loadVendor$2>[1];
}): void;
/**
 * Generate a resolver for a validation schema
 * @param schema Validation schema
 * @returns Resolver result
 */
declare function resolver<Schema extends StandardSchemaV1>(schema: Schema, userDefinedOptions?: Record<string, unknown>): {
    vendor: string;
    validate: (value: unknown) => StandardSchemaV1.Result<unknown> | Promise<StandardSchemaV1.Result<unknown>>;
    toJSONSchema: (customOptions?: Record<string, unknown>) => JSONSchema7 | Promise<JSONSchema7>;
    toOpenAPISchema: (customOptions?: Record<string, unknown>) => Promise<{
        schema: OpenAPIV3_1.SchemaObject;
        components: OpenAPIV3_1.ComponentsObject | undefined;
    }>;
};
type HasUndefined<T> = undefined extends T ? true : false;
/**
 * Create a validator middleware
 * @param target Target for validation
 * @param schema Validation schema
 * @param hook Hook for validation
 * @returns Middleware handler
 */
declare function validator<Schema extends StandardSchemaV1, Target extends keyof ValidationTargets, E extends Env, P extends string, In = StandardSchemaV1.InferInput<Schema>, Out = StandardSchemaV1.InferOutput<Schema>, I extends Input = {
    in: HasUndefined<In> extends true ? {
        [K in Target]?: In extends ValidationTargets[K] ? In : {
            [K2 in keyof In]?: ValidationTargets[K][K2];
        };
    } : {
        [K in Target]: In extends ValidationTargets[K] ? In : {
            [K2 in keyof In]: ValidationTargets[K][K2];
        };
    };
    out: {
        [K in Target]: Out;
    };
}, V extends I = I>(target: Target, schema: Schema, hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target>, options?: ResolverReturnType["options"]): MiddlewareHandler<E, P, V>;
/**
 * Describe a route with OpenAPI specs.
 * @param spec Options for describing a route
 * @returns Middleware handler
 */
declare function describeRoute(spec: DescribeRouteOptions): MiddlewareHandler;
type ResponseObject<T extends Partial<Record<StatusCode, StandardSchemaV1>>> = {
    [K in keyof T]: OpenAPIV3_1.ReferenceObject | (OpenAPIV3_1.ResponseObject & {
        content?: {
            [media: string]: OpenAPIV3_1.MediaTypeObject & {
                vSchema?: T[K];
            };
        };
    });
};
type Num<T> = T extends `${infer N extends number}` ? N : T;
type HandlerResponse<T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<Record<StatusCode, StandardSchemaV1>>> = PromiseOr<{
    [K in keyof T]: T[K] extends StandardSchemaV1 ? TypedResponse<StandardSchemaV1.InferOutput<T[K]>, Num<K> extends StatusCode ? Num<K> : never> : never;
}[keyof T]>;
type Handler<E extends Env, P extends string, I extends Input, T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<Record<StatusCode, StandardSchemaV1>>> = (c: Context<E, P, I>, next: Next) => HandlerResponse<T>;
declare function describeResponse<E extends Env, P extends string, I extends Input, T extends Partial<Record<StatusCode, StandardSchemaV1>> = Partial<Record<StatusCode, StandardSchemaV1>>>(handler: Handler<E, P, I, T>, responses: ResponseObject<T>, options?: Record<string, unknown>): Handler<E, P, I, T>;

/**
 * The unique symbol for the middlewares, which makes it easier to identify them. Not meant to be used directly, unless you're creating a custom middleware.
 */
declare const uniqueSymbol: unique symbol;
declare const ALLOWED_METHODS: readonly ["GET", "PUT", "POST", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"];
type AllowedMethods = (typeof ALLOWED_METHODS)[number];
declare function clearSpecsContext(): void;
declare function registerSchemaPath({ route, specs, paths, }: RegisterSchemaPathOptions): void;
declare function removeExcludedPaths(paths: OpenAPIV3_1.PathsObject, ctx: SpecContext): OpenAPIV3_1.PathsObject<{}, {}>;

type PromiseOr<T> = T | Promise<T>;
type ResolverReturnType = ReturnType<typeof resolver> & {
    options?: {
        /**
         * Override the media type of the request body, if not specified, it will be `application/json` for `json` target and `multipart/form-data` for `form` target.
         */
        media?: string;
    } & Partial<ToOpenAPISchemaContext>;
};
type HandlerUniqueProperty = (ResolverReturnType & {
    target: keyof ValidationTargets$1;
}) | {
    spec: DescribeRouteOptions;
};
type GenerateSpecOptions = {
    /**
     * Customize OpenAPI config, refers to Swagger 2.0 config
     *
     * @see https://swagger.io/specification/v2/
     */
    documentation: Omit<Partial<OpenAPIV3_1.Document>, "x-express-openapi-additional-middleware" | "x-express-openapi-validation-strict">;
    /**
     * Include paths which don't have the handlers.
     * This is useful when you want to document the
     * API without implementing it or index all the paths.
     */
    includeEmptyPaths: boolean;
    /**
     * Determine if Swagger should exclude static files (by checking if the last path segment contains a period).
     *
     * @default true
     */
    excludeStaticFile: boolean;
    /**
     * Paths to exclude from OpenAPI endpoint
     *
     * @default []
     */
    exclude: string | RegExp | Array<string | RegExp>;
    /**
     * Exclude methods from the specs
     */
    excludeMethods: AllowedMethods[];
    /**
     * Exclude tags from OpenAPI
     */
    excludeTags: string[];
    /**
     * Default options for `describeRoute` method
     */
    defaultOptions: Partial<Record<AllowedMethods | "ALL", DescribeRouteOptions>>;
};
type OperationId = string | ((route: RouterRoute) => string);
type DescribeRouteOptions = Omit<OpenAPIV3_1.OperationObject, "responses" | "operationId"> & {
    operationId?: OperationId;
    /**
     * Pass `true` to hide route from OpenAPI/swagger document
     */
    hide?: boolean | ((props: {
        c?: Context;
        method: string;
        path: string;
    }) => boolean);
    /**
     * Responses of the request
     */
    responses?: {
        [key: string]: (OpenAPIV3_1.ResponseObject & {
            content?: {
                [key: string]: Omit<OpenAPIV3_1.MediaTypeObject, "schema"> & {
                    schema?: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | ResolverReturnType;
                };
            };
        }) | OpenAPIV3_1.ReferenceObject;
    };
};
type RegisterSchemaPathOptions = {
    route: RouterRoute;
    specs?: DescribeRouteOptions & {
        operationId?: OperationId;
    };
    paths: Partial<OpenAPIV3_1.PathsObject>;
};
type HaveDefaultValues = "documentation" | "excludeStaticFile" | "exclude" | "excludeMethods" | "excludeTags";
type SanitizedGenerateSpecOptions = Pick<GenerateSpecOptions, HaveDefaultValues> & Omit<Partial<GenerateSpecOptions>, HaveDefaultValues>;
type SpecContext = {
    components: OpenAPIV3_1.ComponentsObject;
    options: SanitizedGenerateSpecOptions;
};

/**
 * Route handler for OpenAPI specs
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @returns Middleware handler for OpenAPI specs
 */
declare function openAPIRouteHandler<E extends Env = BlankEnv, P extends string = string, I extends Input$1 = BlankInput, S extends Schema = BlankSchema>(hono: Hono<E, S, P>, options?: Partial<GenerateSpecOptions>): MiddlewareHandler$1<E, P, I>;
/**
 * Generate OpenAPI specs for the given Hono instance
 * @param hono Instance of Hono
 * @param options Options for generating OpenAPI specs
 * @param config Configuration for OpenAPI route handler
 * @param Context Route context for hiding routes
 * @returns OpenAPI specs
 */
declare function generateSpecs<E extends Env = BlankEnv, P extends string = string, I extends Input$1 = BlankInput, S extends Schema = BlankSchema>(hono: Hono<E, S, P>, options?: Partial<GenerateSpecOptions>, c?: Context<E, P, I>): Promise<{
    tags: openapi_types.OpenAPIV3.TagObject[];
    info: {
        description: string;
        title: string;
        termsOfService?: string;
        contact?: openapi_types.OpenAPIV3.ContactObject;
        version: string;
        summary?: string;
        license?: OpenAPIV3_1.LicenseObject;
    };
    paths: {
        [x: string]: Omit<openapi_types.OpenAPIV3.PathItemObject<{}>, "parameters" | "servers"> & {
            servers?: OpenAPIV3_1.ServerObject[];
            parameters?: (OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject)[];
        } & {
            get?: OpenAPIV3_1.OperationObject<{}>;
            put?: OpenAPIV3_1.OperationObject<{}>;
            post?: OpenAPIV3_1.OperationObject<{}>;
            delete?: OpenAPIV3_1.OperationObject<{}>;
            options?: OpenAPIV3_1.OperationObject<{}>;
            head?: OpenAPIV3_1.OperationObject<{}>;
            patch?: OpenAPIV3_1.OperationObject<{}>;
            trace?: OpenAPIV3_1.OperationObject<{}>;
        };
    };
    components: OpenAPIV3_1.ComponentsObject;
    openapi: string;
    externalDocs?: openapi_types.OpenAPIV3.ExternalDocumentationObject;
    security?: openapi_types.OpenAPIV3.SecurityRequirementObject[];
    servers?: OpenAPIV3_1.ServerObject[];
    webhooks?: Record<string, OpenAPIV3_1.PathItemObject | OpenAPIV3_1.ReferenceObject>;
    jsonSchemaDialect?: string;
}>;

export { ALLOWED_METHODS, type AllowedMethods, type DescribeRouteOptions, type GenerateSpecOptions, type HandlerUniqueProperty, type PromiseOr, type RegisterSchemaPathOptions, type ResolverReturnType, type SpecContext, clearSpecsContext, describeResponse, describeRoute, generateSpecs, loadVendor, openAPIRouteHandler, registerSchemaPath, removeExcludedPaths, resolver, uniqueSymbol, validator };
