/* eslint-disable @typescript-eslint/no-unused-vars */
import { GenericId } from "../values/index.js";
import { test } from "vitest";
import { assert, Equals } from "../test/type_testing.js";
import { GenericDatabaseReader } from "./database.js";
import { SystemDataModel, SystemTableNames } from "./schema.js";
import { Id } from "../values/value.js";
import { TableNamesInDataModel } from "./data_model.js";

type Message = {
  body: string;
  _id: GenericId<"tableName">;
};
type DataModel = {
  messages: {
    document: Message;
    fieldPaths: "body" | "_id";
    indexes: {};
    searchIndexes: {};
    vectorIndexes: {};
  };
};
type DB = GenericDatabaseReader<DataModel>;
test("collect returns the correct types", () => {
  function collect(db: DB) {
    return db.query("messages").collect();
  }
  type Result = ReturnType<typeof collect>;
  type Expected = Promise<Message[]>;
  assert<Equals<Result, Expected>>();
});

test("take returns the correct types", () => {
  function take(db: DB) {
    return db.query("messages").take(5);
  }
  type Result = ReturnType<typeof take>;
  type Expected = Promise<Message[]>;
  assert<Equals<Result, Expected>>();
});

test("first returns the correct types", () => {
  function first(db: DB) {
    return db.query("messages").first();
  }
  type Result = ReturnType<typeof first>;
  type Expected = Promise<Message | null>;
  assert<Equals<Result, Expected>>();
});

test("unique returns the correct types", () => {
  function unique(db: DB) {
    return db.query("messages").unique();
  }
  type Result = ReturnType<typeof unique>;
  type Expected = Promise<Message | null>;
  assert<Equals<Result, Expected>>();
});

test("fullTableScan returns the correct types", () => {
  function fullTableScan(db: DB) {
    return db.query("messages").fullTableScan().collect();
  }
  type Result = ReturnType<typeof fullTableScan>;
  type Expected = Promise<Message[]>;
  assert<Equals<Result, Expected>>();
});

test("order and filter don't change the return type", () => {
  function orderAndFilter(db: DB) {
    return db
      .query("messages")
      .order("desc")
      .filter((q) => q.eq(q.field("body"), "Hello"))
      .collect();
  }
  type Result = ReturnType<typeof orderAndFilter>;
  type Expected = Promise<Message[]>;
  assert<Equals<Result, Expected>>();
});

test("can query() from system tables", () => {
  function collect(db: DB, tableName: SystemTableNames) {
    return db.system.query(tableName).collect();
  }
  type Result = ReturnType<typeof collect>;
  type Expected = Promise<SystemDataModel[SystemTableNames]["document"][]>;
  assert<Equals<Result, Expected>>();
});

test("can get() from system tables", () => {
  function get(db: DB, tableId: Id<SystemTableNames>) {
    return db.system.get(tableId);
  }
  type Result = ReturnType<typeof get>;
  type Expected = Promise<SystemDataModel[SystemTableNames]["document"] | null>;
  assert<Equals<Result, Expected>>();
});

test("system-level database reader can only get() from system tables", () => {
  function get(db: DB, tableId: Id<TableNamesInDataModel<DataModel>>) {
    // @ts-expect-error We cannot query user tables from system GenericDatabaseReader
    return db.system.get(tableId);
  }
});

test("system-level database reader can only query() from system tables", () => {
  function collect(db: DB, tableName: TableNamesInDataModel<DataModel>) {
    // @ts-expect-error We cannot query user tables from system GenericDatabaseReader
    return db.system.query(tableName).collect();
  }
});
