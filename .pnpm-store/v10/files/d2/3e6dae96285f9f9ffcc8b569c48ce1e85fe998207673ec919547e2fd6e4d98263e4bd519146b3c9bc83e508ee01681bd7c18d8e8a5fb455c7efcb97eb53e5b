"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react/index.ts
var react_exports = {};
__export(react_exports, {
  ClerkInstanceContext: () => ClerkInstanceContext,
  ClientContext: () => ClientContext,
  OptionsContext: () => OptionsContext,
  OrganizationProvider: () => OrganizationProvider,
  SessionContext: () => SessionContext,
  UserContext: () => UserContext,
  __experimental_CheckoutProvider: () => __experimental_CheckoutProvider,
  __experimental_PaymentElement: () => PaymentElement2,
  __experimental_PaymentElementProvider: () => PaymentElementProvider,
  __experimental_useCheckout: () => useCheckout,
  __experimental_usePaymentAttempts: () => usePaymentAttempts,
  __experimental_usePaymentElement: () => usePaymentElement,
  __experimental_usePaymentMethods: () => usePaymentMethods,
  __experimental_usePlans: () => usePlans,
  __experimental_useStatements: () => useStatements,
  __experimental_useSubscription: () => useSubscription,
  assertContextExists: () => assertContextExists,
  createContextAndHook: () => createContextAndHook,
  isDeeplyEqual: () => isDeeplyEqual,
  useAssertWrappedByClerkProvider: () => useAssertWrappedByClerkProvider,
  useClerk: () => useClerk,
  useClerkInstanceContext: () => useClerkInstanceContext,
  useClientContext: () => useClientContext,
  useDeepEqualMemo: () => useDeepEqualMemo,
  useOptionsContext: () => useOptionsContext,
  useOrganization: () => useOrganization,
  useOrganizationContext: () => useOrganizationContext,
  useOrganizationList: () => useOrganizationList,
  useReverification: () => useReverification,
  useSafeLayoutEffect: () => useSafeLayoutEffect,
  useSession: () => useSession,
  useSessionContext: () => useSessionContext,
  useSessionList: () => useSessionList,
  useUser: () => useUser,
  useUserContext: () => useUserContext
});
module.exports = __toCommonJS(react_exports);

// src/react/hooks/createContextAndHook.ts
var import_react = __toESM(require("react"));
function assertContextExists(contextVal, msgOrCtx) {
  if (!contextVal) {
    throw typeof msgOrCtx === "string" ? new Error(msgOrCtx) : new Error(`${msgOrCtx.displayName} not found`);
  }
}
var createContextAndHook = (displayName, options) => {
  const { assertCtxFn = assertContextExists } = options || {};
  const Ctx = import_react.default.createContext(void 0);
  Ctx.displayName = displayName;
  const useCtx = () => {
    const ctx = import_react.default.useContext(Ctx);
    assertCtxFn(ctx, `${displayName} not found`);
    return ctx.value;
  };
  const useCtxWithoutGuarantee = () => {
    const ctx = import_react.default.useContext(Ctx);
    return ctx ? ctx.value : {};
  };
  return [Ctx, useCtx, useCtxWithoutGuarantee];
};

// src/organization.ts
function getCurrentOrganizationMembership(organizationMemberships, organizationId) {
  return organizationMemberships.find(
    (organizationMembership) => organizationMembership.organization.id === organizationId
  );
}

// src/telemetry/events/method-called.ts
var EVENT_METHOD_CALLED = "METHOD_CALLED";
var EVENT_SAMPLING_RATE = 0.1;
function eventMethodCalled(method, payload) {
  return {
    event: EVENT_METHOD_CALLED,
    eventSamplingRate: EVENT_SAMPLING_RATE,
    payload: {
      method,
      ...payload
    }
  };
}

// src/react/contexts.tsx
var import_react2 = __toESM(require("react"));

// src/react/clerk-swr.ts
var clerk_swr_exports = {};
__export(clerk_swr_exports, {
  useSWR: () => import_swr.default,
  useSWRInfinite: () => import_infinite.default
});
__reExport(clerk_swr_exports, require("swr"));
var import_swr = __toESM(require("swr"));
var import_infinite = __toESM(require("swr/infinite"));

// src/react/contexts.tsx
var [ClerkInstanceContext, useClerkInstanceContext] = createContextAndHook("ClerkInstanceContext");
var [UserContext, useUserContext] = createContextAndHook("UserContext");
var [ClientContext, useClientContext] = createContextAndHook("ClientContext");
var [SessionContext, useSessionContext] = createContextAndHook(
  "SessionContext"
);
var OptionsContext = import_react2.default.createContext({});
var [CheckoutContext, useCheckoutContext] = createContextAndHook("CheckoutContext");
var __experimental_CheckoutProvider = ({ children, ...rest }) => {
  return /* @__PURE__ */ import_react2.default.createElement(CheckoutContext.Provider, { value: { value: rest } }, children);
};
function useOptionsContext() {
  const context = import_react2.default.useContext(OptionsContext);
  if (context === void 0) {
    throw new Error("useOptions must be used within an OptionsContext");
  }
  return context;
}
var [OrganizationContextInternal, useOrganizationContext] = createContextAndHook("OrganizationContext");
var OrganizationProvider = ({
  children,
  organization,
  swrConfig
}) => {
  return /* @__PURE__ */ import_react2.default.createElement(clerk_swr_exports.SWRConfig, { value: swrConfig }, /* @__PURE__ */ import_react2.default.createElement(
    OrganizationContextInternal.Provider,
    {
      value: {
        value: { organization }
      }
    },
    children
  ));
};
function useAssertWrappedByClerkProvider(displayNameOrFn) {
  const ctx = import_react2.default.useContext(ClerkInstanceContext);
  if (!ctx) {
    if (typeof displayNameOrFn === "function") {
      displayNameOrFn();
      return;
    }
    throw new Error(
      `${displayNameOrFn} can only be used within the <ClerkProvider /> component.

Possible fixes:
1. Ensure that the <ClerkProvider /> is correctly wrapping your application where this component is used.
2. Check for multiple versions of the \`@clerk/shared\` package in your project. Use a tool like \`npm ls @clerk/shared\` to identify multiple versions, and update your dependencies to only rely on one.

Learn more: https://clerk.com/docs/components/clerk-provider`.trim()
    );
  }
}

// src/react/hooks/usePagesOrInfinite.ts
var import_react4 = require("react");

// src/react/hooks/usePreviousValue.ts
var import_react3 = require("react");
function usePreviousValue(value) {
  const currentRef = (0, import_react3.useRef)(value);
  const previousRef = (0, import_react3.useRef)(null);
  if (currentRef.current !== value) {
    previousRef.current = currentRef.current;
    currentRef.current = value;
  }
  return previousRef.current;
}

// src/react/hooks/usePagesOrInfinite.ts
function getDifferentKeys(obj1, obj2) {
  const keysSet = new Set(Object.keys(obj2));
  const differentKeysObject = {};
  for (const key1 of Object.keys(obj1)) {
    if (!keysSet.has(key1)) {
      differentKeysObject[key1] = obj1[key1];
    }
  }
  return differentKeysObject;
}
var useWithSafeValues = (params, defaultValues) => {
  const shouldUseDefaults = typeof params === "boolean" && params;
  const initialPageRef = (0, import_react4.useRef)(
    shouldUseDefaults ? defaultValues.initialPage : params?.initialPage ?? defaultValues.initialPage
  );
  const pageSizeRef = (0, import_react4.useRef)(shouldUseDefaults ? defaultValues.pageSize : params?.pageSize ?? defaultValues.pageSize);
  const newObj = {};
  for (const key of Object.keys(defaultValues)) {
    newObj[key] = shouldUseDefaults ? defaultValues[key] : params?.[key] ?? defaultValues[key];
  }
  return {
    ...newObj,
    initialPage: initialPageRef.current,
    pageSize: pageSizeRef.current
  };
};
var cachingSWROptions = {
  dedupingInterval: 1e3 * 60,
  focusThrottleInterval: 1e3 * 60 * 2
};
var usePagesOrInfinite = (params, fetcher, config, cacheKeys) => {
  const [paginatedPage, setPaginatedPage] = (0, import_react4.useState)(params.initialPage ?? 1);
  const initialPageRef = (0, import_react4.useRef)(params.initialPage ?? 1);
  const pageSizeRef = (0, import_react4.useRef)(params.pageSize ?? 10);
  const enabled = config.enabled ?? true;
  const cacheMode = config.__experimental_mode === "cache";
  const triggerInfinite = config.infinite ?? false;
  const keepPreviousData = config.keepPreviousData ?? false;
  const isSignedIn = config.isSignedIn;
  const pagesCacheKey = {
    ...cacheKeys,
    ...params,
    initialPage: paginatedPage,
    pageSize: pageSizeRef.current
  };
  const previousIsSignedIn = usePreviousValue(isSignedIn);
  const shouldFetch = !triggerInfinite && enabled && (!cacheMode ? !!fetcher : true);
  const swrKey = typeof isSignedIn === "boolean" ? previousIsSignedIn === true && isSignedIn === false ? pagesCacheKey : isSignedIn ? shouldFetch ? pagesCacheKey : null : null : shouldFetch ? pagesCacheKey : null;
  const swrFetcher = !cacheMode && !!fetcher ? (cacheKeyParams) => {
    if (isSignedIn === false || shouldFetch === false) {
      return null;
    }
    const requestParams = getDifferentKeys(cacheKeyParams, cacheKeys);
    return fetcher({ ...params, ...requestParams });
  } : null;
  const {
    data: swrData,
    isValidating: swrIsValidating,
    isLoading: swrIsLoading,
    error: swrError,
    mutate: swrMutate
  } = (0, import_swr.default)(swrKey, swrFetcher, { keepPreviousData, ...cachingSWROptions });
  const {
    data: swrInfiniteData,
    isLoading: swrInfiniteIsLoading,
    isValidating: swrInfiniteIsValidating,
    error: swrInfiniteError,
    size,
    setSize,
    mutate: swrInfiniteMutate
  } = (0, import_infinite.default)(
    (pageIndex) => {
      if (!triggerInfinite || !enabled || isSignedIn === false) {
        return null;
      }
      return {
        ...params,
        ...cacheKeys,
        initialPage: initialPageRef.current + pageIndex,
        pageSize: pageSizeRef.current
      };
    },
    (cacheKeyParams) => {
      const requestParams = getDifferentKeys(cacheKeyParams, cacheKeys);
      return fetcher?.(requestParams);
    },
    cachingSWROptions
  );
  const page = (0, import_react4.useMemo)(() => {
    if (triggerInfinite) {
      return size;
    }
    return paginatedPage;
  }, [triggerInfinite, size, paginatedPage]);
  const fetchPage = (0, import_react4.useCallback)(
    (numberOrgFn) => {
      if (triggerInfinite) {
        void setSize(numberOrgFn);
        return;
      }
      return setPaginatedPage(numberOrgFn);
    },
    [setSize, triggerInfinite]
  );
  const data = (0, import_react4.useMemo)(() => {
    if (triggerInfinite) {
      return swrInfiniteData?.map((a) => a?.data).flat() ?? [];
    }
    return swrData?.data ?? [];
  }, [triggerInfinite, swrData, swrInfiniteData]);
  const count = (0, import_react4.useMemo)(() => {
    if (triggerInfinite) {
      return swrInfiniteData?.[swrInfiniteData?.length - 1]?.total_count || 0;
    }
    return swrData?.total_count ?? 0;
  }, [triggerInfinite, swrData, swrInfiniteData]);
  const isLoading = triggerInfinite ? swrInfiniteIsLoading : swrIsLoading;
  const isFetching = triggerInfinite ? swrInfiniteIsValidating : swrIsValidating;
  const error = (triggerInfinite ? swrInfiniteError : swrError) ?? null;
  const isError = !!error;
  const fetchNext = (0, import_react4.useCallback)(() => {
    fetchPage((n) => Math.max(0, n + 1));
  }, [fetchPage]);
  const fetchPrevious = (0, import_react4.useCallback)(() => {
    fetchPage((n) => Math.max(0, n - 1));
  }, [fetchPage]);
  const offsetCount = (initialPageRef.current - 1) * pageSizeRef.current;
  const pageCount = Math.ceil((count - offsetCount) / pageSizeRef.current);
  const hasNextPage = count - offsetCount * pageSizeRef.current > page * pageSizeRef.current;
  const hasPreviousPage = (page - 1) * pageSizeRef.current > offsetCount * pageSizeRef.current;
  const setData = triggerInfinite ? (value) => swrInfiniteMutate(value, {
    revalidate: false
  }) : (value) => swrMutate(value, {
    revalidate: false
  });
  const revalidate = triggerInfinite ? () => swrInfiniteMutate() : () => swrMutate();
  return {
    data,
    count,
    error,
    isLoading,
    isFetching,
    isError,
    page,
    pageCount,
    fetchPage,
    fetchNext,
    fetchPrevious,
    hasNextPage,
    hasPreviousPage,
    // Let the hook return type define this type
    revalidate,
    // Let the hook return type define this type
    setData
  };
};

// src/react/hooks/useOrganization.tsx
var undefinedPaginatedResource = {
  data: void 0,
  count: void 0,
  error: void 0,
  isLoading: false,
  isFetching: false,
  isError: false,
  page: void 0,
  pageCount: void 0,
  fetchPage: void 0,
  fetchNext: void 0,
  fetchPrevious: void 0,
  hasNextPage: false,
  hasPreviousPage: false,
  revalidate: void 0,
  setData: void 0
};
function useOrganization(params) {
  const {
    domains: domainListParams,
    membershipRequests: membershipRequestsListParams,
    memberships: membersListParams,
    invitations: invitationsListParams
  } = params || {};
  useAssertWrappedByClerkProvider("useOrganization");
  const { organization } = useOrganizationContext();
  const session = useSessionContext();
  const domainSafeValues = useWithSafeValues(domainListParams, {
    initialPage: 1,
    pageSize: 10,
    keepPreviousData: false,
    infinite: false,
    enrollmentMode: void 0
  });
  const membershipRequestSafeValues = useWithSafeValues(membershipRequestsListParams, {
    initialPage: 1,
    pageSize: 10,
    status: "pending",
    keepPreviousData: false,
    infinite: false
  });
  const membersSafeValues = useWithSafeValues(membersListParams, {
    initialPage: 1,
    pageSize: 10,
    role: void 0,
    keepPreviousData: false,
    infinite: false,
    query: void 0
  });
  const invitationsSafeValues = useWithSafeValues(invitationsListParams, {
    initialPage: 1,
    pageSize: 10,
    status: ["pending"],
    keepPreviousData: false,
    infinite: false
  });
  const clerk = useClerkInstanceContext();
  clerk.telemetry?.record(eventMethodCalled("useOrganization"));
  const domainParams = typeof domainListParams === "undefined" ? void 0 : {
    initialPage: domainSafeValues.initialPage,
    pageSize: domainSafeValues.pageSize,
    enrollmentMode: domainSafeValues.enrollmentMode
  };
  const membershipRequestParams = typeof membershipRequestsListParams === "undefined" ? void 0 : {
    initialPage: membershipRequestSafeValues.initialPage,
    pageSize: membershipRequestSafeValues.pageSize,
    status: membershipRequestSafeValues.status
  };
  const membersParams = typeof membersListParams === "undefined" ? void 0 : {
    initialPage: membersSafeValues.initialPage,
    pageSize: membersSafeValues.pageSize,
    role: membersSafeValues.role,
    query: membersSafeValues.query
  };
  const invitationsParams = typeof invitationsListParams === "undefined" ? void 0 : {
    initialPage: invitationsSafeValues.initialPage,
    pageSize: invitationsSafeValues.pageSize,
    status: invitationsSafeValues.status
  };
  const domains = usePagesOrInfinite(
    {
      ...domainParams
    },
    organization?.getDomains,
    {
      keepPreviousData: domainSafeValues.keepPreviousData,
      infinite: domainSafeValues.infinite,
      enabled: !!domainParams
    },
    {
      type: "domains",
      organizationId: organization?.id
    }
  );
  const membershipRequests = usePagesOrInfinite(
    {
      ...membershipRequestParams
    },
    organization?.getMembershipRequests,
    {
      keepPreviousData: membershipRequestSafeValues.keepPreviousData,
      infinite: membershipRequestSafeValues.infinite,
      enabled: !!membershipRequestParams
    },
    {
      type: "membershipRequests",
      organizationId: organization?.id
    }
  );
  const memberships = usePagesOrInfinite(
    membersParams || {},
    organization?.getMemberships,
    {
      keepPreviousData: membersSafeValues.keepPreviousData,
      infinite: membersSafeValues.infinite,
      enabled: !!membersParams
    },
    {
      type: "members",
      organizationId: organization?.id
    }
  );
  const invitations = usePagesOrInfinite(
    {
      ...invitationsParams
    },
    organization?.getInvitations,
    {
      keepPreviousData: invitationsSafeValues.keepPreviousData,
      infinite: invitationsSafeValues.infinite,
      enabled: !!invitationsParams
    },
    {
      type: "invitations",
      organizationId: organization?.id
    }
  );
  if (organization === void 0) {
    return {
      isLoaded: false,
      organization: void 0,
      membership: void 0,
      domains: undefinedPaginatedResource,
      membershipRequests: undefinedPaginatedResource,
      memberships: undefinedPaginatedResource,
      invitations: undefinedPaginatedResource
    };
  }
  if (organization === null) {
    return {
      isLoaded: true,
      organization: null,
      membership: null,
      domains: null,
      membershipRequests: null,
      memberships: null,
      invitations: null
    };
  }
  if (!clerk.loaded && organization) {
    return {
      isLoaded: true,
      organization,
      membership: void 0,
      domains: undefinedPaginatedResource,
      membershipRequests: undefinedPaginatedResource,
      memberships: undefinedPaginatedResource,
      invitations: undefinedPaginatedResource
    };
  }
  return {
    isLoaded: clerk.loaded,
    organization,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    membership: getCurrentOrganizationMembership(session.user.organizationMemberships, organization.id),
    // your membership in the current org
    domains,
    membershipRequests,
    memberships,
    invitations
  };
}

// src/react/hooks/useOrganizationList.tsx
var undefinedPaginatedResource2 = {
  data: void 0,
  count: void 0,
  error: void 0,
  isLoading: false,
  isFetching: false,
  isError: false,
  page: void 0,
  pageCount: void 0,
  fetchPage: void 0,
  fetchNext: void 0,
  fetchPrevious: void 0,
  hasNextPage: false,
  hasPreviousPage: false,
  revalidate: void 0,
  setData: void 0
};
function useOrganizationList(params) {
  const { userMemberships, userInvitations, userSuggestions } = params || {};
  useAssertWrappedByClerkProvider("useOrganizationList");
  const userMembershipsSafeValues = useWithSafeValues(userMemberships, {
    initialPage: 1,
    pageSize: 10,
    keepPreviousData: false,
    infinite: false
  });
  const userInvitationsSafeValues = useWithSafeValues(userInvitations, {
    initialPage: 1,
    pageSize: 10,
    status: "pending",
    keepPreviousData: false,
    infinite: false
  });
  const userSuggestionsSafeValues = useWithSafeValues(userSuggestions, {
    initialPage: 1,
    pageSize: 10,
    status: "pending",
    keepPreviousData: false,
    infinite: false
  });
  const clerk = useClerkInstanceContext();
  const user = useUserContext();
  clerk.telemetry?.record(eventMethodCalled("useOrganizationList"));
  const userMembershipsParams = typeof userMemberships === "undefined" ? void 0 : {
    initialPage: userMembershipsSafeValues.initialPage,
    pageSize: userMembershipsSafeValues.pageSize
  };
  const userInvitationsParams = typeof userInvitations === "undefined" ? void 0 : {
    initialPage: userInvitationsSafeValues.initialPage,
    pageSize: userInvitationsSafeValues.pageSize,
    status: userInvitationsSafeValues.status
  };
  const userSuggestionsParams = typeof userSuggestions === "undefined" ? void 0 : {
    initialPage: userSuggestionsSafeValues.initialPage,
    pageSize: userSuggestionsSafeValues.pageSize,
    status: userSuggestionsSafeValues.status
  };
  const isClerkLoaded = !!(clerk.loaded && user);
  const memberships = usePagesOrInfinite(
    userMembershipsParams || {},
    user?.getOrganizationMemberships,
    {
      keepPreviousData: userMembershipsSafeValues.keepPreviousData,
      infinite: userMembershipsSafeValues.infinite,
      enabled: !!userMembershipsParams
    },
    {
      type: "userMemberships",
      userId: user?.id
    }
  );
  const invitations = usePagesOrInfinite(
    {
      ...userInvitationsParams
    },
    user?.getOrganizationInvitations,
    {
      keepPreviousData: userInvitationsSafeValues.keepPreviousData,
      infinite: userInvitationsSafeValues.infinite,
      enabled: !!userInvitationsParams
    },
    {
      type: "userInvitations",
      userId: user?.id
    }
  );
  const suggestions = usePagesOrInfinite(
    {
      ...userSuggestionsParams
    },
    user?.getOrganizationSuggestions,
    {
      keepPreviousData: userSuggestionsSafeValues.keepPreviousData,
      infinite: userSuggestionsSafeValues.infinite,
      enabled: !!userSuggestionsParams
    },
    {
      type: "userSuggestions",
      userId: user?.id
    }
  );
  if (!isClerkLoaded) {
    return {
      isLoaded: false,
      createOrganization: void 0,
      setActive: void 0,
      userMemberships: undefinedPaginatedResource2,
      userInvitations: undefinedPaginatedResource2,
      userSuggestions: undefinedPaginatedResource2
    };
  }
  return {
    isLoaded: isClerkLoaded,
    setActive: clerk.setActive,
    createOrganization: clerk.createOrganization,
    userMemberships: memberships,
    userInvitations: invitations,
    userSuggestions: suggestions
  };
}

// src/react/hooks/useSafeLayoutEffect.tsx
var import_react5 = __toESM(require("react"));
var useSafeLayoutEffect = typeof window !== "undefined" ? import_react5.default.useLayoutEffect : import_react5.default.useEffect;

// src/react/hooks/useSession.ts
var hookName = `useSession`;
var useSession = () => {
  useAssertWrappedByClerkProvider(hookName);
  const session = useSessionContext();
  const clerk = useClerkInstanceContext();
  clerk.telemetry?.record(eventMethodCalled(hookName));
  if (session === void 0) {
    return { isLoaded: false, isSignedIn: void 0, session: void 0 };
  }
  if (session === null) {
    return { isLoaded: true, isSignedIn: false, session: null };
  }
  return { isLoaded: true, isSignedIn: clerk.isSignedIn, session };
};

// src/react/hooks/useSessionList.ts
var hookName2 = "useSessionList";
var useSessionList = () => {
  useAssertWrappedByClerkProvider(hookName2);
  const isomorphicClerk = useClerkInstanceContext();
  const client = useClientContext();
  const clerk = useClerkInstanceContext();
  clerk.telemetry?.record(eventMethodCalled(hookName2));
  if (!client) {
    return { isLoaded: false, sessions: void 0, setActive: void 0 };
  }
  return {
    isLoaded: true,
    sessions: client.sessions,
    setActive: isomorphicClerk.setActive
  };
};

// src/react/hooks/useUser.ts
var hookName3 = "useUser";
function useUser() {
  useAssertWrappedByClerkProvider(hookName3);
  const user = useUserContext();
  const clerk = useClerkInstanceContext();
  clerk.telemetry?.record(eventMethodCalled(hookName3));
  if (user === void 0) {
    return { isLoaded: false, isSignedIn: void 0, user: void 0 };
  }
  if (user === null) {
    return { isLoaded: true, isSignedIn: false, user: null };
  }
  return { isLoaded: true, isSignedIn: true, user };
}

// src/react/hooks/useClerk.ts
var useClerk = () => {
  useAssertWrappedByClerkProvider("useClerk");
  return useClerkInstanceContext();
};

// src/react/hooks/useDeepEqualMemo.ts
var import_dequal = require("dequal");
var import_react6 = __toESM(require("react"));
var useDeepEqualMemoize = (value) => {
  const ref = import_react6.default.useRef(value);
  if (!(0, import_dequal.dequal)(value, ref.current)) {
    ref.current = value;
  }
  return import_react6.default.useMemo(() => ref.current, [ref.current]);
};
var useDeepEqualMemo = (factory, dependencyArray) => {
  return import_react6.default.useMemo(factory, useDeepEqualMemoize(dependencyArray));
};
var isDeeplyEqual = import_dequal.dequal;

// src/react/hooks/useReverification.ts
var import_react7 = require("react");

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

// src/authorization-errors.ts
var REVERIFICATION_REASON = "reverification-error";
var reverificationError = (missingConfig) => ({
  clerk_error: {
    type: "forbidden",
    reason: REVERIFICATION_REASON,
    metadata: {
      reverification: missingConfig
    }
  }
});
var isReverificationHint = (result) => {
  return result && typeof result === "object" && "clerk_error" in result && result.clerk_error?.type === "forbidden" && result.clerk_error?.reason === REVERIFICATION_REASON;
};

// src/errors/createErrorTypeGuard.ts
function createErrorTypeGuard(ErrorClass) {
  function typeGuard(error) {
    const target = error ?? this;
    if (!target) {
      throw new TypeError(`${ErrorClass.kind || ErrorClass.name} type guard requires an error object`);
    }
    return target instanceof ErrorClass;
  }
  return typeGuard;
}

// src/errors/clerkApiError.ts
var ClerkAPIError = class {
  static kind = "ClerkApiError";
  code;
  message;
  longMessage;
  meta;
  constructor(json) {
    const parsedError = this.parseJsonError(json);
    this.code = parsedError.code;
    this.message = parsedError.message;
    this.longMessage = parsedError.longMessage;
    this.meta = parsedError.meta;
  }
  parseJsonError(json) {
    return {
      code: json.code,
      message: json.message,
      longMessage: json.long_message,
      meta: {
        paramName: json.meta?.param_name,
        sessionId: json.meta?.session_id,
        emailAddresses: json.meta?.email_addresses,
        identifiers: json.meta?.identifiers,
        zxcvbn: json.meta?.zxcvbn,
        plan: json.meta?.plan,
        isPlanUpgradePossible: json.meta?.is_plan_upgrade_possible
      }
    };
  }
};
var isClerkApiError = createErrorTypeGuard(ClerkAPIError);

// src/errors/clerkError.ts
var __DEV__ = true;
var ClerkError = class _ClerkError extends Error {
  static kind = "ClerkError";
  clerkError = true;
  code;
  longMessage;
  docsUrl;
  cause;
  get name() {
    return this.constructor.name;
  }
  constructor(opts) {
    super(new.target.formatMessage(new.target.kind, opts.message, opts.code, opts.docsUrl), { cause: opts.cause });
    Object.setPrototypeOf(this, _ClerkError.prototype);
    this.code = opts.code;
    this.docsUrl = opts.docsUrl;
    this.longMessage = opts.longMessage;
    this.cause = opts.cause;
  }
  toString() {
    return `[${this.name}]
Message:${this.message}`;
  }
  static formatMessage(name, msg, code, docsUrl) {
    const prefix = "Clerk:";
    const regex = new RegExp(prefix.replace(" ", "\\s*"), "i");
    msg = msg.replace(regex, "");
    msg = `${prefix} ${msg.trim()}

(code="${code}")

`;
    if (__DEV__ && docsUrl) {
      msg += `

Docs: ${docsUrl}`;
    }
    return msg;
  }
};

// src/errors/clerkApiResponseError.ts
var ClerkAPIResponseError = class _ClerkAPIResponseError extends ClerkError {
  static kind = "ClerkAPIResponseError";
  status;
  clerkTraceId;
  retryAfter;
  errors;
  constructor(message, options) {
    const { data: errorsJson, status, clerkTraceId, retryAfter } = options;
    super({ ...options, message, code: "api_response_error" });
    Object.setPrototypeOf(this, _ClerkAPIResponseError.prototype);
    this.status = status;
    this.clerkTraceId = clerkTraceId;
    this.retryAfter = retryAfter;
    this.errors = (errorsJson || []).map((e) => new ClerkAPIError(e));
  }
  toString() {
    let message = `[${this.name}]
Message:${this.message}
Status:${this.status}
Serialized errors: ${this.errors.map(
      (e) => JSON.stringify(e)
    )}`;
    if (this.clerkTraceId) {
      message += `
Clerk Trace ID: ${this.clerkTraceId}`;
    }
    return message;
  }
  // Override formatMessage to keep it unformatted for backward compatibility
  static formatMessage(name, msg, _, __) {
    return msg;
  }
};
var isClerkApiResponseError = createErrorTypeGuard(ClerkAPIResponseError);

// src/errors/errorThrower.ts
var DefaultMessages = Object.freeze({
  InvalidProxyUrlErrorMessage: `The proxyUrl passed to Clerk is invalid. The expected value for proxyUrl is an absolute URL or a relative path with a leading '/'. (key={{url}})`,
  InvalidPublishableKeyErrorMessage: `The publishableKey passed to Clerk is invalid. You can get your Publishable key at https://dashboard.clerk.com/last-active?path=api-keys. (key={{key}})`,
  MissingPublishableKeyErrorMessage: `Missing publishableKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
  MissingSecretKeyErrorMessage: `Missing secretKey. You can get your key at https://dashboard.clerk.com/last-active?path=api-keys.`,
  MissingClerkProvider: `{{source}} can only be used within the <ClerkProvider /> component. Learn more: https://clerk.com/docs/components/clerk-provider`
});

// src/errors/clerkRuntimeError.ts
var ClerkRuntimeError = class _ClerkRuntimeError extends ClerkError {
  static kind = "ClerkRuntimeError";
  /**
   * @deprecated Use `clerkError` property instead. This property is maintained for backward compatibility.
   */
  clerkRuntimeError = true;
  constructor(message, options) {
    super({ ...options, message });
    Object.setPrototypeOf(this, _ClerkRuntimeError.prototype);
  }
};
var isClerkRuntimeError = createErrorTypeGuard(ClerkRuntimeError);

// src/errors/helpers.ts
function isClerkAPIResponseError(err) {
  return err && "clerkError" in err;
}

// src/underscore.ts
function snakeToCamel(str) {
  return str ? str.replace(/([-_][a-z])/g, (match) => match.toUpperCase().replace(/-|_/, "")) : "";
}
function camelToSnake(str) {
  return str ? str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) : "";
}
var createDeepObjectTransformer = (transform) => {
  const deepTransform = (obj) => {
    if (!obj) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((el) => {
        if (typeof el === "object" || Array.isArray(el)) {
          return deepTransform(el);
        }
        return el;
      });
    }
    const copy = { ...obj };
    const keys = Object.keys(copy);
    for (const oldName of keys) {
      const newName = transform(oldName.toString());
      if (newName !== oldName) {
        copy[newName] = copy[oldName];
        delete copy[oldName];
      }
      if (typeof copy[newName] === "object") {
        copy[newName] = deepTransform(copy[newName]);
      }
    }
    return copy;
  };
  return deepTransform;
};
var deepCamelToSnake = createDeepObjectTransformer(camelToSnake);
var deepSnakeToCamel = createDeepObjectTransformer(snakeToCamel);

// src/utils/noop.ts
var noop = (..._args) => {
};

// src/utils/createDeferredPromise.ts
var createDeferredPromise = () => {
  let resolve = noop;
  let reject = noop;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// src/react/hooks/useReverification.ts
var CLERK_API_REVERIFICATION_ERROR_CODE = "session_reverification_required";
async function resolveResult(result) {
  try {
    const r = await result;
    if (r instanceof Response) {
      return r.json();
    }
    return r;
  } catch (e) {
    if (isClerkAPIResponseError(e) && e.errors.find(({ code }) => code === CLERK_API_REVERIFICATION_ERROR_CODE)) {
      return reverificationError();
    }
    throw e;
  }
}
function createReverificationHandler(params) {
  function assertReverification(fetcher) {
    return async (...args) => {
      let result = await resolveResult(fetcher(...args));
      if (isReverificationHint(result)) {
        const resolvers = createDeferredPromise();
        const isValidMetadata = validateReverificationConfig(result.clerk_error.metadata?.reverification);
        const level = isValidMetadata ? isValidMetadata().level : void 0;
        const cancel = () => {
          resolvers.reject(
            new ClerkRuntimeError("User cancelled attempted verification", {
              code: "reverification_cancelled"
            })
          );
        };
        const complete = () => {
          resolvers.resolve(true);
        };
        if (params.onNeedsReverification === void 0) {
          params.openUIComponent?.({
            level,
            afterVerification: complete,
            afterVerificationCancelled: cancel
          });
        } else {
          params.onNeedsReverification({
            cancel,
            complete,
            level
          });
        }
        await resolvers.promise;
        result = await resolveResult(fetcher(...args));
      }
      return result;
    };
  }
  return assertReverification;
}
var useReverification = (fetcher, options) => {
  const { __internal_openReverification, telemetry } = useClerk();
  const fetcherRef = (0, import_react7.useRef)(fetcher);
  const optionsRef = (0, import_react7.useRef)(options);
  telemetry?.record(
    eventMethodCalled("useReverification", {
      onNeedsReverification: Boolean(options?.onNeedsReverification)
    })
  );
  useSafeLayoutEffect(() => {
    fetcherRef.current = fetcher;
    optionsRef.current = options;
  });
  return (0, import_react7.useCallback)(
    (...args) => {
      const handler = createReverificationHandler({
        openUIComponent: __internal_openReverification,
        telemetry,
        ...optionsRef.current
      })(fetcherRef.current);
      return handler(...args);
    },
    [__internal_openReverification, telemetry]
  );
};

// src/react/hooks/createBillingPaginatedHook.tsx
function createBillingPaginatedHook({
  hookName: hookName5,
  resourceType,
  useFetcher,
  options
}) {
  return function useBillingHook(params) {
    const { for: _for, ...paginationParams } = params || {};
    useAssertWrappedByClerkProvider(hookName5);
    const fetchFn = useFetcher(_for || "user");
    const safeValues = useWithSafeValues(paginationParams, {
      initialPage: 1,
      pageSize: 10,
      keepPreviousData: false,
      infinite: false,
      __experimental_mode: void 0
    });
    const clerk = useClerkInstanceContext();
    const environment = clerk.__unstable__environment;
    const user = useUserContext();
    const { organization } = useOrganizationContext();
    clerk.telemetry?.record(eventMethodCalled(hookName5));
    const hookParams = typeof paginationParams === "undefined" ? void 0 : {
      initialPage: safeValues.initialPage,
      pageSize: safeValues.pageSize,
      ...options?.unauthenticated ? {} : _for === "organization" ? { orgId: organization?.id } : {}
    };
    const isOrganization = _for === "organization";
    const billingEnabled = isOrganization ? environment?.commerceSettings.billing.organization.enabled : environment?.commerceSettings.billing.user.enabled;
    const isEnabled = !!hookParams && clerk.loaded && !!billingEnabled;
    const result = usePagesOrInfinite(
      hookParams || {},
      fetchFn,
      {
        keepPreviousData: safeValues.keepPreviousData,
        infinite: safeValues.infinite,
        enabled: isEnabled,
        ...options?.unauthenticated ? {} : { isSignedIn: Boolean(user) },
        __experimental_mode: safeValues.__experimental_mode
      },
      {
        type: resourceType,
        // userId: user?.id,
        ...options?.unauthenticated ? {} : {
          userId: user?.id,
          ..._for === "organization" ? { orgId: organization?.id } : {}
        }
      }
    );
    return result;
  };
}

// src/react/hooks/useStatements.tsx
var useStatements = createBillingPaginatedHook({
  hookName: "useStatements",
  resourceType: "billing-statements",
  useFetcher: () => {
    const clerk = useClerkInstanceContext();
    if (clerk.loaded) {
      return clerk.billing.getStatements;
    }
    return void 0;
  }
});

// src/react/hooks/usePaymentAttempts.tsx
var usePaymentAttempts = createBillingPaginatedHook({
  hookName: "usePaymentAttempts",
  resourceType: "billing-payment-attempts",
  useFetcher: () => {
    const clerk = useClerkInstanceContext();
    if (clerk.loaded) {
      return clerk.billing.getPaymentAttempts;
    }
    return void 0;
  }
});

// src/react/hooks/usePaymentMethods.tsx
var usePaymentMethods = createBillingPaginatedHook({
  hookName: "usePaymentMethods",
  resourceType: "commerce-payment-methods",
  useFetcher: (resource) => {
    const { organization } = useOrganizationContext();
    const user = useUserContext();
    if (resource === "organization") {
      return organization?.getPaymentMethods;
    }
    return user?.getPaymentMethods;
  }
});

// src/react/hooks/usePlans.tsx
var usePlans = createBillingPaginatedHook({
  hookName: "usePlans",
  resourceType: "billing-plans",
  useFetcher: (_for) => {
    const clerk = useClerkInstanceContext();
    if (!clerk.loaded) {
      return void 0;
    }
    return (params) => clerk.billing.getPlans({ ...params, for: _for });
  },
  options: {
    unauthenticated: true
  }
});

// src/react/hooks/useSubscription.tsx
var import_react8 = require("react");
var hookName4 = "useSubscription";
var useSubscription = (params) => {
  useAssertWrappedByClerkProvider(hookName4);
  const clerk = useClerkInstanceContext();
  const user = useUserContext();
  const { organization } = useOrganizationContext();
  const environment = clerk.__unstable__environment;
  clerk.telemetry?.record(eventMethodCalled(hookName4));
  const isOrganization = params?.for === "organization";
  const billingEnabled = isOrganization ? environment?.commerceSettings.billing.organization.enabled : environment?.commerceSettings.billing.user.enabled;
  const swr = (0, import_swr.default)(
    billingEnabled ? {
      type: "commerce-subscription",
      userId: user?.id,
      args: { orgId: isOrganization ? organization?.id : void 0 }
    } : null,
    ({ args, userId }) => {
      if (userId) {
        return clerk.billing.getSubscription(args);
      }
      return null;
    },
    {
      dedupingInterval: 1e3 * 60,
      keepPreviousData: params?.keepPreviousData
    }
  );
  const revalidate = (0, import_react8.useCallback)(() => swr.mutate(), [swr.mutate]);
  return {
    data: swr.data,
    error: swr.error,
    isLoading: swr.isLoading,
    isFetching: swr.isValidating,
    revalidate
  };
};

// src/react/hooks/useCheckout.ts
var import_react9 = require("react");
var useCheckout = (options) => {
  const contextOptions = useCheckoutContext();
  const { for: forOrganization, planId, planPeriod } = options || contextOptions;
  const clerk = useClerk();
  const { organization } = useOrganization();
  const { isLoaded, user } = useUser();
  if (!isLoaded) {
    throw new Error("Clerk: Ensure that `useCheckout` is inside a component wrapped with `<ClerkLoaded />`.");
  }
  if (!user) {
    throw new Error("Clerk: Ensure that `useCheckout` is inside a component wrapped with `<SignedIn />`.");
  }
  if (forOrganization === "organization" && !organization) {
    throw new Error(
      "Clerk: Ensure your flow checks for an active organization. Retrieve `orgId` from `useAuth()` and confirm it is defined. For SSR, see: https://clerk.com/docs/reference/backend/types/auth-object#how-to-access-the-auth-object"
    );
  }
  const manager = (0, import_react9.useMemo)(
    () => clerk.__experimental_checkout({ planId, planPeriod, for: forOrganization }),
    [user.id, organization?.id, planId, planPeriod, forOrganization]
  );
  const managerProperties = (0, import_react9.useSyncExternalStore)(
    (cb) => manager.subscribe(cb),
    () => manager.getState(),
    () => manager.getState()
  );
  const properties = (0, import_react9.useMemo)(() => {
    if (!managerProperties.checkout) {
      return {
        id: null,
        externalClientSecret: null,
        externalGatewayId: null,
        status: null,
        totals: null,
        isImmediatePlanChange: null,
        planPeriod: null,
        plan: null,
        paymentMethod: null,
        freeTrialEndsAt: null,
        payer: null
      };
    }
    const {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      reload,
      confirm,
      pathRoot,
      // All the above need to be removed from the properties
      ...rest
    } = managerProperties.checkout;
    return rest;
  }, [managerProperties.checkout]);
  const checkout = {
    ...properties,
    getState: manager.getState,
    start: manager.start,
    confirm: manager.confirm,
    clear: manager.clear,
    finalize: manager.finalize,
    isStarting: managerProperties.isStarting,
    isConfirming: managerProperties.isConfirming,
    error: managerProperties.error,
    status: managerProperties.status,
    fetchStatus: managerProperties.fetchStatus
  };
  return {
    checkout
  };
};

// src/react/commerce.tsx
var import_react12 = __toESM(require("react"));
var import_swr2 = __toESM(require("swr"));
var import_mutation = __toESM(require("swr/mutation"));

// src/react/stripe-react/index.tsx
var import_react11 = __toESM(require("react"));

// src/react/stripe-react/utils.ts
var import_react10 = require("react");
var usePrevious = (value) => {
  const ref = (0, import_react10.useRef)(value);
  (0, import_react10.useEffect)(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};
var useAttachEvent = (element, event, cb) => {
  const cbDefined = !!cb;
  const cbRef = (0, import_react10.useRef)(cb);
  (0, import_react10.useEffect)(() => {
    cbRef.current = cb;
  }, [cb]);
  (0, import_react10.useEffect)(() => {
    if (!cbDefined || !element) {
      return () => {
      };
    }
    const decoratedCb = (...args) => {
      if (cbRef.current) {
        cbRef.current(...args);
      }
    };
    element.on(event, decoratedCb);
    return () => {
      element.off(event, decoratedCb);
    };
  }, [cbDefined, event, element, cbRef]);
};

// src/react/stripe-react/index.tsx
var ElementsContext = import_react11.default.createContext(null);
ElementsContext.displayName = "ElementsContext";
var parseElementsContext = (ctx, useCase) => {
  if (!ctx) {
    throw new Error(
      `Could not find Elements context; You need to wrap the part of your app that ${useCase} in an <Elements> provider.`
    );
  }
  return ctx;
};
var Elements = ({
  stripe: rawStripeProp,
  options,
  children
}) => {
  const parsed = import_react11.default.useMemo(() => parseStripeProp(rawStripeProp), [rawStripeProp]);
  const [ctx, setContext] = import_react11.default.useState(() => ({
    stripe: parsed.tag === "sync" ? parsed.stripe : null,
    elements: parsed.tag === "sync" ? parsed.stripe.elements(options) : null
  }));
  import_react11.default.useEffect(() => {
    let isMounted = true;
    const safeSetContext = (stripe) => {
      setContext((ctx2) => {
        if (ctx2.stripe) {
          return ctx2;
        }
        return {
          stripe,
          elements: stripe.elements(options)
        };
      });
    };
    if (parsed.tag === "async" && !ctx.stripe) {
      parsed.stripePromise.then((stripe) => {
        if (stripe && isMounted) {
          safeSetContext(stripe);
        }
      });
    } else if (parsed.tag === "sync" && !ctx.stripe) {
      safeSetContext(parsed.stripe);
    }
    return () => {
      isMounted = false;
    };
  }, [parsed, ctx, options]);
  const prevStripe = usePrevious(rawStripeProp);
  import_react11.default.useEffect(() => {
    if (prevStripe !== null && prevStripe !== rawStripeProp) {
      console.warn("Unsupported prop change on Elements: You cannot change the `stripe` prop after setting it.");
    }
  }, [prevStripe, rawStripeProp]);
  const prevOptions = usePrevious(options);
  import_react11.default.useEffect(() => {
    if (!ctx.elements) {
      return;
    }
    const updates = extractAllowedOptionsUpdates(options, prevOptions, ["clientSecret", "fonts"]);
    if (updates) {
      ctx.elements.update(updates);
    }
  }, [options, prevOptions, ctx.elements]);
  return /* @__PURE__ */ import_react11.default.createElement(ElementsContext.Provider, { value: ctx }, children);
};
var useElementsContextWithUseCase = (useCaseMessage) => {
  const ctx = import_react11.default.useContext(ElementsContext);
  return parseElementsContext(ctx, useCaseMessage);
};
var useElements = () => {
  const { elements } = useElementsContextWithUseCase("calls useElements()");
  return elements;
};
var INVALID_STRIPE_ERROR = "Invalid prop `stripe` supplied to `Elements`. We recommend using the `loadStripe` utility from `@stripe/stripe-js`. See https://stripe.com/docs/stripe-js/react#elements-props-stripe for details.";
var validateStripe = (maybeStripe, errorMsg = INVALID_STRIPE_ERROR) => {
  if (maybeStripe === null || isStripe(maybeStripe)) {
    return maybeStripe;
  }
  throw new Error(errorMsg);
};
var parseStripeProp = (raw, errorMsg = INVALID_STRIPE_ERROR) => {
  if (isPromise(raw)) {
    return {
      tag: "async",
      stripePromise: Promise.resolve(raw).then((result) => validateStripe(result, errorMsg))
    };
  }
  const stripe = validateStripe(raw, errorMsg);
  if (stripe === null) {
    return { tag: "empty" };
  }
  return { tag: "sync", stripe };
};
var isUnknownObject = (raw) => {
  return raw !== null && typeof raw === "object";
};
var isPromise = (raw) => {
  return isUnknownObject(raw) && typeof raw.then === "function";
};
var isStripe = (raw) => {
  return isUnknownObject(raw) && typeof raw.elements === "function" && typeof raw.createToken === "function" && typeof raw.createPaymentMethod === "function" && typeof raw.confirmCardPayment === "function";
};
var extractAllowedOptionsUpdates = (options, prevOptions, immutableKeys) => {
  if (!isUnknownObject(options)) {
    return null;
  }
  return Object.keys(options).reduce((newOptions, key) => {
    const isUpdated = !isUnknownObject(prevOptions) || !isEqual(options[key], prevOptions[key]);
    if (immutableKeys.includes(key)) {
      if (isUpdated) {
        console.warn(`Unsupported prop change: options.${key} is not a mutable property.`);
      }
      return newOptions;
    }
    if (!isUpdated) {
      return newOptions;
    }
    return { ...newOptions || {}, [key]: options[key] };
  }, null);
};
var PLAIN_OBJECT_STR = "[object Object]";
var isEqual = (left, right) => {
  if (!isUnknownObject(left) || !isUnknownObject(right)) {
    return left === right;
  }
  const leftArray = Array.isArray(left);
  const rightArray = Array.isArray(right);
  if (leftArray !== rightArray) {
    return false;
  }
  const leftPlainObject = Object.prototype.toString.call(left) === PLAIN_OBJECT_STR;
  const rightPlainObject = Object.prototype.toString.call(right) === PLAIN_OBJECT_STR;
  if (leftPlainObject !== rightPlainObject) {
    return false;
  }
  if (!leftPlainObject && !leftArray) {
    return left === right;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  const keySet = {};
  for (let i = 0; i < leftKeys.length; i += 1) {
    keySet[leftKeys[i]] = true;
  }
  for (let i = 0; i < rightKeys.length; i += 1) {
    keySet[rightKeys[i]] = true;
  }
  const allKeys = Object.keys(keySet);
  if (allKeys.length !== leftKeys.length) {
    return false;
  }
  const l = left;
  const r = right;
  const pred = (key) => {
    return isEqual(l[key], r[key]);
  };
  return allKeys.every(pred);
};
var useStripe = () => {
  const { stripe } = useElementsOrCheckoutSdkContextWithUseCase("calls useStripe()");
  return stripe;
};
var useElementsOrCheckoutSdkContextWithUseCase = (useCaseString) => {
  const elementsContext = import_react11.default.useContext(ElementsContext);
  return parseElementsContext(elementsContext, useCaseString);
};
var capitalized = (str) => str.charAt(0).toUpperCase() + str.slice(1);
var createElementComponent = (type, isServer2) => {
  const displayName = `${capitalized(type)}Element`;
  const ClientElement = ({
    id,
    className,
    fallback,
    options = {},
    onBlur,
    onFocus,
    onReady,
    onChange,
    onEscape,
    onClick,
    onLoadError,
    onLoaderStart,
    onNetworksChange,
    onConfirm,
    onCancel,
    onShippingAddressChange,
    onShippingRateChange
  }) => {
    const ctx = useElementsOrCheckoutSdkContextWithUseCase(`mounts <${displayName}>`);
    const elements = "elements" in ctx ? ctx.elements : null;
    const [element, setElement] = import_react11.default.useState(null);
    const elementRef = import_react11.default.useRef(null);
    const domNode = import_react11.default.useRef(null);
    const [isReady, setReady] = (0, import_react11.useState)(false);
    useAttachEvent(element, "blur", onBlur);
    useAttachEvent(element, "focus", onFocus);
    useAttachEvent(element, "escape", onEscape);
    useAttachEvent(element, "click", onClick);
    useAttachEvent(element, "loaderror", onLoadError);
    useAttachEvent(element, "loaderstart", onLoaderStart);
    useAttachEvent(element, "networkschange", onNetworksChange);
    useAttachEvent(element, "confirm", onConfirm);
    useAttachEvent(element, "cancel", onCancel);
    useAttachEvent(element, "shippingaddresschange", onShippingAddressChange);
    useAttachEvent(element, "shippingratechange", onShippingRateChange);
    useAttachEvent(element, "change", onChange);
    let readyCallback;
    if (onReady) {
      readyCallback = () => {
        setReady(true);
        onReady(element);
      };
    }
    useAttachEvent(element, "ready", readyCallback);
    import_react11.default.useLayoutEffect(() => {
      if (elementRef.current === null && domNode.current !== null && elements) {
        let newElement = null;
        if (elements) {
          newElement = elements.create(type, options);
        }
        elementRef.current = newElement;
        setElement(newElement);
        if (newElement) {
          newElement.mount(domNode.current);
        }
      }
    }, [elements, options]);
    const prevOptions = usePrevious(options);
    import_react11.default.useEffect(() => {
      if (!elementRef.current) {
        return;
      }
      const updates = extractAllowedOptionsUpdates(options, prevOptions, ["paymentRequest"]);
      if (updates && "update" in elementRef.current) {
        elementRef.current.update(updates);
      }
    }, [options, prevOptions]);
    import_react11.default.useLayoutEffect(() => {
      return () => {
        if (elementRef.current && typeof elementRef.current.destroy === "function") {
          try {
            elementRef.current.destroy();
            elementRef.current = null;
          } catch {
          }
        }
      };
    }, []);
    return /* @__PURE__ */ import_react11.default.createElement(import_react11.default.Fragment, null, !isReady && fallback, /* @__PURE__ */ import_react11.default.createElement(
      "div",
      {
        id,
        style: {
          height: isReady ? "unset" : "0px",
          visibility: isReady ? "visible" : "hidden"
        },
        className,
        ref: domNode
      }
    ));
  };
  const ServerElement = (props) => {
    useElementsOrCheckoutSdkContextWithUseCase(`mounts <${displayName}>`);
    const { id, className } = props;
    return /* @__PURE__ */ import_react11.default.createElement(
      "div",
      {
        id,
        className
      }
    );
  };
  const Element = isServer2 ? ServerElement : ClientElement;
  Element.displayName = displayName;
  Element.__elementType = type;
  return Element;
};
var isServer = typeof window === "undefined";
var PaymentElement = createElementComponent("payment", isServer);

// src/react/commerce.tsx
var [StripeLibsContext, useStripeLibsContext] = createContextAndHook("StripeLibsContext");
var StripeLibsProvider = ({ children }) => {
  const clerk = useClerk();
  const { data: stripeClerkLibs } = (0, import_swr2.default)(
    "clerk-stripe-sdk",
    async () => {
      const loadStripe = await clerk.__internal_loadStripeJs();
      return { loadStripe };
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: Infinity
    }
  );
  return /* @__PURE__ */ import_react12.default.createElement(
    StripeLibsContext.Provider,
    {
      value: {
        value: stripeClerkLibs || null
      }
    },
    children
  );
};
var useInternalEnvironment = () => {
  const clerk = useClerk();
  return clerk.__unstable__environment;
};
var usePaymentSourceUtils = (forResource = "user") => {
  const { organization } = useOrganization();
  const { user } = useUser();
  const resource = forResource === "organization" ? organization : user;
  const stripeClerkLibs = useStripeLibsContext();
  const { data: initializedPaymentMethod, trigger: initializePaymentMethod } = (0, import_mutation.default)(
    {
      key: "billing-payment-method-initialize",
      resourceId: resource?.id
    },
    () => {
      return resource?.initializePaymentMethod({
        gateway: "stripe"
      });
    }
  );
  const environment = useInternalEnvironment();
  (0, import_react12.useEffect)(() => {
    if (!resource?.id) {
      return;
    }
    initializePaymentMethod().catch(() => {
    });
  }, [resource?.id]);
  const externalGatewayId = initializedPaymentMethod?.externalGatewayId;
  const externalClientSecret = initializedPaymentMethod?.externalClientSecret;
  const paymentMethodOrder = initializedPaymentMethod?.paymentMethodOrder;
  const stripePublishableKey = environment?.commerceSettings.billing.stripePublishableKey;
  const { data: stripe } = (0, import_swr2.default)(
    stripeClerkLibs && externalGatewayId && stripePublishableKey ? { key: "stripe-sdk", externalGatewayId, stripePublishableKey } : null,
    ({ stripePublishableKey: stripePublishableKey2, externalGatewayId: externalGatewayId2 }) => {
      return stripeClerkLibs?.loadStripe(stripePublishableKey2, {
        stripeAccount: externalGatewayId2
      });
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 1e3 * 60
      // 1 minute
    }
  );
  return {
    stripe,
    initializePaymentMethod,
    externalClientSecret,
    paymentMethodOrder
  };
};
var [PaymentElementContext, usePaymentElementContext] = createContextAndHook("PaymentElementContext");
var [StripeUtilsContext, useStripeUtilsContext] = createContextAndHook("StripeUtilsContext");
var ValidateStripeUtils = ({ children }) => {
  const stripe = useStripe();
  const elements = useElements();
  return /* @__PURE__ */ import_react12.default.createElement(StripeUtilsContext.Provider, { value: { value: { stripe, elements } } }, children);
};
var DummyStripeUtils = ({ children }) => {
  return /* @__PURE__ */ import_react12.default.createElement(StripeUtilsContext.Provider, { value: { value: {} } }, children);
};
var PropsProvider = ({ children, ...props }) => {
  const utils = usePaymentSourceUtils(props.for);
  const [isPaymentElementReady, setIsPaymentElementReady] = (0, import_react12.useState)(false);
  return /* @__PURE__ */ import_react12.default.createElement(
    PaymentElementContext.Provider,
    {
      value: {
        value: {
          ...props,
          ...utils,
          setIsPaymentElementReady,
          isPaymentElementReady
        }
      }
    },
    children
  );
};
var PaymentElementProvider = ({ children, ...props }) => {
  return /* @__PURE__ */ import_react12.default.createElement(StripeLibsProvider, null, /* @__PURE__ */ import_react12.default.createElement(PropsProvider, { ...props }, /* @__PURE__ */ import_react12.default.createElement(PaymentElementInternalRoot, null, children)));
};
var PaymentElementInternalRoot = (props) => {
  const { stripe, externalClientSecret, stripeAppearance } = usePaymentElementContext();
  if (stripe && externalClientSecret) {
    return /* @__PURE__ */ import_react12.default.createElement(
      Elements,
      {
        key: externalClientSecret,
        stripe,
        options: {
          loader: "never",
          clientSecret: externalClientSecret,
          appearance: {
            variables: stripeAppearance
          }
        }
      },
      /* @__PURE__ */ import_react12.default.createElement(ValidateStripeUtils, null, props.children)
    );
  }
  return /* @__PURE__ */ import_react12.default.createElement(DummyStripeUtils, null, props.children);
};
var PaymentElement2 = ({ fallback }) => {
  const {
    setIsPaymentElementReady,
    paymentMethodOrder,
    checkout,
    stripe,
    externalClientSecret,
    paymentDescription,
    for: _for
  } = usePaymentElementContext();
  const environment = useInternalEnvironment();
  const applePay = (0, import_react12.useMemo)(() => {
    if (!checkout || !checkout.totals || !checkout.plan) {
      return void 0;
    }
    return {
      recurringPaymentRequest: {
        paymentDescription: paymentDescription || "",
        managementURL: _for === "organization" ? environment?.displayConfig.organizationProfileUrl || "" : environment?.displayConfig.userProfileUrl || "",
        regularBilling: {
          amount: checkout.totals.totalDueNow?.amount || checkout.totals.grandTotal.amount,
          label: checkout.plan.name,
          recurringPaymentIntervalUnit: checkout.planPeriod === "annual" ? "year" : "month"
        }
      }
    };
  }, [checkout, paymentDescription, _for, environment]);
  const options = (0, import_react12.useMemo)(() => {
    return {
      layout: {
        type: "tabs",
        defaultCollapsed: false
      },
      paymentMethodOrder,
      applePay
    };
  }, [applePay, paymentMethodOrder]);
  const onReady = (0, import_react12.useCallback)(() => {
    setIsPaymentElementReady(true);
  }, [setIsPaymentElementReady]);
  if (!stripe || !externalClientSecret) {
    return /* @__PURE__ */ import_react12.default.createElement(import_react12.default.Fragment, null, fallback);
  }
  return /* @__PURE__ */ import_react12.default.createElement(
    PaymentElement,
    {
      fallback,
      onReady,
      options
    }
  );
};
var throwLibsMissingError = () => {
  throw new Error(
    "Clerk: Unable to submit, Stripe libraries are not yet loaded. Be sure to check `isFormReady` before calling `submit`."
  );
};
var usePaymentElement = () => {
  const { isPaymentElementReady, initializePaymentMethod } = usePaymentElementContext();
  const { stripe, elements } = useStripeUtilsContext();
  const { externalClientSecret } = usePaymentElementContext();
  const submit = (0, import_react12.useCallback)(async () => {
    if (!stripe || !elements) {
      return throwLibsMissingError();
    }
    const { setupIntent, error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href
      },
      redirect: "if_required"
    });
    if (error) {
      return {
        data: null,
        error: {
          gateway: "stripe",
          error: {
            code: error.code,
            message: error.message,
            type: error.type
          }
        }
      };
    }
    return {
      data: { gateway: "stripe", paymentToken: setupIntent.payment_method },
      error: null
    };
  }, [stripe, elements]);
  const reset = (0, import_react12.useCallback)(async () => {
    if (!stripe || !elements) {
      return throwLibsMissingError();
    }
    await initializePaymentMethod();
  }, [stripe, elements, initializePaymentMethod]);
  const isProviderReady = Boolean(stripe && externalClientSecret);
  if (!isProviderReady) {
    return {
      submit: throwLibsMissingError,
      reset: throwLibsMissingError,
      isFormReady: false,
      provider: void 0,
      isProviderReady: false
    };
  }
  return {
    submit,
    reset,
    isFormReady: isPaymentElementReady,
    provider: {
      name: "stripe"
    },
    isProviderReady
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ClerkInstanceContext,
  ClientContext,
  OptionsContext,
  OrganizationProvider,
  SessionContext,
  UserContext,
  __experimental_CheckoutProvider,
  __experimental_PaymentElement,
  __experimental_PaymentElementProvider,
  __experimental_useCheckout,
  __experimental_usePaymentAttempts,
  __experimental_usePaymentElement,
  __experimental_usePaymentMethods,
  __experimental_usePlans,
  __experimental_useStatements,
  __experimental_useSubscription,
  assertContextExists,
  createContextAndHook,
  isDeeplyEqual,
  useAssertWrappedByClerkProvider,
  useClerk,
  useClerkInstanceContext,
  useClientContext,
  useDeepEqualMemo,
  useOptionsContext,
  useOrganization,
  useOrganizationContext,
  useOrganizationList,
  useReverification,
  useSafeLayoutEffect,
  useSession,
  useSessionContext,
  useSessionList,
  useUser,
  useUserContext
});
//# sourceMappingURL=index.js.map