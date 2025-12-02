import { Value, JSONValue, jsonToConvex } from "../../values/index.js";
import { PaginationResult, PaginationOptions } from "../pagination.js";
import { performAsyncSyscall, performSyscall } from "./syscall.js";
import {
  filterBuilderImpl,
  serializeExpression,
} from "./filter_builder_impl.js";
import { Query, QueryInitializer } from "../query.js";
import { ExpressionOrValue, FilterBuilder } from "../filter_builder.js";
import { GenericTableInfo } from "../data_model.js";
import {
  IndexRangeBuilderImpl,
  SerializedRangeExpression,
} from "./index_range_builder_impl.js";
import {
  SearchFilterBuilderImpl,
  SerializedSearchFilter,
} from "./search_filter_builder_impl.js";
import { validateArg, validateArgIsNonNegativeInteger } from "./validate.js";
import { version } from "../../index.js";

const MAX_QUERY_OPERATORS = 256;

type QueryOperator = { filter: JSONValue } | { limit: number };
type Source =
  | { type: "FullTableScan"; tableName: string; order: "asc" | "desc" | null }
  | {
      type: "IndexRange";
      indexName: string;
      range: ReadonlyArray<SerializedRangeExpression>;
      order: "asc" | "desc" | null;
    }
  | {
      type: "Search";
      indexName: string;
      filters: ReadonlyArray<SerializedSearchFilter>;
    };

type SerializedQuery = {
  source: Source;
  operators: Array<QueryOperator>;
};

export class QueryInitializerImpl
  implements QueryInitializer<GenericTableInfo>
{
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  withIndex(
    indexName: string,
    indexRange?: (q: IndexRangeBuilderImpl) => IndexRangeBuilderImpl,
  ): QueryImpl {
    validateArg(indexName, 1, "withIndex", "indexName");
    let rangeBuilder = IndexRangeBuilderImpl.new();
    if (indexRange !== undefined) {
      rangeBuilder = indexRange(rangeBuilder);
    }
    return new QueryImpl({
      source: {
        type: "IndexRange",
        indexName: this.tableName + "." + indexName,
        range: rangeBuilder.export(),
        order: null,
      },
      operators: [],
    });
  }

  withSearchIndex(
    indexName: string,
    searchFilter: (q: SearchFilterBuilderImpl) => SearchFilterBuilderImpl,
  ): QueryImpl {
    validateArg(indexName, 1, "withSearchIndex", "indexName");
    validateArg(searchFilter, 2, "withSearchIndex", "searchFilter");
    const searchFilterBuilder = SearchFilterBuilderImpl.new();
    return new QueryImpl({
      source: {
        type: "Search",
        indexName: this.tableName + "." + indexName,
        filters: searchFilter(searchFilterBuilder).export(),
      },
      operators: [],
    });
  }

  fullTableScan(): QueryImpl {
    return new QueryImpl({
      source: {
        type: "FullTableScan",
        tableName: this.tableName,
        order: null,
      },
      operators: [],
    });
  }

  order(order: "asc" | "desc"): QueryImpl {
    return this.fullTableScan().order(order);
  }

  // This is internal API and should not be exposed to developers yet.
  async count(): Promise<number> {
    const syscallJSON = await performAsyncSyscall("1.0/count", {
      table: this.tableName,
    });
    const syscallResult = jsonToConvex(syscallJSON) as number;
    return syscallResult;
  }

  filter(
    predicate: (
      q: FilterBuilder<GenericTableInfo>,
    ) => ExpressionOrValue<boolean>,
  ) {
    return this.fullTableScan().filter(predicate);
  }

  limit(n: number) {
    return this.fullTableScan().limit(n);
  }

  collect(): Promise<any[]> {
    return this.fullTableScan().collect();
  }

  take(n: number): Promise<Array<any>> {
    return this.fullTableScan().take(n);
  }

  paginate(paginationOpts: PaginationOptions): Promise<PaginationResult<any>> {
    return this.fullTableScan().paginate(paginationOpts);
  }

  first(): Promise<any> {
    return this.fullTableScan().first();
  }

  unique(): Promise<any> {
    return this.fullTableScan().unique();
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    return this.fullTableScan()[Symbol.asyncIterator]();
  }
}

/**
 * @param type Whether the query was consumed or closed.
 * @throws An error indicating the query has been closed.
 */
function throwClosedError(type: "closed" | "consumed"): never {
  throw new Error(
    type === "consumed"
      ? "This query is closed and can't emit any more values."
      : "This query has been chained with another operator and can't be reused.",
  );
}

export class QueryImpl implements Query<GenericTableInfo> {
  private state:
    | { type: "preparing"; query: SerializedQuery }
    | { type: "executing"; queryId: number }
    | { type: "closed" }
    | { type: "consumed" };
  private tableNameForErrorMessages: string;

  constructor(query: SerializedQuery) {
    this.state = { type: "preparing", query };
    if (query.source.type === "FullTableScan") {
      this.tableNameForErrorMessages = query.source.tableName;
    } else {
      this.tableNameForErrorMessages = query.source.indexName.split(".")[0];
    }
  }

  private takeQuery(): SerializedQuery {
    if (this.state.type !== "preparing") {
      throw new Error(
        "A query can only be chained once and can't be chained after iteration begins.",
      );
    }
    const query = this.state.query;
    this.state = { type: "closed" };
    return query;
  }

  private startQuery(): number {
    if (this.state.type === "executing") {
      throw new Error("Iteration can only begin on a query once.");
    }
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    const query = this.state.query;
    const { queryId } = performSyscall("1.0/queryStream", { query, version });
    this.state = { type: "executing", queryId };
    return queryId;
  }

  private closeQuery() {
    if (this.state.type === "executing") {
      const queryId = this.state.queryId;
      performSyscall("1.0/queryCleanup", { queryId });
    }
    this.state = { type: "consumed" };
  }

  order(order: "asc" | "desc"): QueryImpl {
    validateArg(order, 1, "order", "order");
    const query = this.takeQuery();
    if (query.source.type === "Search") {
      throw new Error(
        "Search queries must always be in relevance order. Can not set order manually.",
      );
    }
    if (query.source.order !== null) {
      throw new Error("Queries may only specify order at most once");
    }
    query.source.order = order;
    return new QueryImpl(query);
  }

  filter(
    predicate: (
      q: FilterBuilder<GenericTableInfo>,
    ) => ExpressionOrValue<boolean>,
  ): any {
    validateArg(predicate, 1, "filter", "predicate");
    const query = this.takeQuery();
    if (query.operators.length >= MAX_QUERY_OPERATORS) {
      throw new Error(
        `Can't construct query with more than ${MAX_QUERY_OPERATORS} operators`,
      );
    }
    query.operators.push({
      filter: serializeExpression(predicate(filterBuilderImpl)),
    });
    return new QueryImpl(query);
  }

  limit(n: number): any {
    validateArg(n, 1, "limit", "n");
    const query = this.takeQuery();
    query.operators.push({ limit: n });
    return new QueryImpl(query);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    this.startQuery();
    return this;
  }

  async next(): Promise<IteratorResult<any>> {
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    // Allow calling `.next()` when the query is in "preparing" state to implicitly start the
    // query. This allows the developer to call `.next()` on the query without having to use
    // a `for await` statement.
    const queryId =
      this.state.type === "preparing" ? this.startQuery() : this.state.queryId;
    const { value, done } = await performAsyncSyscall("1.0/queryStreamNext", {
      queryId,
    });
    if (done) {
      this.closeQuery();
    }
    const convexValue = jsonToConvex(value);
    return { value: convexValue, done };
  }

  return() {
    this.closeQuery();
    return Promise.resolve({ done: true, value: undefined });
  }

  async paginate(
    paginationOpts: PaginationOptions,
  ): Promise<PaginationResult<any>> {
    validateArg(paginationOpts, 1, "paginate", "options");
    if (
      typeof paginationOpts?.numItems !== "number" ||
      paginationOpts.numItems < 0
    ) {
      throw new Error(
        `\`options.numItems\` must be a positive number. Received \`${paginationOpts?.numItems}\`.`,
      );
    }
    const query = this.takeQuery();
    const pageSize = paginationOpts.numItems;
    const cursor = paginationOpts.cursor;
    const endCursor = paginationOpts?.endCursor ?? null;
    const maximumRowsRead = paginationOpts.maximumRowsRead ?? null;
    const { page, isDone, continueCursor, splitCursor, pageStatus } =
      await performAsyncSyscall("1.0/queryPage", {
        query,
        cursor,
        endCursor,
        pageSize,
        maximumRowsRead,
        maximumBytesRead: paginationOpts.maximumBytesRead,
        version,
      });
    return {
      page: page.map((json: string) => jsonToConvex(json)),
      isDone,
      continueCursor,
      splitCursor,
      pageStatus,
    };
  }

  async collect(): Promise<Array<any>> {
    const out: Value[] = [];
    for await (const item of this) {
      out.push(item);
    }
    return out;
  }

  async take(n: number): Promise<Array<any>> {
    validateArg(n, 1, "take", "n");
    validateArgIsNonNegativeInteger(n, 1, "take", "n");
    return this.limit(n).collect();
  }

  async first(): Promise<any | null> {
    const first_array = await this.take(1);
    return first_array.length === 0 ? null : first_array[0];
  }

  async unique(): Promise<any | null> {
    const first_two_array = await this.take(2);
    if (first_two_array.length === 0) {
      return null;
    }
    if (first_two_array.length === 2) {
      throw new Error(`unique() query returned more than one result from table ${this.tableNameForErrorMessages}:
 [${first_two_array[0]._id}, ${first_two_array[1]._id}, ...]`);
    }
    return first_two_array[0];
  }
}
