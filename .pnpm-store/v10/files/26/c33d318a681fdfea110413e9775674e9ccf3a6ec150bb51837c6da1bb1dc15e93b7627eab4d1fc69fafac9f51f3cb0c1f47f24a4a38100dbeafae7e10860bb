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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  sValidator: () => sValidator
});
module.exports = __toCommonJS(index_exports);
var import_validator = require("hono/validator");

// src/sanitize-issues.ts
var RESTRICTED_DATA_FIELDS = {
  header: ["cookie"]
};
function sanitizeIssues(issues, vendor, target) {
  if (!(target in RESTRICTED_DATA_FIELDS)) {
    return issues;
  }
  const restrictedFields = RESTRICTED_DATA_FIELDS[target] || [];
  if (vendor === "arktype") {
    return sanitizeArktypeIssues(issues, restrictedFields);
  }
  if (vendor === "valibot") {
    return sanitizeValibotIssues(issues, restrictedFields);
  }
  return issues;
}
function sanitizeArktypeIssues(issues, restrictedFields) {
  return issues.map((issue) => {
    if (issue && typeof issue === "object" && "data" in issue && typeof issue.data === "object" && issue.data !== null && !Array.isArray(issue.data)) {
      const dataCopy = { ...issue.data };
      for (const field of restrictedFields) {
        delete dataCopy[field];
      }
      const sanitizedIssue = Object.create(Object.getPrototypeOf(issue));
      Object.assign(sanitizedIssue, issue, { data: dataCopy });
      return sanitizedIssue;
    }
    return issue;
  });
}
function sanitizeValibotIssues(issues, restrictedFields) {
  return issues.map((issue) => {
    if (issue && typeof issue === "object" && "path" in issue && Array.isArray(issue.path)) {
      for (const path of issue.path) {
        if (typeof path === "object" && "input" in path && typeof path.input === "object" && path.input !== null && !Array.isArray(path.input)) {
          for (const field of restrictedFields) {
            delete path.input[field];
          }
        }
      }
    }
    return issue;
  });
}

// src/index.ts
var sValidator = (target, schema, hook) => (
  // @ts-expect-error not typed well
  (0, import_validator.validator)(target, async (value, c) => {
    const result = await schema["~standard"].validate(value);
    if (hook) {
      const hookResult = await hook(
        result.issues ? { data: value, error: result.issues, success: false, target } : { data: value, success: true, target },
        c
      );
      if (hookResult) {
        if (hookResult instanceof Response) {
          return hookResult;
        }
        if ("response" in hookResult) {
          return hookResult.response;
        }
      }
    }
    if (result.issues) {
      const processedIssues = sanitizeIssues(result.issues, schema["~standard"].vendor, target);
      return c.json({ data: value, error: processedIssues, success: false }, 400);
    }
    return result.value;
  })
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  sValidator
});
