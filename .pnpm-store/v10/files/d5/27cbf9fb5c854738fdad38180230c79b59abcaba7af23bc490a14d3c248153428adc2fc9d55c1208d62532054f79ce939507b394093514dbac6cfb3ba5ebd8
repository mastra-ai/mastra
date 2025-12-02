"use strict";
import {
  convexToJson,
  jsonToConvex
} from "../../values/index.js";
import { performAsyncSyscall, performSyscall } from "./syscall.js";
import { QueryInitializerImpl } from "./query_impl.js";
import { validateArg } from "./validate.js";
import { version } from "../../index.js";
import { patchValueToJson } from "../../values/value.js";
async function get(table, id, isSystem) {
  validateArg(id, 1, "get", "id");
  if (typeof id !== "string") {
    throw new Error(
      `Invalid argument \`id\` for \`db.get\`, expected string but got '${typeof id}': ${id}`
    );
  }
  const args = {
    id: convexToJson(id),
    isSystem,
    version,
    table
  };
  const syscallJSON = await performAsyncSyscall("1.0/get", args);
  return jsonToConvex(syscallJSON);
}
export function setupReader() {
  const reader = (isSystem = false) => {
    return {
      get: async (arg0, arg1) => {
        return arg1 !== void 0 ? await get(arg0, arg1, isSystem) : await get(void 0, arg0, isSystem);
      },
      query: (tableName) => {
        return new TableReader(tableName, isSystem).query();
      },
      normalizeId: (tableName, id) => {
        validateArg(tableName, 1, "normalizeId", "tableName");
        validateArg(id, 2, "normalizeId", "id");
        const accessingSystemTable = tableName.startsWith("_");
        if (accessingSystemTable !== isSystem) {
          throw new Error(
            `${accessingSystemTable ? "System" : "User"} tables can only be accessed from db.${isSystem ? "" : "system."}normalizeId().`
          );
        }
        const syscallJSON = performSyscall("1.0/db/normalizeId", {
          table: tableName,
          idString: id
        });
        const syscallResult = jsonToConvex(syscallJSON);
        return syscallResult.id;
      },
      // We set the system reader on the next line
      system: null,
      table: (tableName) => {
        return new TableReader(tableName, isSystem);
      }
    };
  };
  const { system: _, ...rest } = reader(true);
  const r = reader();
  r.system = rest;
  return r;
}
async function insert(tableName, value) {
  if (tableName.startsWith("_")) {
    throw new Error("System tables (prefixed with `_`) are read-only.");
  }
  validateArg(tableName, 1, "insert", "table");
  validateArg(value, 2, "insert", "value");
  const syscallJSON = await performAsyncSyscall("1.0/insert", {
    table: tableName,
    value: convexToJson(value)
  });
  const syscallResult = jsonToConvex(syscallJSON);
  return syscallResult._id;
}
async function patch(table, id, value) {
  validateArg(id, 1, "patch", "id");
  validateArg(value, 2, "patch", "value");
  await performAsyncSyscall("1.0/shallowMerge", {
    id: convexToJson(id),
    value: patchValueToJson(value),
    table
  });
}
async function replace(table, id, value) {
  validateArg(id, 1, "replace", "id");
  validateArg(value, 2, "replace", "value");
  await performAsyncSyscall("1.0/replace", {
    id: convexToJson(id),
    value: convexToJson(value),
    table
  });
}
async function delete_(table, id) {
  validateArg(id, 1, "delete", "id");
  await performAsyncSyscall("1.0/remove", {
    id: convexToJson(id),
    table
  });
}
export function setupWriter() {
  const reader = setupReader();
  return {
    get: reader.get,
    query: reader.query,
    normalizeId: reader.normalizeId,
    system: reader.system,
    insert: async (table, value) => {
      return await insert(table, value);
    },
    patch: async (arg0, arg1, arg2) => {
      return arg2 !== void 0 ? await patch(arg0, arg1, arg2) : await patch(void 0, arg0, arg1);
    },
    replace: async (arg0, arg1, arg2) => {
      return arg2 !== void 0 ? await replace(arg0, arg1, arg2) : await replace(void 0, arg0, arg1);
    },
    delete: async (arg0, arg1) => {
      return arg1 !== void 0 ? await delete_(arg0, arg1) : await delete_(void 0, arg0);
    },
    table: (tableName) => {
      return new TableWriter(tableName, false);
    }
  };
}
class TableReader {
  constructor(tableName, isSystem) {
    this.tableName = tableName;
    this.isSystem = isSystem;
  }
  async get(id) {
    return get(this.tableName, id, this.isSystem);
  }
  query() {
    const accessingSystemTable = this.tableName.startsWith("_");
    if (accessingSystemTable !== this.isSystem) {
      throw new Error(
        `${accessingSystemTable ? "System" : "User"} tables can only be accessed from db.${this.isSystem ? "" : "system."}query().`
      );
    }
    return new QueryInitializerImpl(this.tableName);
  }
}
class TableWriter extends TableReader {
  async insert(value) {
    return insert(this.tableName, value);
  }
  async patch(id, value) {
    return patch(this.tableName, id, value);
  }
  async replace(id, value) {
    return replace(this.tableName, id, value);
  }
  async delete(id) {
    return delete_(this.tableName, id);
  }
}
//# sourceMappingURL=database_impl.js.map
