import { JSONValue } from "../../values/index.js";
import { performAsyncSyscall } from "./syscall.js";
import { version } from "../../index.js";
import {
  FilterExpression,
  VectorFilterBuilder,
  VectorSearch,
  VectorSearchQuery,
} from "../vector_search.js";
import {
  FieldTypeFromFieldPath,
  GenericDataModel,
  GenericDocument,
  GenericTableInfo,
  GenericVectorIndexConfig,
} from "../data_model.js";
import { validateArg } from "./validate.js";
import { Value, convexOrUndefinedToJson } from "../../values/value.js";

export function setupActionVectorSearch(
  requestId: string,
): VectorSearch<GenericDataModel, string, string> {
  return async (
    tableName: string,
    indexName: string,
    query: VectorSearchQuery<GenericTableInfo, string>,
  ) => {
    validateArg(tableName, 1, "vectorSearch", "tableName");
    validateArg(indexName, 2, "vectorSearch", "indexName");
    validateArg(query, 3, "vectorSearch", "query");
    if (
      !query.vector ||
      !Array.isArray(query.vector) ||
      query.vector.length === 0
    ) {
      throw Error("`vector` must be a non-empty Array in vectorSearch");
    }

    return await new VectorQueryImpl(
      requestId,
      tableName + "." + indexName,
      query,
    ).collect();
  };
}

export class VectorQueryImpl {
  private requestId: string;
  private state:
    | { type: "preparing"; query: SerializedVectorQuery }
    | { type: "consumed" };

  constructor(
    requestId: string,
    indexName: string,
    query: VectorSearchQuery<GenericTableInfo, string>,
  ) {
    this.requestId = requestId;
    const filters = query.filter
      ? serializeExpression(query.filter(filterBuilderImpl))
      : null;

    this.state = {
      type: "preparing",
      query: {
        indexName,
        limit: query.limit,
        vector: query.vector,
        expressions: filters,
      },
    };
  }

  async collect(): Promise<Array<any>> {
    if (this.state.type === "consumed") {
      throw new Error("This query is closed and can't emit any more values.");
    }
    const query = this.state.query;
    this.state = { type: "consumed" };

    const { results } = await performAsyncSyscall("1.0/actions/vectorSearch", {
      requestId: this.requestId,
      version,
      query,
    });
    return results;
  }
}

type SerializedVectorQuery = {
  indexName: string;
  limit?: number | undefined;
  vector: Array<number>;
  expressions: JSONValue;
};

type ExpressionOrValue<T extends Value | undefined> = FilterExpression<T> | T;

// The `any` type parameter in `Expression<any>` allows us to use this class
// in place of any `Expression` type in `filterBuilderImpl`.
export class ExpressionImpl extends FilterExpression<any> {
  private inner: JSONValue;
  constructor(inner: JSONValue) {
    super();
    this.inner = inner;
  }

  serialize(): JSONValue {
    return this.inner;
  }
}

export function serializeExpression(
  expr: ExpressionOrValue<Value | undefined>,
): JSONValue {
  if (expr instanceof ExpressionImpl) {
    return expr.serialize();
  } else {
    // Assume that the expression is a literal Convex value, which we'll serialize
    // to its JSON representation.
    return { $literal: convexOrUndefinedToJson(expr as Value | undefined) };
  }
}

export const filterBuilderImpl: VectorFilterBuilder<
  GenericDocument,
  GenericVectorIndexConfig
> = {
  //  Comparisons  /////////////////////////////////////////////////////////////

  eq<FieldName extends GenericVectorIndexConfig["filterFields"]>(
    fieldName: FieldName,
    value: FieldTypeFromFieldPath<GenericDocument, FieldName>,
  ): FilterExpression<boolean> {
    if (typeof fieldName !== "string") {
      throw new Error("The first argument to `q.eq` must be a field name.");
    }
    return new ExpressionImpl({
      $eq: [
        serializeExpression(new ExpressionImpl({ $field: fieldName })),
        serializeExpression(value),
      ],
    });
  },

  //  Logic  ///////////////////////////////////////////////////////////////////

  or(...exprs: Array<ExpressionOrValue<boolean>>): FilterExpression<boolean> {
    return new ExpressionImpl({ $or: exprs.map(serializeExpression) });
  },
};
