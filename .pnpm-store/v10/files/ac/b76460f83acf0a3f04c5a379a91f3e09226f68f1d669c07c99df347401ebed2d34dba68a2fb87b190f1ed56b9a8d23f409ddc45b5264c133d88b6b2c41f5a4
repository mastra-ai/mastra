import { Context } from "../../bundler/context.js";
export type TypecheckResult = "cantTypeCheck" | "success" | "typecheckFailed";
export type TypeCheckMode = "enable" | "try" | "disable";
type TypecheckResultHandler = (result: TypecheckResult, logSpecificError?: () => void, runOnError?: () => Promise<"success">) => Promise<void>;
/**
 * Conditionally run a typecheck function and interpret the result.
 *
 * If typeCheckMode === "disable", never run the typecheck function.
 * If typeCheckMode === "enable", run the typecheck and crash if typechecking
 * fails or we can't find tsc.
 * If typeCheckMode === "try", try and run the typecheck. crash if typechecking
 * fails but don't worry if tsc is missing and we can't run it.
 */
export declare function typeCheckFunctionsInMode(ctx: Context, typeCheckMode: TypeCheckMode, functionsDir: string): Promise<void>;
export declare function typeCheckFunctions(ctx: Context, functionsDir: string, handleResult: TypecheckResultHandler): Promise<void>;
export {};
//# sourceMappingURL=typecheck.d.ts.map