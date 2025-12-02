import { GenericId } from "../values/index.js";
import { test } from "vitest";
import { assert, assertFalse, Equals } from "../test/type_testing.js";
import { GenericDatabaseWriter } from "./database.js";
import { SystemTableNames } from "./schema.js";

type CreateDataModel<Document> = {
  tableName: {
    document: Document;
    fieldPaths: "body" | "_id";
    indexes: {};
    searchIndexes: {};
    vectorIndexes: {};
  };
};

test("DatabaseWriter has the right types for a simple data model", () => {
  type Document = {
    body: string;
    _id: GenericId<"tableName">;
    _creationTime: number;
  };
  type DB = GenericDatabaseWriter<CreateDataModel<Document>>;

  type InsertType = Parameters<DB["insert"]>;
  type ExpectedInsertType = [table: "tableName", value: { body: string }];
  assert<Equals<InsertType, ExpectedInsertType>>();

  type PatchType = Parameters<DB["patch"]>;
  type ExpectedPatchType = [
    id: GenericId<"tableName">,
    value: {
      body?: string;
      _id?: GenericId<"tableName">;
      _creationTime?: number;
    },
  ];
  assert<Equals<PatchType, ExpectedPatchType>>();

  type ReplaceType = Parameters<DB["replace"]>;
  type ExpectedReplaceType = [
    id: GenericId<"tableName">,
    value: {
      body: string;
      _id?: GenericId<"tableName">;
      _creationTime?: number;
    },
  ];
  assert<Equals<ReplaceType, ExpectedReplaceType>>();
});

test("DatabaseWriter has the right types for a union", () => {
  // This data model discriminates on `type`. It only has a `body` field if
  // the type is "text".
  type Document =
    | {
        type: "text";
        body: string;
        _id: GenericId<"tableName">;
        _creationTime: number;
      }
    | {
        type: "giphy";
        _id: GenericId<"tableName">;
        _creationTime: number;
      };

  type DB = GenericDatabaseWriter<CreateDataModel<Document>>;

  type InsertType = Parameters<DB["insert"]>;
  type Expected = [
    "tableName",
    { type: "text"; body: string } | { type: "giphy" },
  ];
  assert<Equals<InsertType, Expected>>();

  type PatchType = Parameters<DB["patch"]>;
  type ExpectedPatchType = [
    id: GenericId<"tableName">,
    value:
      | {
          type?: "text";
          body?: string;
          _id?: GenericId<"tableName">;
          _creationTime?: number;
        }
      | {
          type?: "giphy";
          _id?: GenericId<"tableName">;
          _creationTime?: number;
        },
  ];
  assert<Equals<PatchType, ExpectedPatchType>>();

  type ReplaceType = Parameters<DB["replace"]>;
  type ExpectedReplaceType = [
    id: GenericId<"tableName">,
    value:
      | {
          type: "text";
          body: string;
          _id?: GenericId<"tableName">;
          _creationTime?: number;
        }
      | { type: "giphy"; _id?: GenericId<"tableName">; _creationTime?: number },
  ];
  assert<Equals<ReplaceType, ExpectedReplaceType>>();
});

test("DatabaseWriter has the right types with loose data model", () => {
  // Use a document with an index signature to simulate `strict: false`
  type Document = {
    body: string;
    _id: GenericId<"tableName">;
    _creationTime: number;
    [propertyName: string]: any;
  };

  type DB = GenericDatabaseWriter<CreateDataModel<Document>>;

  type InsertType = Parameters<DB["insert"]>;
  type ExpectedInsertType = [
    table: "tableName",
    value: { body: string; [propertyName: string]: any },
  ];
  assert<Equals<InsertType, ExpectedInsertType>>();

  type PatchType = Parameters<DB["patch"]>;
  type ExpectedPatchType = [
    id: GenericId<"tableName">,
    value: {
      body?: string;
      _id?: GenericId<"tableName">;
      _creationTime?: number;
      [propertyName: string]: any;
    },
  ];
  assert<Equals<PatchType, ExpectedPatchType>>();

  type ReplaceType = Parameters<DB["replace"]>;
  type ExpectedReplaceType = [
    id: GenericId<"tableName">,
    value: {
      body: string;
      _id?: GenericId<"tableName">;
      _creationTime?: number;
      [propertyName: string]: any;
    },
  ];
  assert<Equals<ReplaceType, ExpectedReplaceType>>();
});

test("DatabaseWriter can only access system tables through system", () => {
  // Even with this system Document is in the data model, it is inaccessible from SystemDB

  type Document = {
    body: string;
    _id: GenericId<"tableName">;
    _creationTime: number;
  };
  type DB = GenericDatabaseWriter<CreateDataModel<Document>>;
  type SystemDB = DB["system"];
  type QueryType = Parameters<SystemDB["query"]>;
  type ExpectedQueryType = [table: SystemTableNames];
  // check that we can only pass in SystemTableNames
  assert<Equals<QueryType, ExpectedQueryType>>();
});

test("System Tables are readonly", () => {
  type Document = {
    body: string;
    _id: GenericId<"tableName">;
    _creationTime: number;
  };
  type DB = GenericDatabaseWriter<CreateDataModel<Document>>;
  type SystemDB = DB["system"];
  type PropertyExists<T, K> = K extends keyof T ? true : false;
  assert<PropertyExists<SystemDB, "get">>;
  assert<PropertyExists<SystemDB, "query">>;
  assertFalse<PropertyExists<SystemDB, "insert">>;
  assertFalse<PropertyExists<SystemDB, "patch">>;
  assertFalse<PropertyExists<SystemDB, "replace">>;
  assertFalse<PropertyExists<SystemDB, "delete">>;
});
