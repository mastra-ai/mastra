export type Serializable = {
    [key: string]: Serializable;
} | Serializable[] | string | number | boolean | null;
export type JsonSchema = JsonSchemaObject | boolean;
export type JsonSchemaObject = {
    type?: string | string[];
    properties?: {
        [key: string]: JsonSchema;
    };
    additionalProperties?: JsonSchema;
    unevaluatedProperties?: JsonSchema;
    patternProperties?: {
        [key: string]: JsonSchema;
    };
    minProperties?: number;
    maxProperties?: number;
    required?: string[] | boolean;
    propertyNames?: JsonSchema;
    items?: JsonSchema | JsonSchema[];
    additionalItems?: JsonSchema;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number | boolean;
    exclusiveMaximum?: number | boolean;
    multipleOf?: number;
    anyOf?: JsonSchema[];
    allOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    if?: JsonSchema;
    then?: JsonSchema;
    else?: JsonSchema;
    const?: Serializable;
    enum?: Serializable[];
    errorMessage?: {
        [key: string]: string | undefined;
    };
} & {
    [key: string]: any;
};
export type ParserSelector = (schema: JsonSchemaObject, refs: Refs) => string;
export type ParserOverride = (schema: JsonSchemaObject, refs: Refs) => string | void;
export type Options = {
    name?: string;
    module?: "cjs" | "esm" | "none";
    withoutDefaults?: boolean;
    withoutDescribes?: boolean;
    withJsdocs?: boolean;
    parserOverride?: ParserOverride;
    depth?: number;
    type?: boolean | string;
    noImport?: boolean;
};
export type Refs = Options & {
    path: (string | number)[];
    seen: Map<object | boolean, {
        n: number;
        r: string | undefined;
    }>;
};
export type SimpleDiscriminatedOneOfSchema<D extends string = string> = JsonSchemaObject & {
    oneOf: (JsonSchemaObject & {
        type: "object";
        properties: {
            [K in D]: JsonSchemaObject & {
                type: "string";
            };
        } & {
            [key: string]: JsonSchemaObject;
        };
    })[];
    discriminator: {
        propertyName: D;
    };
};
