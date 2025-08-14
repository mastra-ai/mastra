import type { JSONSchema7 } from "json-schema";
import type { z, ZodSchema } from "zod";

export type inferOutput<Output extends ZodSchema | JSONSchema7 | undefined = undefined> = Output extends ZodSchema
    ? z.infer<Output>
    : Output extends JSONSchema7
    ? unknown
    : undefined;

// Tripwire result extensions
export type TripwireProperties = {
    tripwire?: boolean;
    tripwireReason?: string;
};