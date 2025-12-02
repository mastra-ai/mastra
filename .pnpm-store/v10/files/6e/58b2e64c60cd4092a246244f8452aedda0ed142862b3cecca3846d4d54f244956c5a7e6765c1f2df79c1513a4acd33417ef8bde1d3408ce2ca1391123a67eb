// src/getEnvVariable.ts
var hasCloudflareProxyContext = (context) => {
  return !!context?.cloudflare?.env;
};
var hasCloudflareContext = (context) => {
  return !!context?.env;
};
var getEnvVariable = (name, context) => {
  if (typeof process !== "undefined" && process.env && typeof process.env[name] === "string") {
    return process.env[name];
  }
  if (typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env[name] === "string") {
    return import.meta.env[name];
  }
  if (hasCloudflareProxyContext(context)) {
    return context.cloudflare.env[name] || "";
  }
  if (hasCloudflareContext(context)) {
    return context.env[name] || "";
  }
  if (context && typeof context[name] === "string") {
    return context[name];
  }
  try {
    return globalThis[name];
  } catch {
  }
  return "";
};

export {
  getEnvVariable
};
//# sourceMappingURL=chunk-IBB3AM7F.mjs.map