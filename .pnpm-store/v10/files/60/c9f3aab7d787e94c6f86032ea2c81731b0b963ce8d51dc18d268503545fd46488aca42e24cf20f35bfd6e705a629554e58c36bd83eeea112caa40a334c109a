const KeyTypes = {
  pk: "pk",
  sk: "sk",
};

const DataOptions = {
  raw: "raw",
  includeKeys: "includeKeys",
  attributes: "attributes",
};

const BatchWriteTypes = {
  batch: "batch",
  concurrent: "concurrent",
};

const ComparisonTypes = {
  keys: "keys",
  attributes: "attributes",
  v2: "v2",
};

const QueryTypes = {
  and: "and",
  gte: "gte",
  gt: "gt",
  lte: "lte",
  lt: "lt",
  eq: "eq",
  begins: "begins",
  between: "between",
  collection: "collection",
  clustered_collection: "clustered_collection",
  is: "is",
};

const MethodTypes = {
  check: "check",
  put: "put",
  get: "get",
  query: "query",
  scan: "scan",
  update: "update",
  delete: "delete",
  remove: "remove",
  patch: "patch",
  create: "create",
  batchGet: "batchGet",
  batchWrite: "batchWrite",
  upsert: "upsert",
  transactWrite: "transactWrite",
  transactGet: "transactGet",
};

const TransactionMethods = {
  transactWrite: MethodTypes.transactWrite,
  transactGet: MethodTypes.transactGet,
};

const TransactionOperations = {
  [MethodTypes.get]: "Get",
  [MethodTypes.check]: "ConditionCheck",
  [MethodTypes.put]: "Put",
  [MethodTypes.create]: "Put",
  [MethodTypes.upsert]: "Update",
  [MethodTypes.update]: "Update",
  [MethodTypes.patch]: "Update",
  [MethodTypes.remove]: "Delete",
  [MethodTypes.delete]: "Delete",
};

const MethodTypeTranslation = {
  put: "put",
  get: "get",
  query: "query",
  scan: "scan",
  update: "update",
  delete: "delete",
  remove: "delete",
  patch: "update",
  create: "put",
  batchGet: "batchGet",
  batchWrite: "batchWrite",
  upsert: "update",
  transactWrite: "transactWrite",
  transactGet: "transactGet",
};

const IndexTypes = {
  isolated: "isolated",
  clustered: "clustered",
};

const Comparisons = {
  lte: "<=",
  lt: "<",
  gte: ">=",
  gt: ">",
};

const KeyAttributesComparisons = {
  lt: "<",
  gte: ">=",

  /**
   * gt becomes gte and last character of incoming value is shifted up one character code
   * example:
   * sk > '2020-09-05'
   *   expected
   *     - 2020-09-06@05:05_hero
   *     - 2020-10-05@05:05_hero
   *     - 2022-02-05@05:05_villian
   *     - 2022-06-05@05:05_clown
   *     - 2022-09-06@05:05_clown
   *   actual (bad - includes all 2020-09-05 records)
   *     - 2020-09-05@05:05_hero
   *     - 2020-09-06@05:05_hero
   *     - 2020-10-05@05:05_hero
   *     - 2022-02-05@05:05_villian
   *     - 2022-06-05@05:05_clown
   */
  gt: ">=",

  /**
   * lte becomes lt and last character of incoming value is shifted up one character code
   * example:
   * sk >= '2020-09-05'
   *   expected
   *     - 2012-02-05@05:05_clown
   *     - 2015-10-05@05:05_hero
   *     - 2017-02-05@05:05_clown
   *     - 2017-02-05@05:05_villian
   *     - 2020-02-05@05:05_clown
   *     - 2020-02-25@05:05_clown
   *     - 2020-09-05@05:05_hero
   *   actual (bad - missing all 2020-09-05 records)
   *     - 2012-02-05@05:05_clown
   *     - 2015-10-05@05:05_hero
   *     - 2017-02-05@05:05_clown
   *     - 2017-02-05@05:05_villian
   *     - 2020-02-05@05:05_clown
   *     - 2020-02-25@05:05_clown
   */
  lte: "<",
};

const CastTypes = ["string", "number"];

const AttributeTypes = {
  string: "string",
  number: "number",
  boolean: "boolean",
  enum: "enum",
  map: "map",
  set: "set",
  // enumSet: "enumSet",
  list: "list",
  any: "any",
  custom: "custom",
  static: "static",
};

const PathTypes = {
  ...AttributeTypes,
  item: "item",
};

const ExpressionTypes = {
  ConditionExpression: "ConditionExpression",
  FilterExpression: "FilterExpression",
};

const ElectroInstance = {
  entity: Symbol("entity"),
  service: Symbol("service"),
  electro: Symbol("electro"),
};

const ElectroInstanceTypes = {
  electro: "electro",
  service: "service",
  entity: "entity",
  model: "model",
};

const ModelVersions = {
  beta: "beta",
  v1: "v1",
  v2: "v2",
};

const EntityVersions = {
  v1: "v1",
};

const ServiceVersions = {
  v1: "v1",
};

const MaxBatchItems = {
  [MethodTypes.batchGet]: 100,
  [MethodTypes.batchWrite]: 25,
};

const AttributeMutationMethods = {
  get: "get",
  set: "set",
};

const Pager = {
  raw: "raw",
  named: "named",
  item: "item",
  cursor: "cursor",
};

const UnprocessedTypes = {
  raw: "raw",
  item: "item",
};

const AttributeWildCard = "*";

const ItemOperations = {
  set: "set",
  delete: "delete",
  remove: "remove",
  add: "add",
  subtract: "subtract",
  append: "append",
  ifNotExists: "ifNotExists",
};

const UpsertOperations = {
  set: "set",
  add: "add",
  subtract: "subtract",
  append: "append",
  ifNotExists: "ifNotExists",
};

const AttributeProxySymbol = Symbol("attribute_proxy");
const TransactionCommitSymbol = Symbol("transaction_commit");

const BuilderTypes = {
  update: "update",
  filter: "filter",
};

const ValueTypes = {
  string: "string",
  boolean: "boolean",
  number: "number",
  array: "array",
  set: "set",
  aws_set: "aws_set",
  object: "object",
  map: "map",
  null: "null",
  undefined: "undefined",
  unknown: "unknown",
};

const TraverserIndexes = {
  readonly: "readonly",
  required: "required",
  getters: "getters",
  setters: "setters",
};

const ReturnValues = {
  default: "default",
  none: "none",
  all_old: "all_old",
  updated_old: "updated_old",
  all_new: "all_new",
  updated_new: "updated_new",
};

const FormatToReturnValues = {
  none: "NONE",
  default: "NONE",
  all_old: "ALL_OLD",
  updated_old: "UPDATED_OLD",
  all_new: "ALL_NEW",
  updated_new: "UPDATED_NEW",
};

const TableIndex = "";

const KeyCasing = {
  none: "none",
  upper: "upper",
  lower: "lower",
  default: "default",
};

const DefaultKeyCasing = KeyCasing.lower;

const EventSubscriptionTypes = ["query", "results"];

const TerminalOperation = {
  go: "go",
  page: "page",
};

const AllPages = "all";

const ResultOrderOption = {
  asc: true,
  desc: false,
};

const ResultOrderParam = "ScanIndexForward";

const DynamoDBAttributeTypes = Object.entries({
  string: "S",
  stringSet: "SS",
  number: "N",
  numberSet: "NS",
  binary: "B",
  binarySet: "BS",
  boolean: "BOOL",
  null: "NULL",
  list: "L",
  map: "M",
}).reduce((obj, [name, type]) => {
  obj[name] = type;
  obj[type] = type;
  return obj;
}, {});

const CastKeyOptions = {
  string: "string",
  number: "number",
};

module.exports = {
  Pager,
  KeyTypes,
  CastTypes,
  KeyCasing,
  PathTypes,
  IndexTypes,
  QueryTypes,
  ValueTypes,
  TableIndex,
  MethodTypes,
  DataOptions,
  Comparisons,
  BuilderTypes,
  ReturnValues,
  MaxBatchItems,
  ModelVersions,
  ItemOperations,
  AttributeTypes,
  EntityVersions,
  CastKeyOptions,
  ComparisonTypes,
  ServiceVersions,
  ExpressionTypes,
  ElectroInstance,
  TraverserIndexes,
  UnprocessedTypes,
  AttributeWildCard,
  TerminalOperation,
  FormatToReturnValues,
  AttributeProxySymbol,
  ElectroInstanceTypes,
  MethodTypeTranslation,
  EventSubscriptionTypes,
  DynamoDBAttributeTypes,
  KeyAttributesComparisons,
  AttributeMutationMethods,
  AllPages,
  ResultOrderOption,
  ResultOrderParam,
  TransactionCommitSymbol,
  TransactionOperations,
  TransactionMethods,
  UpsertOperations,
  BatchWriteTypes,
  DefaultKeyCasing,
};
