import { ReadonlyJSONValue } from "../../utils";

export type ObjectStreamOperation =
  | {
      readonly type: "set";
      readonly path: readonly string[];
      readonly value: ReadonlyJSONValue;
    }
  | {
      readonly type: "append-text";
      readonly path: readonly string[];
      readonly value: string;
    };

export type ObjectStreamChunk = {
  readonly snapshot: ReadonlyJSONValue;
  readonly operations: readonly ObjectStreamOperation[];
};
