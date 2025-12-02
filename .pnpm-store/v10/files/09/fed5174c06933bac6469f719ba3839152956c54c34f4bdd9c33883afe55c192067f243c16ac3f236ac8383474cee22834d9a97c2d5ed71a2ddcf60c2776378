import { parseSchema } from "./parseSchema.js";
export const parseSimpleDiscriminatedOneOf = (schema, refs) => {
    return schema.oneOf.length
        ? schema.oneOf.length === 1
            ? parseSchema(schema.oneOf[0], {
                ...refs,
                path: [...refs.path, "oneOf", 0],
            })
            : `z.discriminatedUnion("${schema.discriminator.propertyName}", [${schema.oneOf
                .map((schema, i) => parseSchema(schema, {
                ...refs,
                path: [...refs.path, "oneOf", i],
            }))
                .join(", ")}])`
        : "z.any()";
};
