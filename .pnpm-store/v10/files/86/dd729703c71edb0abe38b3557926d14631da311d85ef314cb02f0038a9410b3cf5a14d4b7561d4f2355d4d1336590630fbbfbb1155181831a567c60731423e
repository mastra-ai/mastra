import * as z from "zod/v4";
import { SDKOptions } from "./config.js";
export interface Env {
    OPENROUTER_API_KEY?: string | undefined;
    /**
     * Sets the httpReferer parameter for all supported operations
     */
    OPENROUTER_HTTP_REFERER?: string | undefined;
    /**
     * Sets the xTitle parameter for all supported operations
     */
    OPENROUTER_X_TITLE?: string | undefined;
    OPENROUTER_DEBUG?: boolean | undefined;
}
export declare const envSchema: z.ZodType<Env, unknown>;
/**
 * Reads and validates environment variables.
 */
export declare function env(): Env;
/**
 * Clears the cached env object. Useful for testing with a fresh environment.
 */
export declare function resetEnv(): void;
/**
 * Populates global parameters with environment variables.
 */
export declare function fillGlobals(options: SDKOptions): SDKOptions;
//# sourceMappingURL=env.d.ts.map