import * as z from "zod/v4";
import { OpenEnum } from "../types/enums.js";
/**
 * Data collection setting. If no available model provider meets the requirement, your request will return an error.
 *
 * @remarks
 * - allow: (default) allow providers which store user data non-transiently and may train on it
 *
 * - deny: use only providers which do not collect user data.
 */
export declare const DataCollection: {
    readonly Deny: "deny";
    readonly Allow: "allow";
};
/**
 * Data collection setting. If no available model provider meets the requirement, your request will return an error.
 *
 * @remarks
 * - allow: (default) allow providers which store user data non-transiently and may train on it
 *
 * - deny: use only providers which do not collect user data.
 */
export type DataCollection = OpenEnum<typeof DataCollection>;
/** @internal */
export declare const DataCollection$outboundSchema: z.ZodType<string, DataCollection>;
//# sourceMappingURL=datacollection.d.ts.map