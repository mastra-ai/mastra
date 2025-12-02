import React, { PropsWithChildren, ReactNode } from 'react';
import * as _clerk_types from '@clerk/types';
import { ClerkPaginatedResponse, GetDomainsParams, GetMembershipRequestParams, GetMembersParams, GetInvitationsParams, OrganizationDomainResource, OrganizationMembershipRequestResource, OrganizationMembershipResource, OrganizationInvitationResource, OrganizationResource, GetUserOrganizationMembershipParams, GetUserOrganizationInvitationsParams, GetUserOrganizationSuggestionsParams, UserOrganizationInvitationResource, OrganizationSuggestionResource, CreateOrganizationParams, SetActive, UseSessionReturn, UseSessionListReturn, UseUserReturn, LoadedClerk, SessionVerificationLevel, BillingStatementResource, BillingPaymentResource, BillingPaymentMethodResource, BillingPlanResource, ForPayerType, ClientResource, ClerkOptions, SignedInSessionResource, UserResource, BillingSubscriptionPlanPeriod, __experimental_CheckoutCacheState, BillingCheckoutResource, __experimental_CheckoutInstance, SetActiveNavigate } from '@clerk/types';
import { a as ClerkAPIResponseError } from '../clerkApiResponseError-CpTaa-eQ.mjs';
import { dequal } from 'dequal';

/**
 * Assert that the context value exists, otherwise throw an error.
 *
 * @internal
 */
declare function assertContextExists(contextVal: unknown, msgOrCtx: string | React.Context<any>): asserts contextVal;
type Options = {
    assertCtxFn?: (v: unknown, msg: string) => void;
};
type ContextOf<T> = React.Context<{
    value: T;
} | undefined>;
type UseCtxFn<T> = () => T;
/**
 * Create and return a Context and two hooks that return the context value.
 * The Context type is derived from the type passed in by the user.
 *
 * The first hook returned guarantees that the context exists so the returned value is always `CtxValue`
 * The second hook makes no guarantees, so the returned value can be `CtxValue | undefined`
 *
 * @internal
 */
declare const createContextAndHook: <CtxVal>(displayName: string, options?: Options) => [ContextOf<CtxVal>, UseCtxFn<CtxVal>, UseCtxFn<CtxVal | Partial<CtxVal>>];

type ValueOrSetter<T = unknown> = (size: T | ((_size: T) => T)) => void;
type CacheSetter<CData = any> = (data?: CData | ((currentData?: CData) => Promise<undefined | CData> | undefined | CData)) => Promise<CData | undefined>;
/**
 * @interface
 */
type PaginatedResources<T = unknown, Infinite = false> = {
    /**
     * An array that contains the fetched data. For example, for the `memberships` attribute, data will be an array of [`OrganizationMembership`](https://clerk.com/docs/reference/javascript/types/organization-membership) objects.
     */
    data: T[];
    /**
     * The total count of data that exist remotely.
     */
    count: number;
    /**
     * Clerk's API response error object.
     */
    error: ClerkAPIResponseError | null;
    /**
     * A boolean that is `true` if there is an ongoing request and there is no fetched data.
     */
    isLoading: boolean;
    /**
     * A boolean that is `true` if there is an ongoing request or a revalidation.
     */
    isFetching: boolean;
    /**
     * A boolean that indicates the request failed.
     */
    isError: boolean;
    /**
     * The current page.
     */
    page: number;
    /**
     * The total amount of pages. It is calculated based on `count`, `initialPage`, and `pageSize`.
     */
    pageCount: number;
    /**
     * A function that triggers a specific page to be loaded.
     */
    fetchPage: ValueOrSetter<number>;
    /**
     *
     * A function that triggers the previous page to be loaded. This is the same as `fetchPage(page => Math.max(0, page - 1))`.
     */
    fetchPrevious: () => void;
    /**
     * A function that triggers the next page to be loaded. This is the same as `fetchPage(page => Math.min(pageCount, page + 1))`.
     */
    fetchNext: () => void;
    /**
     * A boolean that indicates if there are available pages to be fetched.
     */
    hasNextPage: boolean;
    /**
     * A boolean that indicates if there are available pages to be fetched.
     */
    hasPreviousPage: boolean;
    /**
     * A function that triggers a revalidation of the current page.
     */
    revalidate: () => Promise<void>;
    /**
     * A function that allows you to set the data manually.
     */
    setData: Infinite extends true ? CacheSetter<(ClerkPaginatedResponse<T> | undefined)[]> : CacheSetter<ClerkPaginatedResponse<T> | undefined>;
};
type PaginatedResourcesWithDefault<T> = {
    [K in keyof PaginatedResources<T>]: PaginatedResources<T>[K] extends boolean ? false : undefined;
};
/**
 * @inline
 */
type PaginatedHookConfig<T> = T & {
    /**
     * If `true`, newly fetched data will be appended to the existing list rather than replacing it. Useful for implementing infinite scroll functionality.
     *
     * @default false
     */
    infinite?: boolean;
    /**
     * If `true`, the previous data will be kept in the cache until new data is fetched.
     *
     * @default false
     */
    keepPreviousData?: boolean;
};
/**
 * @interface
 */
type PagesOrInfiniteOptions = {
    /**
     * A number that specifies which page to fetch. For example, if `initialPage` is set to 10, it will skip the first 9 pages and fetch the 10th page.
     *
     * @default 1
     */
    initialPage?: number;
    /**
     * A number that specifies the maximum number of results to return per page.
     *
     * @default 10
     */
    pageSize?: number;
    /**
     * On `cache` mode, no request will be triggered when the hook is mounted and the data will be fetched from the cache.
     *
     * @default undefined
     *
     * @hidden
     *
     * @experimental
     */
    __experimental_mode?: 'cache';
};

/**
 * @interface
 */
type UseOrganizationParams = {
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     * <ul>
     *  <li>`enrollmentMode`: A string that filters the domains by the provided [enrollment mode](https://clerk.com/docs/guides/organizations/verified-domains#enrollment-mode).</li>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    domains?: true | PaginatedHookConfig<GetDomainsParams>;
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     * <ul>
     *  <li>`status`: A string that filters the membership requests by the provided status.</li>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    membershipRequests?: true | PaginatedHookConfig<GetMembershipRequestParams>;
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     * <ul>
     *  <li>`role`: An array of [`OrganizationCustomRoleKey`](https://clerk.com/docs/reference/javascript/types/organization-custom-role-key).</li>
     *  <li>`query`: A string that filters the memberships by the provided string.</li>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    memberships?: true | PaginatedHookConfig<GetMembersParams>;
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     * <ul>
     *  <li>`status`: A string that filters the invitations by the provided status.</li>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    invitations?: true | PaginatedHookConfig<GetInvitationsParams>;
};
/**
 * @interface
 */
type UseOrganizationReturn<T extends UseOrganizationParams> = {
    /**
     * A boolean that indicates whether Clerk has completed initialization. Initially `false`, becomes `true` once Clerk loads.
     */
    isLoaded: false;
    /**
     * The currently active organization.
     */
    organization: undefined;
    /**
     * The current organization membership.
     */
    membership: undefined;
    /**
     * Includes a paginated list of the organization's domains.
     */
    domains: PaginatedResourcesWithDefault<OrganizationDomainResource>;
    /**
     * Includes a paginated list of the organization's membership requests.
     */
    membershipRequests: PaginatedResourcesWithDefault<OrganizationMembershipRequestResource>;
    /**
     * Includes a paginated list of the organization's memberships.
     */
    memberships: PaginatedResourcesWithDefault<OrganizationMembershipResource>;
    /**
     * Includes a paginated list of the organization's invitations.
     */
    invitations: PaginatedResourcesWithDefault<OrganizationInvitationResource>;
} | {
    isLoaded: true;
    organization: OrganizationResource;
    membership: undefined;
    domains: PaginatedResourcesWithDefault<OrganizationDomainResource>;
    membershipRequests: PaginatedResourcesWithDefault<OrganizationMembershipRequestResource>;
    memberships: PaginatedResourcesWithDefault<OrganizationMembershipResource>;
    invitations: PaginatedResourcesWithDefault<OrganizationInvitationResource>;
} | {
    isLoaded: boolean;
    organization: OrganizationResource | null;
    membership: OrganizationMembershipResource | null | undefined;
    domains: PaginatedResources<OrganizationDomainResource, T['membershipRequests'] extends {
        infinite: true;
    } ? true : false> | null;
    membershipRequests: PaginatedResources<OrganizationMembershipRequestResource, T['membershipRequests'] extends {
        infinite: true;
    } ? true : false> | null;
    memberships: PaginatedResources<OrganizationMembershipResource, T['memberships'] extends {
        infinite: true;
    } ? true : false> | null;
    invitations: PaginatedResources<OrganizationInvitationResource, T['invitations'] extends {
        infinite: true;
    } ? true : false> | null;
};
/**
 * The `useOrganization()` hook retrieves attributes of the currently active organization.
 *
 * @example
 * ### Expand and paginate attributes
 *
 * To keep network usage to a minimum, developers are required to opt-in by specifying which resource they need to fetch and paginate through. By default, the `memberships`, `invitations`, `membershipRequests`, and `domains` attributes are not populated. You must pass `true` or an object with the desired properties to fetch and paginate the data.
 *
 * ```tsx
 * // invitations.data will never be populated.
 * const { invitations } = useOrganization()
 *
 * // Use default values to fetch invitations, such as initialPage = 1 and pageSize = 10
 * const { invitations } = useOrganization({
 *   invitations: true,
 * })
 *
 * // Pass your own values to fetch invitations
 * const { invitations } = useOrganization({
 *   invitations: {
 *     pageSize: 20,
 *     initialPage: 2, // skips the first page
 *   },
 * })
 *
 * // Aggregate pages in order to render an infinite list
 * const { invitations } = useOrganization({
 *   invitations: {
 *     infinite: true,
 *   },
 * })
 * ```
 *
 * @example
 * ### Infinite pagination
 *
 * The following example demonstrates how to use the `infinite` property to fetch and append new data to the existing list. The `memberships` attribute will be populated with the first page of the organization's memberships. When the "Load more" button is clicked, the `fetchNext` helper function will be called to append the next page of memberships to the list.
 *
 * ```tsx
 * import { useOrganization } from '@clerk/clerk-react'
 *
 * export default function MemberList() {
 *   const { memberships } = useOrganization({
 *     memberships: {
 *       infinite: true, // Append new data to the existing list
 *       keepPreviousData: true, // Persist the cached data until the new data has been fetched
 *     },
 *   })
 *
 *   if (!memberships) {
 *     // Handle loading state
 *     return null
 *   }
 *
 *   return (
 *     <div>
 *       <h2>Organization members</h2>
 *       <ul>
 *         {memberships.data?.map((membership) => (
 *           <li key={membership.id}>
 *             {membership.publicUserData.firstName} {membership.publicUserData.lastName} <
 *             {membership.publicUserData.identifier}> :: {membership.role}
 *           </li>
 *         ))}
 *       </ul>
 *
 *       <button
 *         disabled={!memberships.hasNextPage} // Disable the button if there are no more available pages to be fetched
 *         onClick={memberships.fetchNext}
 *       >
 *         Load more
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example
 * ### Simple pagination
 *
 * The following example demonstrates how to use the `fetchPrevious` and `fetchNext` helper functions to paginate through the data. The `memberships` attribute will be populated with the first page of the organization's memberships. When the "Previous page" or "Next page" button is clicked, the `fetchPrevious` or `fetchNext` helper function will be called to fetch the previous or next page of memberships.
 *
 * Notice the difference between this example's pagination and the infinite pagination example above.
 *
 * ```tsx
 * import { useOrganization } from '@clerk/clerk-react'
 *
 * export default function MemberList() {
 *   const { memberships } = useOrganization({
 *     memberships: {
 *       keepPreviousData: true, // Persist the cached data until the new data has been fetched
 *     },
 *   })
 *
 *   if (!memberships) {
 *     // Handle loading state
 *     return null
 *   }
 *
 *   return (
 *     <div>
 *       <h2>Organization members</h2>
 *       <ul>
 *         {memberships.data?.map((membership) => (
 *           <li key={membership.id}>
 *             {membership.publicUserData.firstName} {membership.publicUserData.lastName} <
 *             {membership.publicUserData.identifier}> :: {membership.role}
 *           </li>
 *         ))}
 *       </ul>
 *
 *       <button disabled={!memberships.hasPreviousPage} onClick={memberships.fetchPrevious}>
 *         Previous page
 *       </button>
 *
 *       <button disabled={!memberships.hasNextPage} onClick={memberships.fetchNext}>
 *         Next page
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
declare function useOrganization<T extends UseOrganizationParams>(params?: T): UseOrganizationReturn<T>;

/**
 * @interface
 */
type UseOrganizationListParams = {
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     *
     * <ul>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    userMemberships?: true | PaginatedHookConfig<GetUserOrganizationMembershipParams>;
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     *
     * <ul>
     *  <li>`status`: A string that filters the invitations by the provided status.</li>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    userInvitations?: true | PaginatedHookConfig<GetUserOrganizationInvitationsParams>;
    /**
     * If set to `true`, all default properties will be used.<br />
     * Otherwise, accepts an object with the following optional properties:
     *
     * <ul>
     *  <li>`status`: A string that filters the suggestions by the provided status.</li>
     *  <li>Any of the properties described in [Shared properties](#shared-properties).</li>
     * </ul>
     */
    userSuggestions?: true | PaginatedHookConfig<GetUserOrganizationSuggestionsParams>;
};
/**
 * @interface
 */
type UseOrganizationListReturn<T extends UseOrganizationListParams> = {
    /**
     * A boolean that indicates whether Clerk has completed initialization and there is an authenticated user. Initially `false`, becomes `true` once Clerk loads with a user.
     */
    isLoaded: false;
    /**
     * A function that returns a `Promise` which resolves to the newly created `Organization`.
     */
    createOrganization: undefined;
    /**
     * A function that sets the active session and/or organization.
     */
    setActive: undefined;
    /**
     * Returns `PaginatedResources` which includes a list of the user's organization memberships.
     */
    userMemberships: PaginatedResourcesWithDefault<OrganizationMembershipResource>;
    /**
     * Returns `PaginatedResources` which includes a list of the user's organization invitations.
     */
    userInvitations: PaginatedResourcesWithDefault<UserOrganizationInvitationResource>;
    /**
     * Returns `PaginatedResources` which includes a list of suggestions for organizations that the user can join.
     */
    userSuggestions: PaginatedResourcesWithDefault<OrganizationSuggestionResource>;
} | {
    isLoaded: boolean;
    createOrganization: (CreateOrganizationParams: CreateOrganizationParams) => Promise<OrganizationResource>;
    setActive: SetActive;
    userMemberships: PaginatedResources<OrganizationMembershipResource, T['userMemberships'] extends {
        infinite: true;
    } ? true : false>;
    userInvitations: PaginatedResources<UserOrganizationInvitationResource, T['userInvitations'] extends {
        infinite: true;
    } ? true : false>;
    userSuggestions: PaginatedResources<OrganizationSuggestionResource, T['userSuggestions'] extends {
        infinite: true;
    } ? true : false>;
};
/**
 * The `useOrganizationList()` hook provides access to the current user's organization memberships, invitations, and suggestions. It also includes methods for creating new organizations and managing the active organization.
 *
 * @example
 * ### Expanding and paginating attributes
 *
 * To keep network usage to a minimum, developers are required to opt-in by specifying which resource they need to fetch and paginate through. So by default, the `userMemberships`, `userInvitations`, and `userSuggestions` attributes are not populated. You must pass true or an object with the desired properties to fetch and paginate the data.
 *
 * ```tsx
 * // userMemberships.data will never be populated
 * const { userMemberships } = useOrganizationList()
 *
 * // Use default values to fetch userMemberships, such as initialPage = 1 and pageSize = 10
 * const { userMemberships } = useOrganizationList({
 *   userMemberships: true,
 * })
 *
 * // Pass your own values to fetch userMemberships
 * const { userMemberships } = useOrganizationList({
 *   userMemberships: {
 *     pageSize: 20,
 *     initialPage: 2, // skips the first page
 *   },
 * })
 *
 * // Aggregate pages in order to render an infinite list
 * const { userMemberships } = useOrganizationList({
 *   userMemberships: {
 *     infinite: true,
 *   },
 * })
 * ```
 *
 * @example
 * ### Infinite pagination
 *
 * The following example demonstrates how to use the `infinite` property to fetch and append new data to the existing list. The `userMemberships` attribute will be populated with the first page of the user's organization memberships. When the "Load more" button is clicked, the `fetchNext` helper function will be called to append the next page of memberships to the list.
 *
 * ```tsx {{ filename: 'src/components/JoinedOrganizations.tsx' }}
 * import { useOrganizationList } from '@clerk/clerk-react'
 * import React from 'react'
 *
 * const JoinedOrganizations = () => {
 *   const { isLoaded, setActive, userMemberships } = useOrganizationList({
 *     userMemberships: {
 *       infinite: true,
 *     },
 *   })
 *
 *   if (!isLoaded) {
 *     return <>Loading</>
 *   }
 *
 *   return (
 *     <>
 *       <ul>
 *         {userMemberships.data?.map((mem) => (
 *           <li key={mem.id}>
 *             <span>{mem.organization.name}</span>
 *             <button onClick={() => setActive({ organization: mem.organization.id })}>Select</button>
 *           </li>
 *         ))}
 *       </ul>
 *
 *       <button disabled={!userMemberships.hasNextPage} onClick={() => userMemberships.fetchNext()}>
 *         Load more
 *       </button>
 *     </>
 *   )
 * }
 *
 * export default JoinedOrganizations
 * ```
 *
 * @example
 * ### Simple pagination
 *
 * The following example demonstrates how to use the `fetchPrevious` and `fetchNext` helper functions to paginate through the data. The `userInvitations` attribute will be populated with the first page of invitations. When the "Previous page" or "Next page" button is clicked, the `fetchPrevious` or `fetchNext` helper function will be called to fetch the previous or next page of invitations.
 *
 * Notice the difference between this example's pagination and the infinite pagination example above.
 *
 * ```tsx {{ filename: 'src/components/UserInvitationsTable.tsx' }}
 * import { useOrganizationList } from '@clerk/clerk-react'
 * import React from 'react'
 *
 * const UserInvitationsTable = () => {
 *   const { isLoaded, userInvitations } = useOrganizationList({
 *     userInvitations: {
 *       infinite: true,
 *       keepPreviousData: true,
 *     },
 *   })
 *
 *   if (!isLoaded || userInvitations.isLoading) {
 *     return <>Loading</>
 *   }
 *
 *   return (
 *     <>
 *       <table>
 *         <thead>
 *           <tr>
 *             <th>Email</th>
 *             <th>Org name</th>
 *           </tr>
 *         </thead>
 *
 *         <tbody>
 *           {userInvitations.data?.map((inv) => (
 *             <tr key={inv.id}>
 *               <th>{inv.emailAddress}</th>
 *               <th>{inv.publicOrganizationData.name}</th>
 *             </tr>
 *           ))}
 *         </tbody>
 *       </table>
 *
 *       <button disabled={!userInvitations.hasPreviousPage} onClick={userInvitations.fetchPrevious}>
 *         Prev
 *       </button>
 *       <button disabled={!userInvitations.hasNextPage} onClick={userInvitations.fetchNext}>
 *         Next
 *       </button>
 *     </>
 *   )
 * }
 *
 * export default UserInvitationsTable
 * ```
 */
declare function useOrganizationList<T extends UseOrganizationListParams>(params?: T): UseOrganizationListReturn<T>;

/**
 * @internal
 */
declare const useSafeLayoutEffect: typeof React.useLayoutEffect;

type UseSession = () => UseSessionReturn;
/**
 * The `useSession()` hook provides access to the current user's [`Session`](https://clerk.com/docs/reference/javascript/session) object, as well as helpers for setting the active session.
 *
 * @unionReturnHeadings
 * ["Initialization", "Signed out", "Signed in"]
 *
 * @function
 *
 * @param [options] - An object containing options for the `useSession()` hook.
 *
 * @example
 * ### Access the `Session` object
 *
 * The following example uses the `useSession()` hook to access the `Session` object, which has the `lastActiveAt` property. The `lastActiveAt` property is a `Date` object used to show the time the session was last active.
 *
 * <Tabs items='React,Next.js'>
 * <Tab>
 *
 * ```tsx {{ filename: 'src/Home.tsx' }}
 * import { useSession } from '@clerk/clerk-react'
 *
 * export default function Home() {
 *   const { isLoaded, session, isSignedIn } = useSession()
 *
 *   if (!isLoaded) {
 *     // Handle loading state
 *     return null
 *   }
 *   if (!isSignedIn) {
 *     // Handle signed out state
 *     return null
 *   }
 *
 *   return (
 *     <div>
 *       <p>This session has been active since {session.lastActiveAt.toLocaleString()}</p>
 *     </div>
 *   )
 * }
 * ```
 *
 * </Tab>
 * <Tab>
 *
 * {@include ../../../docs/use-session.md#nextjs-01}
 *
 * </Tab>
 * </Tabs>
 */
declare const useSession: UseSession;

/**
 * The `useSessionList()` hook returns an array of [`Session`](https://clerk.com/docs/reference/javascript/session) objects that have been registered on the client device.
 *
 * @unionReturnHeadings
 * ["Initialization", "Loaded"]
 *
 * @function
 *
 * @example
 * ### Get a list of sessions
 *
 * The following example uses `useSessionList()` to get a list of sessions that have been registered on the client device. The `sessions` property is used to show the number of times the user has visited the page.
 *
 * <Tabs items='React,Next.js'>
 * <Tab>
 *
 * ```tsx {{ filename: 'src/Home.tsx' }}
 * import { useSessionList } from '@clerk/clerk-react'
 *
 * export default function Home() {
 *   const { isLoaded, sessions } = useSessionList()
 *
 *   if (!isLoaded) {
 *     // Handle loading state
 *     return null
 *   }
 *
 *   return (
 *     <div>
 *       <p>Welcome back. You've been here {sessions.length} times before.</p>
 *     </div>
 *   )
 * }
 * ```
 *
 * </Tab>
 * <Tab>
 *
 * {@include ../../../docs/use-session-list.md#nextjs-01}
 *
 * </Tab>
 * </Tabs>
 */
declare const useSessionList: () => UseSessionListReturn;

/**
 * The `useUser()` hook provides access to the current user's [`User`](https://clerk.com/docs/reference/javascript/user) object, which contains all the data for a single user in your application and provides methods to manage their account. This hook also allows you to check if the user is signed in and if Clerk has loaded and initialized.
 *
 * @unionReturnHeadings
 * ["Initialization", "Signed out", "Signed in"]
 *
 * @example
 * ### Get the current user
 *
 * The following example uses the `useUser()` hook to access the [`User`](https://clerk.com/docs/reference/javascript/user) object, which contains the current user's data such as their full name. The `isLoaded` and `isSignedIn` properties are used to handle the loading state and to check if the user is signed in, respectively.
 *
 * ```tsx {{ filename: 'src/Example.tsx' }}
 * import { useUser } from '@clerk/clerk-react'
 *
 * export default function Example() {
 *   const { isSignedIn, user, isLoaded } = useUser()
 *
 *   if (!isLoaded) {
 *     return <div>Loading...</div>
 *   }
 *
 *   if (!isSignedIn) {
 *     return <div>Sign in to view this page</div>
 *   }
 *
 *   return <div>Hello {user.firstName}!</div>
 * }
 * ```
 *
 * @example
 * ### Update user data
 *
 * The following example uses the `useUser()` hook to access the [`User`](https://clerk.com/docs/reference/javascript/user) object, which calls the [`update()`](https://clerk.com/docs/reference/javascript/user#update) method to update the current user's information.
 *
 * <Tabs items='React,Next.js'>
 * <Tab>
 *
 * ```tsx {{ filename: 'src/Home.tsx' }}
 * import { useUser } from '@clerk/clerk-react'
 *
 * export default function Home() {
 *   const { isSignedIn, isLoaded, user } = useUser()
 *
 *   if (!isLoaded) {
 *     // Handle loading state
 *     return null
 *   }
 *
 *   if (!isSignedIn) return null
 *
 *   const updateUser = async () => {
 *     await user.update({
 *       firstName: 'John',
 *       lastName: 'Doe',
 *     })
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={updateUser}>Update your name</button>
 *       <p>user.firstName: {user.firstName}</p>
 *       <p>user.lastName: {user.lastName}</p>
 *     </>
 *   )
 * }
 * ```
 * </Tab>
 * <Tab>
 *
 * {@include ../../../docs/use-user.md#nextjs-01}
 *
 * </Tab>
 * </Tabs>
 *
 * @example
 * ### Reload user data
 *
 * The following example uses the `useUser()` hook to access the [`User`](https://clerk.com/docs/reference/javascript/user) object, which calls the [`reload()`](https://clerk.com/docs/reference/javascript/user#reload) method to get the latest user's information.
 *
 * <Tabs items='React,Next.js'>
 * <Tab>
 *
 * ```tsx {{ filename: 'src/Home.tsx' }}
 * import { useUser } from '@clerk/clerk-react'
 *
 * export default function Home() {
 *   const { isSignedIn, isLoaded, user } = useUser();
 *
 *   if (!isLoaded) {
 *     // Handle loading state
 *     return null;
 *   }
 *
 *   if (!isSignedIn) return null;
 *
 *   const updateUser = async () => {
 *     // Update data via an API endpoint
 *     const updateMetadata = await fetch('/api/updateMetadata', {
 *       method: 'POST',
 *       body: JSON.stringify({
 *         role: 'admin'
 *       })
 *     });
 *
 *     // Check if the update was successful
 *     if ((await updateMetadata.json()).message !== 'success') {
 *       throw new Error('Error updating');
 *     }
 *
 *     // If the update was successful, reload the user data
 *     await user.reload();
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={updateUser}>Update your metadata</button>
 *       <p>user role: {user.publicMetadata.role}</p>
 *     </>
 *   );
 * }
 * ```
 *
 * </Tab>
 * <Tab>
 *
 * {@include ../../../docs/use-user.md#nextjs-02}
 *
 * </Tab>
 * </Tabs>
 */
declare function useUser(): UseUserReturn;

/**
 * > [!WARNING]
 * > This hook should only be used for advanced use cases, such as building a completely custom OAuth flow or as an escape hatch to access to the `Clerk` object.
 *
 * The `useClerk()` hook provides access to the [`Clerk`](https://clerk.com/docs/reference/javascript/clerk) object, allowing you to build alternatives to any Clerk Component.
 *
 * @function
 *
 * @returns The `useClerk()` hook returns the `Clerk` object, which includes all the methods and properties listed in the [`Clerk` reference](https://clerk.com/docs/reference/javascript/clerk).
 *
 * @example
 *
 * The following example uses the `useClerk()` hook to access the `clerk` object. The `clerk` object is used to call the [`openSignIn()`](https://clerk.com/docs/reference/javascript/clerk#sign-in) method to open the sign-in modal.
 *
 * <Tabs items='React,Next.js'>
 * <Tab>
 *
 * ```tsx {{ filename: 'src/Home.tsx' }}
 * import { useClerk } from '@clerk/clerk-react'
 *
 * export default function Home() {
 *   const clerk = useClerk()
 *
 *   return <button onClick={() => clerk.openSignIn({})}>Sign in</button>
 * }
 * ```
 *
 * </Tab>
 * <Tab>
 *
 * {@include ../../../docs/use-clerk.md#nextjs-01}
 *
 * </Tab>
 * </Tabs>
 */
declare const useClerk: () => LoadedClerk;

type UseMemoFactory<T> = () => T;
type UseMemoDependencyArray = Exclude<Parameters<typeof React.useMemo>[1], 'undefined'>;
type UseDeepEqualMemo = <T>(factory: UseMemoFactory<T>, dependencyArray: UseMemoDependencyArray) => T;
/**
 * @internal
 */
declare const useDeepEqualMemo: UseDeepEqualMemo;
/**
 * @internal
 */
declare const isDeeplyEqual: typeof dequal;

type ExcludeClerkError<T> = T extends {
    clerk_error: any;
} ? never : T;
/**
 * @interface
 */
type NeedsReverificationParameters = {
    cancel: () => void;
    complete: () => void;
    level: SessionVerificationLevel | undefined;
};
/**
 * The optional options object.
 * @interface
 */
type UseReverificationOptions = {
    /**
     * A handler that is called when reverification is needed, this will opt-out of using the default UI when provided.
     *
     * @param cancel - A function that will cancel the reverification process.
     * @param complete - A function that will retry the original request after reverification.
     * @param level - The level returned with the reverification hint.
     *
     */
    onNeedsReverification?: (properties: NeedsReverificationParameters) => void;
};
/**
 * @interface
 */
type UseReverificationResult<Fetcher extends (...args: any[]) => Promise<any> | undefined> = (...args: Parameters<Fetcher>) => Promise<ExcludeClerkError<Awaited<ReturnType<Fetcher>>>>;
/**
 * @interface
 */
type UseReverification = <Fetcher extends (...args: any[]) => Promise<any> | undefined, Options extends UseReverificationOptions = UseReverificationOptions>(fetcher: Fetcher, options?: Options) => UseReverificationResult<Fetcher>;
/**
 * > [!WARNING]
 * >
 * > Depending on the SDK you're using, this feature requires `@clerk/nextjs@6.12.7` or later, `@clerk/clerk-react@5.25.1` or later, and `@clerk/clerk-js@5.57.1` or later.
 *
 * The `useReverification()` hook is used to handle a session's reverification flow. If a request requires reverification, a modal will display, prompting the user to verify their credentials. Upon successful verification, the original request will automatically retry.
 *
 * @function
 *
 * @returns The `useReverification()` hook returns an array with the "enhanced" fetcher.
 *
 * @example
 * ### Handle cancellation of the reverification process
 *
 * The following example demonstrates how to handle scenarios where a user cancels the reverification flow, such as closing the modal, which might result in `myData` being `null`.
 *
 * In the following example, `myFetcher` would be a function in your backend that fetches data from the route that requires reverification. See the [guide on how to require reverification](https://clerk.com/docs/guides/secure/reverification) for more information.
 *
 * ```tsx {{ filename: 'src/components/MyButton.tsx' }}
 * import { useReverification } from '@clerk/clerk-react'
 * import { isReverificationCancelledError } from '@clerk/clerk-react/error'
 *
 * type MyData = {
 *   balance: number
 * }
 *
 * export function MyButton() {
 *   const fetchMyData = () => fetch('/api/balance').then(res=> res.json() as Promise<MyData>)
 *   const enhancedFetcher = useReverification(fetchMyData);
 *
 *   const handleClick = async () => {
 *     try {
 *       const myData = await enhancedFetcher()
 *       //     ^ is types as `MyData`
 *     } catch (e) {
 *       // Handle error returned from the fetcher here
 *
 *       // You can also handle cancellation with the following
 *       if (isReverificationCancelledError(err)) {
 *         // Handle the cancellation error here
 *       }
 *     }
 *   }
 *
 *   return <button onClick={handleClick}>Update User</button>
 * }
 * ```
 *
 */
declare const useReverification: UseReverification;

/**
 * @internal
 */
declare const useStatements: <T extends PagesOrInfiniteOptions & {
    infinite?: boolean;
    keepPreviousData?: boolean;
} & {
    for?: _clerk_types.ForPayerType;
}>(params?: T | undefined) => PaginatedResources<BillingStatementResource, T extends {
    infinite: true;
} ? true : false>;

/**
 * @internal
 */
declare const usePaymentAttempts: <T extends PagesOrInfiniteOptions & {
    infinite?: boolean;
    keepPreviousData?: boolean;
} & {
    for?: _clerk_types.ForPayerType;
}>(params?: T | undefined) => PaginatedResources<BillingPaymentResource, T extends {
    infinite: true;
} ? true : false>;

/**
 * @internal
 */
declare const usePaymentMethods: <T extends PagesOrInfiniteOptions & {
    infinite?: boolean;
    keepPreviousData?: boolean;
} & {
    for?: _clerk_types.ForPayerType;
}>(params?: T | undefined) => PaginatedResources<BillingPaymentMethodResource, T extends {
    infinite: true;
} ? true : false>;

/**
 * @internal
 */
declare const usePlans: <T extends PagesOrInfiniteOptions & {
    infinite?: boolean;
    keepPreviousData?: boolean;
} & {
    for?: _clerk_types.ForPayerType;
}>(params?: T | undefined) => PaginatedResources<BillingPlanResource, T extends {
    infinite: true;
} ? true : false>;

type UseSubscriptionParams = {
    for?: ForPayerType;
    /**
     * If `true`, the previous data will be kept in the cache until new data is fetched.
     *
     * @default false
     */
    keepPreviousData?: boolean;
};
/**
 * @internal
 *
 * Fetches subscription data for the current user or organization.
 *
 * @experimental This is an experimental API for the Billing feature that is available under a public beta, and the API is subject to change. It is advised to [pin](https://clerk.com/docs/pinning) the SDK version and the clerk-js version to avoid breaking changes.
 */
declare const useSubscription: (params?: UseSubscriptionParams) => {
    data: _clerk_types.BillingSubscriptionResource | null | undefined;
    error: any;
    isLoading: boolean;
    isFetching: boolean;
    revalidate: () => Promise<_clerk_types.BillingSubscriptionResource | null | undefined>;
};

declare const ClerkInstanceContext: React.Context<{
    value: LoadedClerk;
} | undefined>;
declare const useClerkInstanceContext: () => LoadedClerk;
declare const UserContext: React.Context<{
    value: UserResource | null | undefined;
} | undefined>;
declare const useUserContext: () => UserResource | null | undefined;
declare const ClientContext: React.Context<{
    value: ClientResource | null | undefined;
} | undefined>;
declare const useClientContext: () => ClientResource | null | undefined;
declare const SessionContext: React.Context<{
    value: SignedInSessionResource | null | undefined;
} | undefined>;
declare const useSessionContext: () => SignedInSessionResource | null | undefined;
declare const OptionsContext: React.Context<ClerkOptions>;
type UseCheckoutOptions = {
    for?: ForPayerType;
    planPeriod: BillingSubscriptionPlanPeriod;
    planId: string;
};
declare const __experimental_CheckoutProvider: ({ children, ...rest }: PropsWithChildren<UseCheckoutOptions>) => React.JSX.Element;
/**
 * @internal
 */
declare function useOptionsContext(): ClerkOptions;
type OrganizationContextProps = {
    organization: OrganizationResource | null | undefined;
};
declare const useOrganizationContext: () => {
    organization: OrganizationResource | null | undefined;
};
declare const OrganizationProvider: ({ children, organization, swrConfig, }: PropsWithChildren<OrganizationContextProps & {
    swrConfig?: any;
}>) => React.JSX.Element;
/**
 * @internal
 */
declare function useAssertWrappedByClerkProvider(displayNameOrFn: string | (() => void)): void;

/**
 * Utility type that removes function properties from a type.
 */
type RemoveFunctions<T> = {
    [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: T[K];
};
/**
 * Utility type that makes all properties `null`.
 */
type ForceNull<T> = {
    [K in keyof T]: null;
};
type CheckoutProperties = Omit<RemoveFunctions<BillingCheckoutResource>, 'pathRoot' | 'status'>;
type FetchStatusAndError = {
    error: ClerkAPIResponseError;
    fetchStatus: 'error';
} | {
    error: null;
    fetchStatus: 'idle' | 'fetching';
};
/**
 * @internal
 * On status === 'needs_initialization', all properties are null.
 * On status === 'needs_confirmation' or 'completed', all properties are defined the same as the CommerceCheckoutResource.
 */
type CheckoutPropertiesPerStatus = ({
    status: Extract<__experimental_CheckoutCacheState['status'], 'needs_initialization'>;
} & ForceNull<CheckoutProperties>) | ({
    status: Extract<__experimental_CheckoutCacheState['status'], 'needs_confirmation' | 'completed'>;
} & CheckoutProperties);
type __experimental_UseCheckoutReturn = {
    checkout: FetchStatusAndError & CheckoutPropertiesPerStatus & {
        confirm: __experimental_CheckoutInstance['confirm'];
        start: __experimental_CheckoutInstance['start'];
        clear: () => void;
        finalize: (params?: {
            navigate?: SetActiveNavigate;
        }) => void;
        getState: () => __experimental_CheckoutCacheState;
        isStarting: boolean;
        isConfirming: boolean;
    };
};
type Params = Parameters<typeof __experimental_CheckoutProvider>[0];
declare const useCheckout: (options?: Params) => __experimental_UseCheckoutReturn;

type PaymentElementError = {
    gateway: 'stripe';
    error: {
        /**
         * For some errors that could be handled programmatically, a short string indicating the [error code](https://stripe.com/docs/error-codes) reported.
         */
        code?: string;
        message?: string;
        type: string;
    };
};
type internalStripeAppearance = {
    colorPrimary: string;
    colorBackground: string;
    colorText: string;
    colorTextSecondary: string;
    colorSuccess: string;
    colorDanger: string;
    colorWarning: string;
    fontWeightNormal: string;
    fontWeightMedium: string;
    fontWeightBold: string;
    fontSizeXl: string;
    fontSizeLg: string;
    fontSizeSm: string;
    fontSizeXs: string;
    borderRadius: string;
    spacingUnit: string;
};
type PaymentElementProviderProps = {
    checkout?: BillingCheckoutResource | ReturnType<typeof useCheckout>['checkout'];
    stripeAppearance?: internalStripeAppearance;
    /**
     * Default to `user` if not provided.
     *
     * @default 'user'
     */
    for?: ForPayerType;
    paymentDescription?: string;
};
declare const PaymentElementProvider: ({ children, ...props }: PropsWithChildren<PaymentElementProviderProps>) => React.JSX.Element;
declare const PaymentElement: ({ fallback }: {
    fallback?: ReactNode;
}) => React.JSX.Element;
type UsePaymentElementReturn = {
    submit: () => Promise<{
        data: {
            gateway: 'stripe';
            paymentToken: string;
        };
        error: null;
    } | {
        data: null;
        error: PaymentElementError;
    }>;
    reset: () => Promise<void>;
    isFormReady: boolean;
} & ({
    provider: {
        name: 'stripe';
    };
    isProviderReady: true;
} | {
    provider: undefined;
    isProviderReady: false;
});
declare const usePaymentElement: () => UsePaymentElementReturn;

export { ClerkInstanceContext, ClientContext, OptionsContext, OrganizationProvider, SessionContext, UserContext, __experimental_CheckoutProvider, PaymentElement as __experimental_PaymentElement, PaymentElementProvider as __experimental_PaymentElementProvider, useCheckout as __experimental_useCheckout, usePaymentAttempts as __experimental_usePaymentAttempts, usePaymentElement as __experimental_usePaymentElement, usePaymentMethods as __experimental_usePaymentMethods, usePlans as __experimental_usePlans, useStatements as __experimental_useStatements, useSubscription as __experimental_useSubscription, assertContextExists, createContextAndHook, isDeeplyEqual, useAssertWrappedByClerkProvider, useClerk, useClerkInstanceContext, useClientContext, useDeepEqualMemo, useOptionsContext, useOrganization, useOrganizationContext, useOrganizationList, useReverification, useSafeLayoutEffect, useSession, useSessionContext, useSessionList, useUser, useUserContext };
