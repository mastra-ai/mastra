// src/authorization.ts
var TYPES_TO_OBJECTS = {
  strict_mfa: {
    afterMinutes: 10,
    level: "multi_factor"
  },
  strict: {
    afterMinutes: 10,
    level: "second_factor"
  },
  moderate: {
    afterMinutes: 60,
    level: "second_factor"
  },
  lax: {
    afterMinutes: 1440,
    level: "second_factor"
  }
};
var ALLOWED_LEVELS = /* @__PURE__ */ new Set(["first_factor", "second_factor", "multi_factor"]);
var ALLOWED_TYPES = /* @__PURE__ */ new Set(["strict_mfa", "strict", "moderate", "lax"]);
var isValidMaxAge = (maxAge) => typeof maxAge === "number" && maxAge > 0;
var isValidLevel = (level) => ALLOWED_LEVELS.has(level);
var isValidVerificationType = (type) => ALLOWED_TYPES.has(type);
var prefixWithOrg = (value) => value.replace(/^(org:)*/, "org:");
var checkOrgAuthorization = (params, options) => {
  const { orgId, orgRole, orgPermissions } = options;
  if (!params.role && !params.permission) {
    return null;
  }
  if (!orgId || !orgRole || !orgPermissions) {
    return null;
  }
  if (params.permission) {
    return orgPermissions.includes(prefixWithOrg(params.permission));
  }
  if (params.role) {
    return prefixWithOrg(orgRole) === prefixWithOrg(params.role);
  }
  return null;
};
var checkForFeatureOrPlan = (claim, featureOrPlan) => {
  const { org: orgFeatures, user: userFeatures } = splitByScope(claim);
  const [scope, _id] = featureOrPlan.split(":");
  const id = _id || scope;
  if (scope === "org") {
    return orgFeatures.includes(id);
  } else if (scope === "user") {
    return userFeatures.includes(id);
  } else {
    return [...orgFeatures, ...userFeatures].includes(id);
  }
};
var checkBillingAuthorization = (params, options) => {
  const { features, plans } = options;
  if (params.feature && features) {
    return checkForFeatureOrPlan(features, params.feature);
  }
  if (params.plan && plans) {
    return checkForFeatureOrPlan(plans, params.plan);
  }
  return null;
};
var splitByScope = (fea) => {
  const features = fea ? fea.split(",").map((f) => f.trim()) : [];
  return {
    org: features.filter((f) => f.split(":")[0].includes("o")).map((f) => f.split(":")[1]),
    user: features.filter((f) => f.split(":")[0].includes("u")).map((f) => f.split(":")[1])
  };
};
var validateReverificationConfig = (config) => {
  if (!config) {
    return false;
  }
  const convertConfigToObject = (config2) => {
    if (typeof config2 === "string") {
      return TYPES_TO_OBJECTS[config2];
    }
    return config2;
  };
  const isValidStringValue = typeof config === "string" && isValidVerificationType(config);
  const isValidObjectValue = typeof config === "object" && isValidLevel(config.level) && isValidMaxAge(config.afterMinutes);
  if (isValidStringValue || isValidObjectValue) {
    return convertConfigToObject.bind(null, config);
  }
  return false;
};
var checkReverificationAuthorization = (params, { factorVerificationAge }) => {
  if (!params.reverification || !factorVerificationAge) {
    return null;
  }
  const isValidReverification = validateReverificationConfig(params.reverification);
  if (!isValidReverification) {
    return null;
  }
  const { level, afterMinutes } = isValidReverification();
  const [factor1Age, factor2Age] = factorVerificationAge;
  const isValidFactor1 = factor1Age !== -1 ? afterMinutes > factor1Age : null;
  const isValidFactor2 = factor2Age !== -1 ? afterMinutes > factor2Age : null;
  switch (level) {
    case "first_factor":
      return isValidFactor1;
    case "second_factor":
      return factor2Age !== -1 ? isValidFactor2 : isValidFactor1;
    case "multi_factor":
      return factor2Age === -1 ? isValidFactor1 : isValidFactor1 && isValidFactor2;
  }
};
var createCheckAuthorization = (options) => {
  return (params) => {
    if (!options.userId) {
      return false;
    }
    const billingAuthorization = checkBillingAuthorization(params, options);
    const orgAuthorization = checkOrgAuthorization(params, options);
    const reverificationAuthorization = checkReverificationAuthorization(params, options);
    if ([billingAuthorization || orgAuthorization, reverificationAuthorization].some((a) => a === null)) {
      return [billingAuthorization || orgAuthorization, reverificationAuthorization].some((a) => a === true);
    }
    return [billingAuthorization || orgAuthorization, reverificationAuthorization].every((a) => a === true);
  };
};
var resolveAuthState = ({
  authObject: {
    sessionId,
    sessionStatus,
    userId,
    actor,
    orgId,
    orgRole,
    orgSlug,
    signOut,
    getToken,
    has,
    sessionClaims
  },
  options: { treatPendingAsSignedOut = true }
}) => {
  if (sessionId === void 0 && userId === void 0) {
    return {
      isLoaded: false,
      isSignedIn: void 0,
      sessionId,
      sessionClaims: void 0,
      userId,
      actor: void 0,
      orgId: void 0,
      orgRole: void 0,
      orgSlug: void 0,
      has: void 0,
      signOut,
      getToken
    };
  }
  if (sessionId === null && userId === null) {
    return {
      isLoaded: true,
      isSignedIn: false,
      sessionId,
      userId,
      sessionClaims: null,
      actor: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has: () => false,
      signOut,
      getToken
    };
  }
  if (treatPendingAsSignedOut && sessionStatus === "pending") {
    return {
      isLoaded: true,
      isSignedIn: false,
      sessionId: null,
      userId: null,
      sessionClaims: null,
      actor: null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has: () => false,
      signOut,
      getToken
    };
  }
  if (!!sessionId && !!sessionClaims && !!userId && !!orgId && !!orgRole) {
    return {
      isLoaded: true,
      isSignedIn: true,
      sessionId,
      sessionClaims,
      userId,
      actor: actor || null,
      orgId,
      orgRole,
      orgSlug: orgSlug || null,
      has,
      signOut,
      getToken
    };
  }
  if (!!sessionId && !!sessionClaims && !!userId && !orgId) {
    return {
      isLoaded: true,
      isSignedIn: true,
      sessionId,
      sessionClaims,
      userId,
      actor: actor || null,
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has,
      signOut,
      getToken
    };
  }
};

export {
  splitByScope,
  validateReverificationConfig,
  createCheckAuthorization,
  resolveAuthState
};
//# sourceMappingURL=chunk-3CN5LOSN.mjs.map