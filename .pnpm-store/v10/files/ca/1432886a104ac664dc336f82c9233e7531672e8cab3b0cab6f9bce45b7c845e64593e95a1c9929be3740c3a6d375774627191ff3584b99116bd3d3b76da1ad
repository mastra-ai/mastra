"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var database_impl_exports = {};
__export(database_impl_exports, {
  setupReader: () => setupReader,
  setupWriter: () => setupWriter
});
module.exports = __toCommonJS(database_impl_exports);
var import_values = require("../../values/index.js");
var import_syscall = require("./syscall.js");
var import_query_impl = require("./query_impl.js");
var import_validate = require("./validate.js");
var import__ = require("../../index.js");
var import_value = require("../../values/value.js");
async function get(table, id, isSystem) {
  (0, import_validate.validateArg)(id, 1, "get", "id");
  if (typeof id !== "string") {
    throw new Error(
      `Invalid argument \`id\` for \`db.get\`, expected string but got '${typeof id}': ${id}`
    );
  }
  const args = {
    id: (0, import_values.convexToJson)(id),
    isSystem,
    version: import__.version,
    table
  };
  const syscallJSON = await (0, import_syscall.performAsyncSyscall)("1.0/get", args);
  return (0, import_values.jsonToConvex)(syscallJSON);
}
function setupReader() {
  const reader = (isSystem = false) => {
    return {
      get: async (arg0, arg1) => {
        return arg1 !== void 0 ? await get(arg0, arg1, isSystem) : await get(void 0, arg0, isSystem);
      },
      query: (tableName) => {
        return new TableReader(tableName, isSystem).query();
      },
      normalizeId: (tableName, id) => {
        (0, import_validate.validateArg)(tableName, 1, "normalizeId", "tableName");
        (0, import_validate.validateArg)(id, 2, "normalizeId", "id");
        const accessingSystemTable = tableName.startsWith("_");
        if (accessingSystemTable !== isSystem) {
          throw new Error(
            `${accessingSystemTable ? "System" : "User"} tables can only be accessed from db.${isSystem ? "" : "system."}normalizeId().`
          );
        }
        const syscallJSON = (0, import_syscall.performSyscall)("1.0/db/normalizeId", {
          table: tableName,
          idString: id
        });
        const syscallResult = (0, import_values.jsonToConvex)(syscallJSON);
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
  (0, import_validate.validateArg)(tableName, 1, "insert", "table");
  (0, import_validate.validateArg)(value, 2, "insert", "value");
  const syscallJSON = await (0, import_syscall.performAsyncSyscall)("1.0/insert", {
    table: tableName,
    value: (0, import_values.convexToJson)(value)
  });
  const syscallResult = (0, import_values.jsonToConvex)(syscallJSON);
  return syscallResult._id;
}
async function patch(table, id, value) {
  (0, import_validate.validateArg)(id, 1, "patch", "id");
  (0, import_validate.validateArg)(value, 2, "patch", "value");
  await (0, import_syscall.performAsyncSyscall)("1.0/shallowMerge", {
    id: (0, import_values.convexToJson)(id),
    value: (0, import_value.patchValueToJson)(value),
    table
  });
}
async function replace(table, id, value) {
  (0, import_validate.validateArg)(id, 1, "replace", "id");
  (0, import_validate.validateArg)(value, 2, "replace", "value");
  await (0, import_syscall.performAsyncSyscall)("1.0/replace", {
    id: (0, import_values.convexToJson)(id),
    value: (0, import_values.convexToJson)(value),
    table
  });
}
async function delete_(table, id) {
  (0, import_validate.validateArg)(id, 1, "delete", "id");
  await (0, import_syscall.performAsyncSyscall)("1.0/remove", {
    id: (0, import_values.convexToJson)(id),
    table
  });
}
function setupWriter() {
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
    return new import_query_impl.QueryInitializerImpl(this.tableName);
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
