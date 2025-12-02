import {
  eventMethodCalled
} from "../chunk-RUA3ZE6A.mjs";
import {
  getCurrentOrganizationMembership
} from "../chunk-IBXKDGSZ.mjs";
import {
  createDeferredPromise
} from "../chunk-7QJ2QTJL.mjs";
import "../chunk-GGFRMWFO.mjs";
import "../chunk-7FNX7RWY.mjs";
import {
  ClerkRuntimeError,
  isClerkAPIResponseError
} from "../chunk-AXHU6TXE.mjs";
import "../chunk-IV7BOO4U.mjs";
import "../chunk-TETGTEI2.mjs";
import "../chunk-KOH7GTJO.mjs";
import "../chunk-I6MTSTOF.mjs";
import {
  isReverificationHint,
  reverificationError
} from "../chunk-43A5F2IE.mjs";
import {
  validateReverificationConfig
} from "../chunk-3CN5LOSN.mjs";
import {
  __export,
  __reExport
} from "../chunk-IEP6GGEX.mjs";

// src/react/hooks/createContextAndHook.ts
import React from "react";
function assertContextExists(contextVal, msgOrCtx) {
  if (!contextVal) {
    throw typeof msgOrCtx === "string" ? new Error(msgOrCtx) : new Error(`${msgOrCtx.displayName} not found`);
  }
}
var createContextAndHook = (displayName, options) => {
  const { assertCtxFn = assertContextExists } = options || {};
  const Ctx = React.createContext(void 0);
  Ctx.displayName = displayName;
  const useCtx = () => {
    const ctx = React.useContext(Ctx);
    assertCtxFn(ctx, `${displayName} not found`);
    return ctx.value;
  };
  const useCtxWithoutGuarantee = () => {
    const ctx = React.useContext(Ctx);
    return ctx ? ctx.value : {};
  };
  return [Ctx, useCtx, useCtxWithoutGuarantee];
};

// src/react/contexts.tsx
import React2 from "react";

// src/react/clerk-swr.ts
var clerk_swr_exports = {};
__export(clerk_swr_exports, {
  useSWR: () => default2,
  useSWRInfinite: () => default3
});
__reExport(clerk_swr_exports, swr_star);
import * as swr_star from "swr";
import { default as default2 } from "swr";
import { default as default3 } from "swr/infinite";

// src/react/contexts.tsx
var [ClerkInstanceContext, useClerkInstanceContext] = createContextAndHook("ClerkInstanceContext");
var [UserContext, useUserContext] = createContextAndHook("UserContext");
var [ClientContext, useClientContext] = createContextAndHook("ClientContext");
var [SessionContext, useSessionContext] = createContextAndHook(
  "SessionContext"
);
var OptionsContext = React2.createContext({});
var [CheckoutContext, useCheckoutContext] = createContextAndHook("CheckoutContext");
var __experimental_CheckoutProvider = ({ children, ...rest }) => {
  return /* @__PURE__ */ React2.createElement(CheckoutContext.Provider, { value: { value: rest } }, children);
};
function useOptionsContext() {
  const context = React2.useContext(OptionsContext);
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
  return /* @__PURE__ */ React2.createElement(clerk_swr_exports.SWRConfig, { value: swrConfig }, /* @__PURE__ */ React2.createElement(
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
  const ctx = React2.useContext(ClerkInstanceContext);
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
import { useCallback, useMemo, useRef as useRef2, useState } from "react";

// src/react/hooks/usePreviousValue.ts
import { useRef } from "react";
function usePreviousValue(value) {
  const currentRef = useRef(value);
  const previousRef = useRef(null);
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
  const initialPageRef = useRef2(
    shouldUseDefaults ? defaultValues.initialPage : params?.initialPage ?? defaultValues.initialPage
  );
  const pageSizeRef = useRef2(shouldUseDefaults ? defaultValues.pageSize : params?.pageSize ?? defaultValues.pageSize);
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
  const [paginatedPage, setPaginatedPage] = useState(params.initialPage ?? 1);
  const initialPageRef = useRef2(params.initialPage ?? 1);
  const pageSizeRef = useRef2(params.pageSize ?? 10);
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
  } = default2(swrKey, swrFetcher, { keepPreviousData, ...cachingSWROptions });
  const {
    data: swrInfiniteData,
    isLoading: swrInfiniteIsLoading,
    isValidating: swrInfiniteIsValidating,
    error: swrInfiniteError,
    size,
    setSize,
    mutate: swrInfiniteMutate
  } = default3(
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
  const page = useMemo(() => {
    if (triggerInfinite) {
      return size;
    }
    return paginatedPage;
  }, [triggerInfinite, size, paginatedPage]);
  const fetchPage = useCallback(
    (numberOrgFn) => {
      if (triggerInfinite) {
        void setSize(numberOrgFn);
        return;
      }
      return setPaginatedPage(numberOrgFn);
    },
    [setSize, triggerInfinite]
  );
  const data = useMemo(() => {
    if (triggerInfinite) {
      return swrInfiniteData?.map((a) => a?.data).flat() ?? [];
    }
    return swrData?.data ?? [];
  }, [triggerInfinite, swrData, swrInfiniteData]);
  const count = useMemo(() => {
    if (triggerInfinite) {
      return swrInfiniteData?.[swrInfiniteData?.length - 1]?.total_count || 0;
    }
    return swrData?.total_count ?? 0;
  }, [triggerInfinite, swrData, swrInfiniteData]);
  const isLoading = triggerInfinite ? swrInfiniteIsLoading : swrIsLoading;
  const isFetching = triggerInfinite ? swrInfiniteIsValidating : swrIsValidating;
  const error = (triggerInfinite ? swrInfiniteError : swrError) ?? null;
  const isError = !!error;
  const fetchNext = useCallback(() => {
    fetchPage((n) => Math.max(0, n + 1));
  }, [fetchPage]);
  const fetchPrevious = useCallback(() => {
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
import React3 from "react";
var useSafeLayoutEffect = typeof window !== "undefined" ? React3.useLayoutEffect : React3.useEffect;

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
import { dequal as deepEqual } from "dequal";
import React4 from "react";
var useDeepEqualMemoize = (value) => {
  const ref = React4.useRef(value);
  if (!deepEqual(value, ref.current)) {
    ref.current = value;
  }
  return React4.useMemo(() => ref.current, [ref.current]);
};
var useDeepEqualMemo = (factory, dependencyArray) => {
  return React4.useMemo(factory, useDeepEqualMemoize(dependencyArray));
};
var isDeeplyEqual = deepEqual;

// src/react/hooks/useReverification.ts
import { useCallback as useCallback2, useRef as useRef3 } from "react";
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
  const fetcherRef = useRef3(fetcher);
  const optionsRef = useRef3(options);
  telemetry?.record(
    eventMethodCalled("useReverification", {
      onNeedsReverification: Boolean(options?.onNeedsReverification)
    })
  );
  useSafeLayoutEffect(() => {
    fetcherRef.current = fetcher;
    optionsRef.current = options;
  });
  return useCallback2(
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
import { useCallback as useCallback3 } from "react";
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
  const swr = default2(
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
  const revalidate = useCallback3(() => swr.mutate(), [swr.mutate]);
  return {
    data: swr.data,
    error: swr.error,
    isLoading: swr.isLoading,
    isFetching: swr.isValidating,
    revalidate
  };
};

// src/react/hooks/useCheckout.ts
import { useMemo as useMemo2, useSyncExternalStore } from "react";
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
  const manager = useMemo2(
    () => clerk.__experimental_checkout({ planId, planPeriod, for: forOrganization }),
    [user.id, organization?.id, planId, planPeriod, forOrganization]
  );
  const managerProperties = useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getState(),
    () => manager.getState()
  );
  const properties = useMemo2(() => {
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
import React6, { useCallback as useCallback4, useEffect as useEffect2, useMemo as useMemo3, useState as useState3 } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

// src/react/stripe-react/index.tsx
import React5, { useState as useState2 } from "react";

// src/react/stripe-react/utils.ts
import { useEffect, useRef as useRef4 } from "react";
var usePrevious = (value) => {
  const ref = useRef4(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
};
var useAttachEvent = (element, event, cb) => {
  const cbDefined = !!cb;
  const cbRef = useRef4(cb);
  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);
  useEffect(() => {
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
var ElementsContext = React5.createContext(null);
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
  const parsed = React5.useMemo(() => parseStripeProp(rawStripeProp), [rawStripeProp]);
  const [ctx, setContext] = React5.useState(() => ({
    stripe: parsed.tag === "sync" ? parsed.stripe : null,
    elements: parsed.tag === "sync" ? parsed.stripe.elements(options) : null
  }));
  React5.useEffect(() => {
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
  React5.useEffect(() => {
    if (prevStripe !== null && prevStripe !== rawStripeProp) {
      console.warn("Unsupported prop change on Elements: You cannot change the `stripe` prop after setting it.");
    }
  }, [prevStripe, rawStripeProp]);
  const prevOptions = usePrevious(options);
  React5.useEffect(() => {
    if (!ctx.elements) {
      return;
    }
    const updates = extractAllowedOptionsUpdates(options, prevOptions, ["clientSecret", "fonts"]);
    if (updates) {
      ctx.elements.update(updates);
    }
  }, [options, prevOptions, ctx.elements]);
  return /* @__PURE__ */ React5.createElement(ElementsContext.Provider, { value: ctx }, children);
};
var useElementsContextWithUseCase = (useCaseMessage) => {
  const ctx = React5.useContext(ElementsContext);
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
  const elementsContext = React5.useContext(ElementsContext);
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
    const [element, setElement] = React5.useState(null);
    const elementRef = React5.useRef(null);
    const domNode = React5.useRef(null);
    const [isReady, setReady] = useState2(false);
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
    React5.useLayoutEffect(() => {
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
    React5.useEffect(() => {
      if (!elementRef.current) {
        return;
      }
      const updates = extractAllowedOptionsUpdates(options, prevOptions, ["paymentRequest"]);
      if (updates && "update" in elementRef.current) {
        elementRef.current.update(updates);
      }
    }, [options, prevOptions]);
    React5.useLayoutEffect(() => {
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
    return /* @__PURE__ */ React5.createElement(React5.Fragment, null, !isReady && fallback, /* @__PURE__ */ React5.createElement(
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
    return /* @__PURE__ */ React5.createElement(
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
  const { data: stripeClerkLibs } = useSWR(
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
  return /* @__PURE__ */ React6.createElement(
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
  const { data: initializedPaymentMethod, trigger: initializePaymentMethod } = useSWRMutation(
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
  useEffect2(() => {
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
  const { data: stripe } = useSWR(
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
  return /* @__PURE__ */ React6.createElement(StripeUtilsContext.Provider, { value: { value: { stripe, elements } } }, children);
};
var DummyStripeUtils = ({ children }) => {
  return /* @__PURE__ */ React6.createElement(StripeUtilsContext.Provider, { value: { value: {} } }, children);
};
var PropsProvider = ({ children, ...props }) => {
  const utils = usePaymentSourceUtils(props.for);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState3(false);
  return /* @__PURE__ */ React6.createElement(
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
  return /* @__PURE__ */ React6.createElement(StripeLibsProvider, null, /* @__PURE__ */ React6.createElement(PropsProvider, { ...props }, /* @__PURE__ */ React6.createElement(PaymentElementInternalRoot, null, children)));
};
var PaymentElementInternalRoot = (props) => {
  const { stripe, externalClientSecret, stripeAppearance } = usePaymentElementContext();
  if (stripe && externalClientSecret) {
    return /* @__PURE__ */ React6.createElement(
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
      /* @__PURE__ */ React6.createElement(ValidateStripeUtils, null, props.children)
    );
  }
  return /* @__PURE__ */ React6.createElement(DummyStripeUtils, null, props.children);
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
  const applePay = useMemo3(() => {
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
  const options = useMemo3(() => {
    return {
      layout: {
        type: "tabs",
        defaultCollapsed: false
      },
      paymentMethodOrder,
      applePay
    };
  }, [applePay, paymentMethodOrder]);
  const onReady = useCallback4(() => {
    setIsPaymentElementReady(true);
  }, [setIsPaymentElementReady]);
  if (!stripe || !externalClientSecret) {
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, fallback);
  }
  return /* @__PURE__ */ React6.createElement(
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
  const submit = useCallback4(async () => {
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
  const reset = useCallback4(async () => {
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
export {
  ClerkInstanceContext,
  ClientContext,
  OptionsContext,
  OrganizationProvider,
  SessionContext,
  UserContext,
  __experimental_CheckoutProvider,
  PaymentElement2 as __experimental_PaymentElement,
  PaymentElementProvider as __experimental_PaymentElementProvider,
  useCheckout as __experimental_useCheckout,
  usePaymentAttempts as __experimental_usePaymentAttempts,
  usePaymentElement as __experimental_usePaymentElement,
  usePaymentMethods as __experimental_usePaymentMethods,
  usePlans as __experimental_usePlans,
  useStatements as __experimental_useStatements,
  useSubscription as __experimental_useSubscription,
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
};
//# sourceMappingURL=index.mjs.map