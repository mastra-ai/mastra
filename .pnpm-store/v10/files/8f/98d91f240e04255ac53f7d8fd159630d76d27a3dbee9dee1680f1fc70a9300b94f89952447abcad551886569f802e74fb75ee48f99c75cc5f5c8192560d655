import { describe, test, expect, vi, beforeEach } from "vitest";
import { setupWriter } from "./impl/database_impl.js";
import * as syscall from "./impl/syscall.js";
import { GenericId, v } from "../values/index.js";
import { version } from "../index.js";
import { GenericDatabaseWriter } from "./database.js";
import {
  DataModelFromSchemaDefinition,
  defineSchema,
  defineTable,
} from "./schema.js";

vi.mock("./impl/syscall.js", () => ({
  performAsyncSyscall: vi.fn().mockResolvedValue({}),
}));

const testId = "test_id" as GenericId<"testTable">;
const testSystemId = "test_system_id" as GenericId<"_storage">;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DB APIs work with the deprecated API (implicit table names)", () => {
  test("get", async () => {
    const db = setupWriter();
    await db.get(testId);

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/get",
      {
        id: "test_id",
        isSystem: false,
        version: expect.any(String),
      },
    );
  });

  test("get (system table)", async () => {
    const db = setupWriter();
    await db.system.get(testSystemId);

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/get",
      {
        id: "test_system_id",
        isSystem: true,
        version,
      },
    );
  });

  test("patch", async () => {
    const db = setupWriter();
    await db.patch(testId, {
      name: "updated",
      email: undefined,
    });

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/shallowMerge",
      {
        id: "test_id",
        value: {
          name: "updated",
          email: {
            $undefined: null,
          },
        },
      },
    );
  });

  test("replace", async () => {
    const db = setupWriter();
    await db.replace(testId, {
      name: "replaced",
    });

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/replace",
      {
        id: "test_id",
        value: { name: "replaced" },
      },
    );
  });

  test("delete", async () => {
    const db = setupWriter();
    await db.delete(testId);

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/remove",
      {
        id: "test_id",
      },
    );
  });
});

describe("DB APIs fail when missing arguments", () => {
  describe("get", () => {
    test("0 arg", async () => {
      const db = setupWriter();
      // @ts-expect-error
      await expect(() => db.get()).rejects.toThrow();
    });
  });

  describe("patch", () => {
    test("0 arg", async () => {
      const db = setupWriter();
      // @ts-expect-error
      await expect(() => db.patch()).rejects.toThrow();
    });

    test("1 arg", async () => {
      const db = setupWriter();
      // @ts-expect-error
      await expect(() => db.patch(testId)).rejects.toThrow();
    });
  });

  describe("replace", () => {
    test("0 arg", async () => {
      const db = setupWriter();
      // @ts-expect-error
      await expect(() => db.replace()).rejects.toThrow();
    });

    test("1 arg", async () => {
      const db = setupWriter();
      // @ts-expect-error
      await expect(() => db.replace(testId)).rejects.toThrow();
    });
  });

  describe("delete", () => {
    test("0 arg", async () => {
      const db = setupWriter();
      // @ts-expect-error
      await expect(() => db.delete()).rejects.toThrow();
    });
  });
});

describe("new DB APIs work with explicit table names", () => {
  test("get", async () => {
    const db = setupWriter();
    await db.get("testTable", testId);

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/get",
      {
        id: "test_id",
        table: "testTable",
        isSystem: false,
        version,
      },
    );
  });

  test("get (system table)", async () => {
    const db = setupWriter();
    await db.system.get("_storage", testSystemId);

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/get",
      {
        id: "test_system_id",
        table: "_storage",
        isSystem: true,
        version,
      },
    );
  });

  test("patch", async () => {
    const db = setupWriter();
    await db.patch("testTable", testId, {
      name: "updated",
    });

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/shallowMerge",
      {
        id: "test_id",
        table: "testTable",
        value: {
          name: "updated",
        },
      },
    );
  });

  test("replace", async () => {
    const db = setupWriter();
    await db.replace("testTable", testId, {
      name: "replaced",
    });

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/replace",
      {
        id: "test_id",
        table: "testTable",
        value: { name: "replaced" },
      },
    );
  });

  test("delete", async () => {
    const db = setupWriter();
    await db.delete("testTable", testId);

    expect(vi.mocked(syscall.performAsyncSyscall)).toHaveBeenCalledWith(
      "1.0/remove",
      {
        id: "test_id",
        table: "testTable",
      },
    );
  });
});

describe("new DB APIs don’t type check if used with the wrong table", () => {
  test("get", async () => {
    const db = setupWriter();
    // @ts-expect-error
    await db.get("testTable2", testId);
  });

  test("get (system table)", async () => {
    const db = setupWriter();
    // @ts-expect-error
    await db.system.get("_scheduled_functions", testSystemId);
  });

  test("patch", async () => {
    const db = setupWriter();
    // @ts-expect-error
    await db.patch("testTable2", testId, {});
  });

  test("replace", async () => {
    const db = setupWriter();
    // @ts-expect-error
    await db.replace("testTable2", testId, {
      name: "replaced",
    });
  });

  test("delete", async () => {
    const db = setupWriter();
    // @ts-expect-error
    await db.delete("testTable2", testId);
  });

  test("can use Id<string> + string table name", async () => {
    // This shouldn’t be used in most cases but sometimes people do hacky stuff
    // so we need to support it. If people do this, they accept that they might
    // get runtime errors if they do it wrong.

    const tableName: string = "testTable";
    const id = "my_id" as GenericId<string>;

    const db = setupWriter();
    await db.replace(tableName, id, {});
  });

  test("can use Id<string> + a specific table name", async () => {
    // Maybe we should disallow this??

    const id = "my_id" as GenericId<string>;

    const db = setupWriter();
    await db.replace("testTable", id, {});
  });

  test("can use some union types", async () => {
    const tableName: "a" | "b" = "a";
    const id = "my_id" as GenericId<"a" | "b">;

    const db = setupWriter();
    await db.replace(tableName, id, {});
  });

  test("can’t use Id<some table> + string table name", async () => {
    // If we have the specific ID in the type system, it makes no sense to
    // use a string table name.

    const tableName: string = "some table";

    const db = setupWriter();
    // @ts-expect-error
    await db.replace(tableName, testId, {});
  });
});

describe("type checking of patch/replace arguments", () => {
  const _schema = defineSchema({
    testTable: defineTable({
      nameFromTable1: v.string(),
    }),
    testTable2: defineTable({
      nameFromTable2: v.string(),
    }),
  });
  type DataModel = DataModelFromSchemaDefinition<typeof _schema>;
  type TypedDbWriter = GenericDatabaseWriter<DataModel>;

  describe("old API", () => {
    test("patch", async () => {
      const db: TypedDbWriter = setupWriter();
      await db.patch(testId, {
        nameFromTable1: "asd",
      });
      await db.patch(testId, {
        // @ts-expect-error
        nameFromTable2: "asd",
      });
    });

    test("replace", async () => {
      const db: TypedDbWriter = setupWriter();
      await db.replace(testId, {
        nameFromTable1: "asd",
      });
      await db.replace(testId, {
        // @ts-expect-error
        nameFromTable2: "asd",
      });
    });
  });

  describe("new API", () => {
    test("patch", async () => {
      const db: TypedDbWriter = setupWriter();
      await db.patch("testTable", testId, {
        nameFromTable1: "asd",
      });
      await db.patch("testTable", testId, {
        // @ts-expect-error
        nameFromTable2: "asd",
      });
    });

    test("replace", async () => {
      const db: TypedDbWriter = setupWriter();
      await db.replace("testTable", testId, {
        nameFromTable1: "asd",
      });
      await db.replace("testTable", testId, {
        // @ts-expect-error
        nameFromTable2: "asd",
      });
    });
  });
});
