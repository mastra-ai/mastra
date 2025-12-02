import { z } from "zod";
/**
 * Type representing a JSON Schema object
 */
export type JSONSchema = {
    $schema?: string;
    type?: string;
    properties?: Record<string, JSONSchema>;
    required?: string[];
    additionalProperties?: boolean;
    items?: JSONSchema;
    enum?: Array<string | number | boolean | null>;
    const?: any;
    description?: string;
    anyOf?: JSONSchema[];
    allOf?: JSONSchema[];
    oneOf?: JSONSchema[];
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
};
/**
 * Converts a JSON Schema object to a Zod schema
 */
export declare function convertJsonSchemaToZod(schema: JSONSchema): z.ZodTypeAny;
/**
 * Converts a JSON Schema object to a Zod raw shape
 * @param schema The JSON Schema object to convert
 * @returns A Zod raw shape for use with z.object()
 */
export declare function jsonSchemaObjectToZodRawShape(schema: JSONSchema): z.ZodRawShape;
