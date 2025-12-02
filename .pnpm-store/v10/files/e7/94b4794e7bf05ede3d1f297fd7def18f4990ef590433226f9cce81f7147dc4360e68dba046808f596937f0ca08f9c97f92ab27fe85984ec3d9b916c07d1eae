// src/index.ts
import { validator } from "hono/validator";

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
  validator(target, async (value, c) => {
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
export {
  sValidator
};
