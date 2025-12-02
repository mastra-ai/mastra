import { z } from "zod";
declare const baseConvexValidator: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"null">;
}, "passthrough", z.ZodTypeAny, {
    type: "null";
}, {
    type: "null";
}>, z.ZodObject<{
    type: z.ZodLiteral<"number">;
}, "passthrough", z.ZodTypeAny, {
    type: "number";
}, {
    type: "number";
}>, z.ZodObject<{
    type: z.ZodLiteral<"bigint">;
}, "passthrough", z.ZodTypeAny, {
    type: "bigint";
}, {
    type: "bigint";
}>, z.ZodObject<{
    type: z.ZodLiteral<"boolean">;
}, "passthrough", z.ZodTypeAny, {
    type: "boolean";
}, {
    type: "boolean";
}>, z.ZodObject<{
    type: z.ZodLiteral<"string">;
}, "passthrough", z.ZodTypeAny, {
    type: "string";
}, {
    type: "string";
}>, z.ZodObject<{
    type: z.ZodLiteral<"bytes">;
}, "passthrough", z.ZodTypeAny, {
    type: "bytes";
}, {
    type: "bytes";
}>, z.ZodObject<{
    type: z.ZodLiteral<"any">;
}, "passthrough", z.ZodTypeAny, {
    type: "any";
}, {
    type: "any";
}>, z.ZodObject<{
    type: z.ZodLiteral<"literal">;
    value: z.ZodAny;
}, "passthrough", z.ZodTypeAny, {
    type: "literal";
    value?: any;
}, {
    type: "literal";
    value?: any;
}>, z.ZodObject<{
    type: z.ZodLiteral<"id">;
    tableName: z.ZodString;
}, "passthrough", z.ZodTypeAny, {
    type: "id";
    tableName: string;
}, {
    type: "id";
    tableName: string;
}>]>;
export type ConvexValidator = z.infer<typeof baseConvexValidator> | {
    type: "array";
    value: ConvexValidator;
} | {
    type: "record";
    keys: ConvexValidator;
    values: {
        fieldType: ConvexValidator;
        optional: false;
    };
} | {
    type: "union";
    value: ConvexValidator[];
} | {
    type: "object";
    value: Record<string, {
        fieldType: ConvexValidator;
        optional: boolean;
    }>;
};
export declare const convexValidator: z.ZodType<ConvexValidator>;
export {};
//# sourceMappingURL=validator.d.ts.map