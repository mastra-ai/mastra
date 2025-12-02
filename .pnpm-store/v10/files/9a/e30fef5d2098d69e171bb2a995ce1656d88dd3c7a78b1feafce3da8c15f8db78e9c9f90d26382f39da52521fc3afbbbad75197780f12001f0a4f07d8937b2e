import sjson from "secure-json-parse";
import { fixJson } from "./fix-json";
import { ReadonlyJSONObject } from "./json-value";

const PARTIAL_JSON_OBJECT_META_SYMBOL = Symbol(
  "aui.parse-partial-json-object.meta",
);

type FieldState = "complete" | "partial";

type PartialJsonObjectMeta = {
  state: "complete" | "partial";
  partialPath: string[];
};

export const getPartialJsonObjectMeta = (
  obj: Record<symbol, unknown>,
): PartialJsonObjectMeta | undefined => {
  return obj?.[PARTIAL_JSON_OBJECT_META_SYMBOL] as PartialJsonObjectMeta;
};

export const parsePartialJsonObject = (
  json: string,
):
  | (ReadonlyJSONObject & {
      [PARTIAL_JSON_OBJECT_META_SYMBOL]: PartialJsonObjectMeta;
    })
  | undefined => {
  if (json.length === 0)
    return {
      [PARTIAL_JSON_OBJECT_META_SYMBOL]: { state: "partial", partialPath: [] },
    };

  try {
    const res = sjson.parse(json);
    if (typeof res !== "object" || res === null)
      throw new Error("argsText is expected to be an object");

    res[PARTIAL_JSON_OBJECT_META_SYMBOL] = {
      state: "complete",
      partialPath: [],
    };
    return res;
  } catch {
    try {
      const [fixedJson, partialPath] = fixJson(json);
      const res = sjson.parse(fixedJson);
      if (typeof res !== "object" || res === null)
        throw new Error("argsText is expected to be an object");

      res[PARTIAL_JSON_OBJECT_META_SYMBOL] = {
        state: "partial",
        partialPath,
      };
      return res;
    } catch {
      return undefined;
    }
  }
};

const getFieldState = (
  parent: unknown,
  parentMeta: PartialJsonObjectMeta,
  fieldPath: string[],
): FieldState => {
  if (typeof parent !== "object" || parent === null) return parentMeta.state;

  // 1) parent is complete: return "complete"
  if (parentMeta.state === "complete") return "complete";

  // 2) we finished traversing: return parent state
  if (fieldPath.length === 0) return parentMeta.state;

  const [field, ...restPath] = fieldPath as [string, ...string[]];

  // 3) field doesn't yet exist in parent: return "partial"
  if (!Object.prototype.hasOwnProperty.call(parent, field)) return "partial";

  const [partialField, ...restPartialPath] = parentMeta.partialPath;

  // 4) field exists but is not partial: return "complete"
  if (field !== partialField) return "complete";

  // 5) field exists and is partial: return child state
  const child = (parent as Record<string, unknown>)[field];
  const childMeta: PartialJsonObjectMeta = {
    state: "partial",
    partialPath: restPartialPath,
  };

  return getFieldState(child, childMeta, restPath);
};

export const getPartialJsonObjectFieldState = (
  obj: Record<string, unknown>,
  fieldPath: (string | number)[],
): FieldState => {
  const meta = getPartialJsonObjectMeta(obj);
  if (!meta) throw new Error("unable to determine object state");

  return getFieldState(obj, meta, fieldPath.map(String));
};
