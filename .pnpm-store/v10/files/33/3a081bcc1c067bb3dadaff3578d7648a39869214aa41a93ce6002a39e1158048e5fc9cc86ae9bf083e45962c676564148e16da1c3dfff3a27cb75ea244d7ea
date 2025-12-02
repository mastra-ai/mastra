import { z } from "zod/v4";
import type { JSONSchema } from "zod/v4/core";
import { RefinementHandler } from "../../core/types";
/**
 * Special handler for when __proto__ is in required properties.
 * This is needed because z.object().passthrough() strips __proto__ for security.
 */
export declare class ProtoRequiredHandler implements RefinementHandler {
    apply(zodSchema: z.ZodTypeAny, schema: JSONSchema.BaseSchema): z.ZodTypeAny;
    private validateRequired;
}
