import type { JSONSchema7, Schema } from 'ai-v5';
import type z3 from 'zod/v3';
import type z4 from 'zod/v4';
export type PartialSchemaOutput<OUTPUT extends OutputSchema = undefined> = OUTPUT extends undefined ? undefined : Partial<InferSchemaOutput<OUTPUT>>;
export type InferSchemaOutput<OUTPUT extends OutputSchema> = OUTPUT extends undefined ? undefined : OUTPUT extends z4.ZodType<infer OBJECT, any> ? OBJECT : OUTPUT extends z3.Schema<infer OBJECT, z3.ZodTypeDef, any> ? OBJECT : OUTPUT extends Schema<infer OBJECT> ? OBJECT : OUTPUT extends JSONSchema7 ? any : unknown;
export type OutputSchema<OBJECT = any> = z4.ZodType<OBJECT, any> | z3.Schema<OBJECT, z3.ZodTypeDef, any> | Schema<OBJECT> | JSONSchema7 | undefined;
export type ZodLikePartialSchema<T = any> = (z4.core.$ZodType<Partial<T>, any> | z3.ZodType<Partial<T>, z3.ZodTypeDef, any>) & {
    safeParse(value: unknown): {
        success: boolean;
        data?: Partial<T>;
        error?: any;
    };
};
export declare function asJsonSchema(schema: OutputSchema): JSONSchema7 | undefined;
export declare function getTransformedSchema<OUTPUT extends OutputSchema = undefined>(schema?: OUTPUT): {
    jsonSchema: JSONSchema7;
    outputFormat: string;
} | {
    jsonSchema: JSONSchema7;
    outputFormat: import("json-schema").JSONSchema7TypeName | import("json-schema").JSONSchema7TypeName[] | undefined;
} | undefined;
export declare function getResponseFormat(schema?: OutputSchema): {
    type: 'text';
} | {
    type: 'json';
    /**
     * JSON schema that the generated output should conform to.
     */
    schema?: JSONSchema7;
};
//# sourceMappingURL=schema.d.ts.map