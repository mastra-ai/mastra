import { JSONValue, Value } from "../../values/index.js";
import { convexOrUndefinedToJson } from "../../values/value.js";
import { GenericDocument, GenericIndexFields } from "../data_model.js";
import {
  IndexRange,
  IndexRangeBuilder,
  LowerBoundIndexRangeBuilder,
  UpperBoundIndexRangeBuilder,
} from "../index_range_builder.js";

export type SerializedRangeExpression = {
  type: "Eq" | "Gt" | "Gte" | "Lt" | "Lte";
  fieldPath: string;
  value: JSONValue;
};

export class IndexRangeBuilderImpl
  extends IndexRange
  implements
    IndexRangeBuilder<GenericDocument, GenericIndexFields>,
    LowerBoundIndexRangeBuilder<GenericDocument, string>,
    UpperBoundIndexRangeBuilder<GenericDocument, string>
{
  private rangeExpressions: ReadonlyArray<SerializedRangeExpression>;
  private isConsumed: boolean;
  private constructor(
    rangeExpressions: ReadonlyArray<SerializedRangeExpression>,
  ) {
    super();
    this.rangeExpressions = rangeExpressions;
    this.isConsumed = false;
  }

  static new(): IndexRangeBuilderImpl {
    return new IndexRangeBuilderImpl([]);
  }

  private consume() {
    if (this.isConsumed) {
      throw new Error(
        "IndexRangeBuilder has already been used! Chain your method calls like `q => q.eq(...).eq(...)`. See https://docs.convex.dev/using/indexes",
      );
    }
    this.isConsumed = true;
  }

  eq(fieldName: string, value: Value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value),
      }),
    );
  }

  gt(fieldName: string, value: Value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gt",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value),
      }),
    );
  }
  gte(fieldName: string, value: Value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gte",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value),
      }),
    );
  }
  lt(fieldName: string, value: Value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lt",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value),
      }),
    );
  }
  lte(fieldName: string, value: Value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lte",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value),
      }),
    );
  }

  export() {
    this.consume();
    return this.rangeExpressions;
  }
}
