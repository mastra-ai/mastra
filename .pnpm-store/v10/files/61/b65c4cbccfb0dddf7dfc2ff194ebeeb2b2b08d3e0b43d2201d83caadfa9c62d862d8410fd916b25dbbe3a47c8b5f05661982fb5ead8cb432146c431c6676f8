import {
  parsePublishableKey
} from "./chunk-IV7BOO4U.mjs";
import {
  LEGACY_DEV_INSTANCE_SUFFIXES,
  LOCAL_API_URL,
  LOCAL_ENV_SUFFIXES,
  PROD_API_URL,
  STAGING_API_URL,
  STAGING_ENV_SUFFIXES
} from "./chunk-I6MTSTOF.mjs";

// src/apiUrlFromPublishableKey.ts
var apiUrlFromPublishableKey = (publishableKey) => {
  const frontendApi = parsePublishableKey(publishableKey)?.frontendApi;
  if (frontendApi?.startsWith("clerk.") && LEGACY_DEV_INSTANCE_SUFFIXES.some((suffix) => frontendApi?.endsWith(suffix))) {
    return PROD_API_URL;
  }
  if (LOCAL_ENV_SUFFIXES.some((suffix) => frontendApi?.endsWith(suffix))) {
    return LOCAL_API_URL;
  }
  if (STAGING_ENV_SUFFIXES.some((suffix) => frontendApi?.endsWith(suffix))) {
    return STAGING_API_URL;
  }
  return PROD_API_URL;
};

export {
  apiUrlFromPublishableKey
};
//# sourceMappingURL=chunk-BLFJDBCF.mjs.map