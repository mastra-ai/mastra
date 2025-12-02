"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsonToConvex } from "../../values/index.js";
import { performAsyncSyscall, performSyscall } from "./syscall.js";
import {
  filterBuilderImpl,
  serializeExpression
} from "./filter_builder_impl.js";
import {
  IndexRangeBuilderImpl
} from "./index_range_builder_impl.js";
import {
  SearchFilterBuilderImpl
} from "./search_filter_builder_impl.js";
import { validateArg, validateArgIsNonNegativeInteger } from "./validate.js";
import { version } from "../../index.js";
const MAX_QUERY_OPERATORS = 256;
export class QueryInitializerImpl {
  constructor(tableName) {
    __publicField(this, "tableName");
    this.tableName = tableName;
  }
  withIndex(indexName, indexRange) {
    validateArg(indexName, 1, "withIndex", "indexName");
    let rangeBuilder = IndexRangeBuilderImpl.new();
    if (indexRange !== void 0) {
      rangeBuilder = indexRange(rangeBuilder);
    }
    return new QueryImpl({
      source: {
        type: "IndexRange",
        indexName: this.tableName + "." + indexName,
        range: rangeBuilder.export(),
        order: null
      },
      operators: []
    });
  }
  withSearchIndex(indexName, searchFilter) {
    validateArg(indexName, 1, "withSearchIndex", "indexName");
    validateArg(searchFilter, 2, "withSearchIndex", "searchFilter");
    const searchFilterBuilder = SearchFilterBuilderImpl.new();
    return new QueryImpl({
      source: {
        type: "Search",
        indexName: this.tableName + "." + indexName,
        filters: searchFilter(searchFilterBuilder).export()
      },
      operators: []
    });
  }
  fullTableScan() {
    return new QueryImpl({
      source: {
        type: "FullTableScan",
        tableName: this.tableName,
        order: null
      },
      operators: []
    });
  }
  order(order) {
    return this.fullTableScan().order(order);
  }
  // This is internal API and should not be exposed to developers yet.
  async count() {
    const syscallJSON = await performAsyncSyscall("1.0/count", {
      table: this.tableName
    });
    const syscallResult = jsonToConvex(syscallJSON);
    return syscallResult;
  }
  filter(predicate) {
    return this.fullTableScan().filter(predicate);
  }
  limit(n) {
    return this.fullTableScan().limit(n);
  }
  collect() {
    return this.fullTableScan().collect();
  }
  take(n) {
    return this.fullTableScan().take(n);
  }
  paginate(paginationOpts) {
    return this.fullTableScan().paginate(paginationOpts);
  }
  first() {
    return this.fullTableScan().first();
  }
  unique() {
    return this.fullTableScan().unique();
  }
  [Symbol.asyncIterator]() {
    return this.fullTableScan()[Symbol.asyncIterator]();
  }
}
function throwClosedError(type) {
  throw new Error(
    type === "consumed" ? "This query is closed and can't emit any more values." : "This query has been chained with another operator and can't be reused."
  );
}
export class QueryImpl {
  constructor(query) {
    __publicField(this, "state");
    __publicField(this, "tableNameForErrorMessages");
    this.state = { type: "preparing", query };
    if (query.source.type === "FullTableScan") {
      this.tableNameForErrorMessages = query.source.tableName;
    } else {
      this.tableNameForErrorMessages = query.source.indexName.split(".")[0];
    }
  }
  takeQuery() {
    if (this.state.type !== "preparing") {
      throw new Error(
        "A query can only be chained once and can't be chained after iteration begins."
      );
    }
    const query = this.state.query;
    this.state = { type: "closed" };
    return query;
  }
  startQuery() {
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
  closeQuery() {
    if (this.state.type === "executing") {
      const queryId = this.state.queryId;
      performSyscall("1.0/queryCleanup", { queryId });
    }
    this.state = { type: "consumed" };
  }
  order(order) {
    validateArg(order, 1, "order", "order");
    const query = this.takeQuery();
    if (query.source.type === "Search") {
      throw new Error(
        "Search queries must always be in relevance order. Can not set order manually."
      );
    }
    if (query.source.order !== null) {
      throw new Error("Queries may only specify order at most once");
    }
    query.source.order = order;
    return new QueryImpl(query);
  }
  filter(predicate) {
    validateArg(predicate, 1, "filter", "predicate");
    const query = this.takeQuery();
    if (query.operators.length >= MAX_QUERY_OPERATORS) {
      throw new Error(
        `Can't construct query with more than ${MAX_QUERY_OPERATORS} operators`
      );
    }
    query.operators.push({
      filter: serializeExpression(predicate(filterBuilderImpl))
    });
    return new QueryImpl(query);
  }
  limit(n) {
    validateArg(n, 1, "limit", "n");
    const query = this.takeQuery();
    query.operators.push({ limit: n });
    return new QueryImpl(query);
  }
  [Symbol.asyncIterator]() {
    this.startQuery();
    return this;
  }
  async next() {
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    const queryId = this.state.type === "preparing" ? this.startQuery() : this.state.queryId;
    const { value, done } = await performAsyncSyscall("1.0/queryStreamNext", {
      queryId
    });
    if (done) {
      this.closeQuery();
    }
    const convexValue = jsonToConvex(value);
    return { value: convexValue, done };
  }
  return() {
    this.closeQuery();
    return Promise.resolve({ done: true, value: void 0 });
  }
  async paginate(paginationOpts) {
    validateArg(paginationOpts, 1, "paginate", "options");
    if (typeof paginationOpts?.numItems !== "number" || paginationOpts.numItems < 0) {
      throw new Error(
        `\`options.numItems\` must be a positive number. Received \`${paginationOpts?.numItems}\`.`
      );
    }
    const query = this.takeQuery();
    const pageSize = paginationOpts.numItems;
    const cursor = paginationOpts.cursor;
    const endCursor = paginationOpts?.endCursor ?? null;
    const maximumRowsRead = paginationOpts.maximumRowsRead ?? null;
    const { page, isDone, continueCursor, splitCursor, pageStatus } = await performAsyncSyscall("1.0/queryPage", {
      query,
      cursor,
      endCursor,
      pageSize,
      maximumRowsRead,
      maximumBytesRead: paginationOpts.maximumBytesRead,
      version
    });
    return {
      page: page.map((json) => jsonToConvex(json)),
      isDone,
      continueCursor,
      splitCursor,
      pageStatus
    };
  }
  async collect() {
    const out = [];
    for await (const item of this) {
      out.push(item);
    }
    return out;
  }
  async take(n) {
    validateArg(n, 1, "take", "n");
    validateArgIsNonNegativeInteger(n, 1, "take", "n");
    return this.limit(n).collect();
  }
  async first() {
    const first_array = await this.take(1);
    return first_array.length === 0 ? null : first_array[0];
  }
  async unique() {
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
//# sourceMappingURL=query_impl.js.map
