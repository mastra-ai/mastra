import { omit } from "../utils/omit.js";
import { parseSchema } from "./parseSchema.js";
/**
 * For compatibility with open api 3.0 nullable
 */
export const parseNullable = (schema, refs) => {
    return `${parseSchema(omit(schema, "nullable"), refs, true)}.nullable()`;
};
