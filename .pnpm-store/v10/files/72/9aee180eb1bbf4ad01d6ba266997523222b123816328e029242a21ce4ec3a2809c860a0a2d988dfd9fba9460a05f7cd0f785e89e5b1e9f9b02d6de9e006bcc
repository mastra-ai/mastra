import { parseSchema } from "./parseSchema.js";
export const parseNot = (schema, refs) => {
    return `z.any().refine((value) => !${parseSchema(schema.not, {
        ...refs,
        path: [...refs.path, "not"],
    })}.safeParse(value).success, "Invalid input: Should NOT be valid against schema")`;
};
