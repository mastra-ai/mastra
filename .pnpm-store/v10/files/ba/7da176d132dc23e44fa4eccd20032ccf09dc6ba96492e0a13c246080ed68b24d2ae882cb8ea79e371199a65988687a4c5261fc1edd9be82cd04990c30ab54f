import { parseSchema } from "./parseSchema.js";
export const parseMultipleType = (schema, refs) => {
    return `z.union([${schema.type
        .map((type) => parseSchema({ ...schema, type }, { ...refs, withoutDefaults: true }))
        .join(", ")}])`;
};
