import * as z from "zod/v4";
import { SDKValidationError } from "../models/errors/sdkvalidationerror.js";
import { Result } from "../types/fp.js";
/**
 * Utility function that executes some code which may throw a ZodError. It
 * intercepts this error and converts it to an SDKValidationError so as to not
 * leak Zod implementation details to user code.
 */
export declare function parse<Inp, Out>(rawValue: Inp, fn: (value: Inp) => Out, errorMessage: string): Out;
/**
 * Utility function that executes some code which may result in a ZodError. It
 * intercepts this error and converts it to an SDKValidationError so as to not
 * leak Zod implementation details to user code.
 */
export declare function safeParse<Inp, Out>(rawValue: Inp, fn: (value: Inp) => Out, errorMessage: string): Result<Out, SDKValidationError>;
export declare function collectExtraKeys<Shape extends z.ZodRawShape, Catchall extends z.ZodType, K extends string, Optional extends boolean>(obj: z.ZodObject<Shape, z.core.$catchall<Catchall>>, extrasKey: K, optional: Optional): z.ZodPipe<z.ZodObject<Shape, z.core.$catchall<Catchall>>, z.ZodTransform<z.output<z.ZodObject<Shape, z.core.$strip>> & (Optional extends false ? {
    [k in K]: Record<string, z.output<Catchall>>;
} : {
    [k in K]?: Record<string, z.output<Catchall>> | undefined;
}), z.output<z.ZodObject<Shape, z.core.$catchall<Catchall>>>>>;
//# sourceMappingURL=schemas.d.ts.map