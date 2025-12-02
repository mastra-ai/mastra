import { Value, stringifyValueForError } from "./value.js";

const IDENTIFYING_FIELD = Symbol.for("ConvexError");

export class ConvexError<TData extends Value> extends Error {
  name = "ConvexError";
  data: TData;
  [IDENTIFYING_FIELD] = true;

  constructor(data: TData) {
    super(typeof data === "string" ? data : stringifyValueForError(data));
    this.data = data;
  }
}
