import { ReadonlyJSONObject } from "./json-value";
declare const PARTIAL_JSON_OBJECT_META_SYMBOL: unique symbol;
type FieldState = "complete" | "partial";
type PartialJsonObjectMeta = {
    state: "complete" | "partial";
    partialPath: string[];
};
export declare const getPartialJsonObjectMeta: (obj: Record<symbol, unknown>) => PartialJsonObjectMeta | undefined;
export declare const parsePartialJsonObject: (json: string) => (ReadonlyJSONObject & {
    [PARTIAL_JSON_OBJECT_META_SYMBOL]: PartialJsonObjectMeta;
}) | undefined;
export declare const getPartialJsonObjectFieldState: (obj: Record<string, unknown>, fieldPath: (string | number)[]) => FieldState;
export {};
//# sourceMappingURL=parse-partial-json-object.d.ts.map