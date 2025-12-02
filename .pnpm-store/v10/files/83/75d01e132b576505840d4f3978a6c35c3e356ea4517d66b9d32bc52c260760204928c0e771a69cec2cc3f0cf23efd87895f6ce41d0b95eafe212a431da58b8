"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var schema_exports = {};
__export(schema_exports, {
  SchemaDefinition: () => SchemaDefinition,
  TableDefinition: () => TableDefinition,
  defineSchema: () => defineSchema,
  defineTable: () => defineTable
});
module.exports = __toCommonJS(schema_exports);
var import_validator = require("../values/validator.js");
class TableDefinition {
  /**
   * @internal
   */
  constructor(documentType) {
    __publicField(this, "indexes");
    __publicField(this, "stagedDbIndexes");
    __publicField(this, "searchIndexes");
    __publicField(this, "stagedSearchIndexes");
    __publicField(this, "vectorIndexes");
    __publicField(this, "stagedVectorIndexes");
    // The type of documents stored in this table.
    __publicField(this, "validator");
    this.indexes = [];
    this.stagedDbIndexes = [];
    this.searchIndexes = [];
    this.stagedSearchIndexes = [];
    this.vectorIndexes = [];
    this.stagedVectorIndexes = [];
    this.validator = documentType;
  }
  /**
   * This API is experimental: it may change or disappear.
   *
   * Returns indexes defined on this table.
   * Intended for the advanced use cases of dynamically deciding which index to use for a query.
   * If you think you need this, please chime in on ths issue in the Convex JS GitHub repo.
   * https://github.com/get-convex/convex-js/issues/49
   */
  " indexes"() {
    return this.indexes;
  }
  index(name, indexConfig) {
    if (Array.isArray(indexConfig)) {
      this.indexes.push({
        indexDescriptor: name,
        fields: indexConfig
      });
    } else if (indexConfig.staged) {
      this.stagedDbIndexes.push({
        indexDescriptor: name,
        fields: indexConfig.fields
      });
    } else {
      this.indexes.push({
        indexDescriptor: name,
        fields: indexConfig.fields
      });
    }
    return this;
  }
  searchIndex(name, indexConfig) {
    if (indexConfig.staged) {
      this.stagedSearchIndexes.push({
        indexDescriptor: name,
        searchField: indexConfig.searchField,
        filterFields: indexConfig.filterFields || []
      });
    } else {
      this.searchIndexes.push({
        indexDescriptor: name,
        searchField: indexConfig.searchField,
        filterFields: indexConfig.filterFields || []
      });
    }
    return this;
  }
  vectorIndex(name, indexConfig) {
    if (indexConfig.staged) {
      this.stagedVectorIndexes.push({
        indexDescriptor: name,
        vectorField: indexConfig.vectorField,
        dimensions: indexConfig.dimensions,
        filterFields: indexConfig.filterFields || []
      });
    } else {
      this.vectorIndexes.push({
        indexDescriptor: name,
        vectorField: indexConfig.vectorField,
        dimensions: indexConfig.dimensions,
        filterFields: indexConfig.filterFields || []
      });
    }
    return this;
  }
  /**
   * Work around for https://github.com/microsoft/TypeScript/issues/57035
   */
  self() {
    return this;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    const documentType = this.validator.json;
    if (typeof documentType !== "object") {
      throw new Error(
        "Invalid validator: please make sure that the parameter of `defineTable` is valid (see https://docs.convex.dev/database/schemas)"
      );
    }
    return {
      indexes: this.indexes,
      stagedDbIndexes: this.stagedDbIndexes,
      searchIndexes: this.searchIndexes,
      stagedSearchIndexes: this.stagedSearchIndexes,
      vectorIndexes: this.vectorIndexes,
      stagedVectorIndexes: this.stagedVectorIndexes,
      documentType
    };
  }
}
function defineTable(documentSchema) {
  if ((0, import_validator.isValidator)(documentSchema)) {
    return new TableDefinition(documentSchema);
  } else {
    return new TableDefinition(import_validator.v.object(documentSchema));
  }
}
class SchemaDefinition {
  /**
   * @internal
   */
  constructor(tables, options) {
    __publicField(this, "tables");
    __publicField(this, "strictTableNameTypes");
    __publicField(this, "schemaValidation");
    this.tables = tables;
    this.schemaValidation = options?.schemaValidation === void 0 ? true : options.schemaValidation;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    return JSON.stringify({
      tables: Object.entries(this.tables).map(([tableName, definition]) => {
        const {
          indexes,
          stagedDbIndexes,
          searchIndexes,
          stagedSearchIndexes,
          vectorIndexes,
          stagedVectorIndexes,
          documentType
        } = definition.export();
        return {
          tableName,
          indexes,
          stagedDbIndexes,
          searchIndexes,
          stagedSearchIndexes,
          vectorIndexes,
          stagedVectorIndexes,
          documentType
        };
      }),
      schemaValidation: this.schemaValidation
    });
  }
}
function defineSchema(schema, options) {
  return new SchemaDefinition(schema, options);
}
const _systemSchema = defineSchema({
  _scheduled_functions: defineTable({
    name: import_validator.v.string(),
    args: import_validator.v.array(import_validator.v.any()),
    scheduledTime: import_validator.v.float64(),
    completedTime: import_validator.v.optional(import_validator.v.float64()),
    state: import_validator.v.union(
      import_validator.v.object({ kind: import_validator.v.literal("pending") }),
      import_validator.v.object({ kind: import_validator.v.literal("inProgress") }),
      import_validator.v.object({ kind: import_validator.v.literal("success") }),
      import_validator.v.object({ kind: import_validator.v.literal("failed"), error: import_validator.v.string() }),
      import_validator.v.object({ kind: import_validator.v.literal("canceled") })
    )
  }),
  _storage: defineTable({
    sha256: import_validator.v.string(),
    size: import_validator.v.float64(),
    contentType: import_validator.v.optional(import_validator.v.string())
  })
});
//# sourceMappingURL=schema.js.map
