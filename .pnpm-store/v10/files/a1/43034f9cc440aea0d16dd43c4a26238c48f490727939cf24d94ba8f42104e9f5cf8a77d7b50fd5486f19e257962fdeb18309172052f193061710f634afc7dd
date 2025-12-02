import { Un as InferAdditionalFieldsFromPluginOptions, bn as SessionQueryParams, r as BetterAuthOptions$1 } from "../../index--CrC0_x3.mjs";
import "../../types-CRiHq5rJ.mjs";
import { a as LiteralNumber, c as OmitId, d as PrettifyDeep, f as Primitive, g as WithoutEmpty, h as UnionToIntersection, i as HasRequiredKeys, l as PreserveJSDoc, m as StripEmptyObjects, n as DeepPartial, o as LiteralString, p as RequiredKeysOf, r as Expand, s as LiteralUnion, t as Awaitable, u as Prettify } from "../../helper-DU33OcfW.mjs";
import { a as Role, i as AccessControl, o as Statements } from "../../index-CNCxG_Zo.mjs";
import "../../plugins-Brc8BsoZ.mjs";
import { B as OrganizationOptions, C as Organization, D as Team, T as OrganizationRole, _ as InferTeam, c as OrganizationPlugin, f as InferInvitation, ht as admin, k as TeamMember, m as InferOrganization, p as InferMember, pt as apiKey, tt as oidcProvider, v as Invitation, x as Member } from "../../index-CBKo0Xhw.mjs";
import { t as anonymous } from "../../index-4Dl390uF.mjs";
import "../../index-1CASa5wB.mjs";
import "../../index-BMWasIyr.mjs";
import "../../index-vNFlnKLV.mjs";
import { n as deviceAuthorization } from "../../index-CDpFwohl.mjs";
import { n as emailOTP } from "../../index-lgP3EBx9.mjs";
import { r as genericOAuth } from "../../index-DZdJoFeD.mjs";
import "../../index-DJB7f_aW.mjs";
import { t as jwt } from "../../index-CKa7aJXf.mjs";
import { n as magicLink } from "../../index-By5ErUuO.mjs";
import { t as multiSession } from "../../index-Bxm_8jHm.mjs";
import "../../index-LFDxx8ua.mjs";
import "../../index-C_Em80Re.mjs";
import { t as oneTimeToken } from "../../index-DPBufSCV.mjs";
import "../../index-BxN7bJlj.mjs";
import { t as phoneNumber } from "../../index-C4DspCDn.mjs";
import { n as siwe } from "../../index-CW2lwKn2.mjs";
import { n as twoFactorClient } from "../../index-C3xObRkV.mjs";
import { n as username } from "../../index-CTeF5TnP.mjs";
import * as _better_auth_core28 from "@better-auth/core";
import { BetterAuthOptions, BetterAuthPlugin, ClientFetchOption } from "@better-auth/core";
import { DBFieldAttribute } from "@better-auth/core/db";
import { JSONWebKeySet } from "jose";
import * as nanostores5 from "nanostores";
import * as _better_fetch_fetch101 from "@better-fetch/fetch";
import { Auth } from "better-auth";

//#region src/plugins/additional-fields/client.d.ts
declare const inferAdditionalFields: <T$1, S$1 extends {
  user?: {
    [key: string]: DBFieldAttribute;
  } | undefined;
  session?: {
    [key: string]: DBFieldAttribute;
  } | undefined;
} = {}>(schema?: S$1 | undefined) => {
  id: "additional-fields-client";
  $InferServerPlugin: ((T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
    options: BetterAuthOptions;
  } ? T$1["options"] : never) extends never ? S$1 extends {
    user?: {
      [key: string]: DBFieldAttribute;
    } | undefined;
    session?: {
      [key: string]: DBFieldAttribute;
    } | undefined;
  } ? {
    id: "additional-fields-client";
    schema: {
      user: {
        fields: S$1["user"] extends object ? S$1["user"] : {};
      };
      session: {
        fields: S$1["session"] extends object ? S$1["session"] : {};
      };
    };
  } : never : (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
    options: BetterAuthOptions;
  } ? T$1["options"] : never) extends BetterAuthOptions ? {
    id: "additional-fields";
    schema: {
      user: {
        fields: (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
          options: BetterAuthOptions;
        } ? T$1["options"] : never)["user"] extends {
          additionalFields: infer U;
        } ? U : {};
      };
      session: {
        fields: (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
          options: BetterAuthOptions;
        } ? T$1["options"] : never)["session"] extends {
          additionalFields: infer U;
        } ? U : {};
      };
    };
  } : never) extends BetterAuthPlugin ? (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
    options: BetterAuthOptions;
  } ? T$1["options"] : never) extends never ? S$1 extends {
    user?: {
      [key: string]: DBFieldAttribute;
    } | undefined;
    session?: {
      [key: string]: DBFieldAttribute;
    } | undefined;
  } ? {
    id: "additional-fields-client";
    schema: {
      user: {
        fields: S$1["user"] extends object ? S$1["user"] : {};
      };
      session: {
        fields: S$1["session"] extends object ? S$1["session"] : {};
      };
    };
  } : never : (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
    options: BetterAuthOptions;
  } ? T$1["options"] : never) extends BetterAuthOptions ? {
    id: "additional-fields";
    schema: {
      user: {
        fields: (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
          options: BetterAuthOptions;
        } ? T$1["options"] : never)["user"] extends {
          additionalFields: infer U;
        } ? U : {};
      };
      session: {
        fields: (T$1 extends BetterAuthOptions ? T$1 : T$1 extends {
          options: BetterAuthOptions;
        } ? T$1["options"] : never)["session"] extends {
          additionalFields: infer U;
        } ? U : {};
      };
    };
  } : never : undefined;
};
//#endregion
//#region src/plugins/admin/client.d.ts
interface AdminClientOptions {
  ac?: AccessControl | undefined;
  roles?: { [key in string]: Role } | undefined;
}
declare const adminClient: <O$1 extends AdminClientOptions>(options?: O$1 | undefined) => {
  id: "admin-client";
  $InferServerPlugin: ReturnType<typeof admin<{
    ac: O$1["ac"] extends AccessControl ? O$1["ac"] : AccessControl<{
      readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
      readonly session: readonly ["list", "revoke", "delete"];
    }>;
    roles: O$1["roles"] extends Record<string, Role> ? O$1["roles"] : {
      admin: Role;
      user: Role;
    };
  }>>;
  getActions: () => {
    admin: {
      checkRolePermission: <R extends (O$1 extends {
        roles: any;
      } ? keyof O$1["roles"] : "admin" | "user")>(data: ({
        /**
         * @deprecated Use `permissions` instead
         */
        permission: { [key in keyof (O$1["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
          readonly session: readonly ["list", "revoke", "delete"];
        })]?: ((O$1["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
          readonly session: readonly ["list", "revoke", "delete"];
        })[key] extends readonly unknown[] ? (O$1["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
          readonly session: readonly ["list", "revoke", "delete"];
        })[key][number] : never)[] | undefined };
        permissions?: never | undefined;
      } | {
        permissions: { [key in keyof (O$1["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
          readonly session: readonly ["list", "revoke", "delete"];
        })]?: ((O$1["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
          readonly session: readonly ["list", "revoke", "delete"];
        })[key] extends readonly unknown[] ? (O$1["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
          readonly session: readonly ["list", "revoke", "delete"];
        })[key][number] : never)[] | undefined };
        permission?: never | undefined;
      }) & {
        role: R;
      }) => boolean;
    };
  };
  pathMethods: {
    "/admin/list-users": "GET";
    "/admin/stop-impersonating": "POST";
  };
};
//#endregion
//#region src/plugins/anonymous/client.d.ts
declare const anonymousClient: () => {
  id: "anonymous";
  $InferServerPlugin: ReturnType<typeof anonymous>;
  pathMethods: {
    "/sign-in/anonymous": "POST";
  };
  atomListeners: {
    matcher: (path: string) => path is "/sign-in/anonymous";
    signal: "$sessionSignal";
  }[];
};
//#endregion
//#region src/plugins/api-key/client.d.ts
declare const apiKeyClient: () => {
  id: "api-key";
  $InferServerPlugin: ReturnType<typeof apiKey>;
  pathMethods: {
    "/api-key/create": "POST";
    "/api-key/delete": "POST";
    "/api-key/delete-all-expired-api-keys": "POST";
  };
};
type ApiKeyClientPlugin = ReturnType<typeof apiKeyClient>;
//#endregion
//#region src/plugins/custom-session/client.d.ts
declare const customSessionClient: <A extends Auth | {
  options: BetterAuthOptions$1;
}>() => {
  id: "infer-server-plugin";
  $InferServerPlugin: (A extends {
    options: infer O;
  } ? O : A)["plugins"] extends (infer P)[] ? P extends {
    id: "custom-session";
  } ? P : never : never;
};
//#endregion
//#region src/plugins/device-authorization/client.d.ts
declare const deviceAuthorizationClient: () => {
  id: "device-authorization";
  $InferServerPlugin: ReturnType<typeof deviceAuthorization>;
  pathMethods: {
    "/device/code": "POST";
    "/device/token": "POST";
    "/device": "GET";
    "/device/approve": "POST";
    "/device/deny": "POST";
  };
};
//#endregion
//#region src/plugins/email-otp/client.d.ts
declare const emailOTPClient: () => {
  id: "email-otp";
  $InferServerPlugin: ReturnType<typeof emailOTP>;
  atomListeners: {
    matcher: (path: string) => path is "/email-otp/verify-email" | "/sign-in/email-otp";
    signal: "$sessionSignal";
  }[];
};
//#endregion
//#region src/plugins/generic-oauth/client.d.ts
declare const genericOAuthClient: () => {
  id: "generic-oauth-client";
  $InferServerPlugin: ReturnType<typeof genericOAuth>;
};
//#endregion
//#region src/plugins/jwt/client.d.ts
interface JwtClientOptions {
  jwks?: {
    /**
     * The path of the endpoint exposing the JWKS.
     * Must match the server configuration.
     *
     * @default /jwks
     */
    jwksPath?: string;
  };
}
declare const jwtClient: (options?: JwtClientOptions) => {
  id: "better-auth-client";
  $InferServerPlugin: ReturnType<typeof jwt>;
  pathMethods: {
    [x: string]: "GET";
  };
  getActions: ($fetch: _better_fetch_fetch101.BetterFetch) => {
    jwks: (fetchOptions?: any) => Promise<{
      data: null;
      error: {
        message?: string | undefined;
        status: number;
        statusText: string;
      };
    } | {
      data: JSONWebKeySet;
      error: null;
    }>;
  };
};
//#endregion
//#region src/plugins/last-login-method/client.d.ts
/**
 * Configuration for the client-side last login method plugin
 */
interface LastLoginMethodClientConfig {
  /**
   * Name of the cookie to read the last login method from
   * @default "better-auth.last_used_login_method"
   */
  cookieName?: string | undefined;
}
/**
 * Client-side plugin to retrieve the last used login method
 */
declare const lastLoginMethodClient: (config?: LastLoginMethodClientConfig) => {
  id: "last-login-method-client";
  getActions(): {
    /**
     * Get the last used login method from cookies
     * @returns The last used login method or null if not found
     */
    getLastUsedLoginMethod: () => string | null;
    /**
     * Clear the last used login method cookie
     * This sets the cookie with an expiration date in the past
     */
    clearLastUsedLoginMethod: () => void;
    /**
     * Check if a specific login method was the last used
     * @param method The method to check
     * @returns True if the method was the last used, false otherwise
     */
    isLastUsedLoginMethod: (method: string) => boolean;
  };
};
//#endregion
//#region src/plugins/magic-link/client.d.ts
declare const magicLinkClient: () => {
  id: "magic-link";
  $InferServerPlugin: ReturnType<typeof magicLink>;
};
//#endregion
//#region src/plugins/multi-session/client.d.ts
declare const multiSessionClient: () => {
  id: "multi-session";
  $InferServerPlugin: ReturnType<typeof multiSession>;
  atomListeners: {
    matcher(path: string): path is "/multi-session/set-active";
    signal: "$sessionSignal";
  }[];
};
//#endregion
//#region src/plugins/oidc-provider/client.d.ts
declare const oidcClient: () => {
  id: "oidc-client";
  $InferServerPlugin: ReturnType<typeof oidcProvider>;
};
type OidcClientPlugin = ReturnType<typeof oidcClient>;
//#endregion
//#region src/plugins/one-tap/client.d.ts
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
        };
      };
    } | undefined;
    googleScriptInitialized?: boolean | undefined;
  }
}
interface GoogleOneTapOptions {
  /**
   * Google client ID
   */
  clientId: string;
  /**
   * Auto select the account if the user is already signed in
   */
  autoSelect?: boolean | undefined;
  /**
   * Cancel the flow when the user taps outside the prompt
   */
  cancelOnTapOutside?: boolean | undefined;
  /**
   * The mode to use for the Google One Tap flow
   *
   * popup: Use a popup window
   * redirect: Redirect the user to the Google One Tap flow
   *
   * @default "popup"
   */
  uxMode?: ("popup" | "redirect") | undefined;
  /**
   * The context to use for the Google One Tap flow. See https://developers.google.com/identity/gsi/web/reference/js-reference
   *
   * @default "signin"
   */
  context?: ("signin" | "signup" | "use") | undefined;
  /**
   * Additional configuration options to pass to the Google One Tap API.
   */
  additionalOptions?: Record<string, any> | undefined;
  /**
   * Configuration options for the prompt and exponential backoff behavior.
   */
  promptOptions?: {
    /**
     * Base delay (in milliseconds) for exponential backoff.
     * @default 1000
     */
    baseDelay?: number;
    /**
     * Maximum number of prompt attempts before calling onPromptNotification.
     * @default 5
     */
    maxAttempts?: number;
  } | undefined;
}
interface GoogleOneTapActionOptions extends Omit<GoogleOneTapOptions, "clientId" | "promptOptions"> {
  fetchOptions?: ClientFetchOption | undefined;
  /**
   * Callback URL.
   */
  callbackURL?: string | undefined;
  /**
   * Optional callback that receives the prompt notification if (or when) the prompt is dismissed or skipped.
   * This lets you render an alternative UI (e.g. a Google Sign-In button) to restart the process.
   */
  onPromptNotification?: ((notification: any) => void) | undefined;
}
declare const oneTapClient: (options: GoogleOneTapOptions) => {
  id: "one-tap";
  getActions: ($fetch: _better_fetch_fetch101.BetterFetch, _: _better_auth_core28.ClientStore) => {
    oneTap: (opts?: GoogleOneTapActionOptions | undefined, fetchOptions?: ClientFetchOption | undefined) => Promise<void>;
  };
  getAtoms($fetch: _better_fetch_fetch101.BetterFetch): {};
};
//#endregion
//#region src/plugins/one-time-token/client.d.ts
declare const oneTimeTokenClient: () => {
  id: "one-time-token";
  $InferServerPlugin: ReturnType<typeof oneTimeToken>;
};
//#endregion
//#region src/plugins/organization/permission.d.ts
type PermissionExclusive = {
  /**
   * @deprecated Use `permissions` instead
   */
  permission: {
    [key: string]: string[];
  };
  permissions?: never | undefined;
} | {
  permissions: {
    [key: string]: string[];
  };
  permission?: never | undefined;
};
type HasPermissionBaseInput = {
  role: string;
  options: OrganizationOptions;
  allowCreatorAllPermissions?: boolean | undefined;
} & PermissionExclusive;
//#endregion
//#region src/plugins/organization/client.d.ts
/**
 * Using the same `hasPermissionFn` function, but without the need for a `ctx` parameter or the `organizationId` parameter.
 */
declare const clientSideHasPermission: (input: HasPermissionBaseInput) => boolean;
interface OrganizationClientOptions {
  ac?: AccessControl | undefined;
  roles?: { [key in string]: Role } | undefined;
  teams?: {
    enabled: boolean;
  } | undefined;
  schema?: {
    organization?: {
      additionalFields?: {
        [key: string]: DBFieldAttribute;
      };
    };
    member?: {
      additionalFields?: {
        [key: string]: DBFieldAttribute;
      };
    };
    invitation?: {
      additionalFields?: {
        [key: string]: DBFieldAttribute;
      };
    };
    team?: {
      additionalFields?: {
        [key: string]: DBFieldAttribute;
      };
    };
    organizationRole?: {
      additionalFields?: {
        [key: string]: DBFieldAttribute;
      };
    };
  } | undefined;
  dynamicAccessControl?: {
    enabled: boolean;
  } | undefined;
}
declare const organizationClient: <CO extends OrganizationClientOptions>(options?: CO | undefined) => {
  id: "organization";
  $InferServerPlugin: OrganizationPlugin<{
    ac: CO["ac"] extends AccessControl ? CO["ac"] : AccessControl<{
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>;
    roles: CO["roles"] extends Record<string, Role> ? CO["roles"] : {
      admin: Role;
      member: Role;
      owner: Role;
    };
    teams: {
      enabled: CO["teams"] extends {
        enabled: true;
      } ? true : false;
    };
    schema: CO["schema"];
    dynamicAccessControl: {
      enabled: CO["dynamicAccessControl"] extends {
        enabled: true;
      } ? true : false;
    };
  }>;
  getActions: ($fetch: _better_fetch_fetch101.BetterFetch, _$store: _better_auth_core28.ClientStore, co: _better_auth_core28.BetterAuthClientOptions | undefined) => {
    $Infer: {
      ActiveOrganization: CO["teams"] extends {
        enabled: true;
      } ? {
        members: InferMember<CO, false>[];
        invitations: InferInvitation<CO>[];
        teams: InferTeam<CO, false>[];
      } & ({
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        logo?: string | null | undefined;
        metadata?: any;
      } & InferAdditionalFieldsFromPluginOptions<"organization", CO, false> extends infer T ? { [K in keyof T]: T[K] } : never) : {
        members: InferMember<CO, false>[];
        invitations: InferInvitation<CO, false>[];
      } & ({
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        logo?: string | null | undefined;
        metadata?: any;
      } & InferAdditionalFieldsFromPluginOptions<"organization", CO, false> extends infer T_1 ? { [K in keyof T_1]: T_1[K] } : never);
      Organization: InferOrganization<CO, false>;
      Invitation: InferInvitation<CO, false>;
      Member: InferMember<CO, false>;
      Team: InferTeam<CO, false>;
    };
    organization: {
      checkRolePermission: <R extends (CO extends {
        roles: any;
      } ? keyof CO["roles"] : "admin" | "member" | "owner")>(data: ({
        /**
         * @deprecated Use `permissions` instead
         */
        permission: { [key in keyof (CO["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })]?: ((CO["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key] extends readonly unknown[] ? (CO["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key][number] : never)[] | undefined };
        permissions?: never | undefined;
      } | {
        permissions: { [key in keyof (CO["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })]?: ((CO["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key] extends readonly unknown[] ? (CO["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key][number] : never)[] | undefined };
        permission?: never | undefined;
      }) & {
        role: R;
      }) => boolean;
    };
  };
  getAtoms: ($fetch: _better_fetch_fetch101.BetterFetch) => {
    $listOrg: nanostores5.PreinitializedWritableAtom<boolean> & object;
    $activeOrgSignal: nanostores5.PreinitializedWritableAtom<boolean> & object;
    $activeMemberSignal: nanostores5.PreinitializedWritableAtom<boolean> & object;
    $activeMemberRoleSignal: nanostores5.PreinitializedWritableAtom<boolean> & object;
    activeOrganization: nanostores5.PreinitializedWritableAtom<{
      data: Prettify<({
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        logo?: string | null | undefined;
        metadata?: any;
      } & InferAdditionalFieldsFromPluginOptions<"organization", CO, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
        members: InferMember<CO, false>[];
        invitations: InferInvitation<CO, false>[];
      }> | null;
      error: null | _better_fetch_fetch101.BetterFetchError;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (queryParams?: {
        query?: SessionQueryParams;
      } | undefined) => Promise<void>;
    }> & object;
    listOrganizations: nanostores5.PreinitializedWritableAtom<{
      data: ({
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        logo?: string | null | undefined;
        metadata?: any;
      } & InferAdditionalFieldsFromPluginOptions<"organization", CO, false> extends infer T_1 ? { [K in keyof T_1]: T_1[K] } : never)[] | null;
      error: null | _better_fetch_fetch101.BetterFetchError;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (queryParams?: {
        query?: SessionQueryParams;
      } | undefined) => Promise<void>;
    }> & object;
    activeMember: nanostores5.PreinitializedWritableAtom<{
      data: {
        id: string;
        organizationId: string;
        userId: string;
        role: string;
        createdAt: Date;
      } | null;
      error: null | _better_fetch_fetch101.BetterFetchError;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (queryParams?: {
        query?: SessionQueryParams;
      } | undefined) => Promise<void>;
    }> & object;
    activeMemberRole: nanostores5.PreinitializedWritableAtom<{
      data: {
        role: string;
      } | null;
      error: null | _better_fetch_fetch101.BetterFetchError;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (queryParams?: {
        query?: SessionQueryParams;
      } | undefined) => Promise<void>;
    }> & object;
  };
  pathMethods: {
    "/organization/get-full-organization": "GET";
    "/organization/list-user-teams": "GET";
  };
  atomListeners: ({
    matcher(path: string): path is "/organization/create" | "/organization/update" | "/organization/delete";
    signal: "$listOrg";
  } | {
    matcher(path: string): boolean;
    signal: "$activeOrgSignal";
  } | {
    matcher(path: string): boolean;
    signal: "$sessionSignal";
  } | {
    matcher(path: string): boolean;
    signal: "$activeMemberSignal";
  } | {
    matcher(path: string): boolean;
    signal: "$activeMemberRoleSignal";
  })[];
};
declare const inferOrgAdditionalFields: <O$1 extends {
  options: BetterAuthOptions$1;
}, S$1 extends OrganizationOptions["schema"] = undefined>(schema?: S$1 | undefined) => undefined extends S$1 ? O$1 extends Object ? O$1 extends {
  session?: {
    fields?: {
      activeOrganizationId?: string;
      activeTeamId?: string;
    };
  };
  organization?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Organization, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  member?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Member, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  invitation?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Invitation, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  team?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Team, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  teamMember?: {
    modelName?: string;
    fields?: { [key in keyof Omit<TeamMember, "id">]?: string };
  };
  organizationRole?: {
    modelName?: string;
    fields?: { [key in keyof Omit<OrganizationRole, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
} ? O$1 : ((O$1 extends {
  options: any;
} ? O$1 : {
  options: {
    plugins: [];
  };
})["options"]["plugins"][number] extends infer T ? T extends (O$1 extends {
  options: any;
} ? O$1 : {
  options: {
    plugins: [];
  };
})["options"]["plugins"][number] ? T extends {
  id: "organization";
} ? T : never : never : never) extends {
  options: {
    schema: infer S_1;
  };
} ? S_1 extends {
  session?: {
    fields?: {
      activeOrganizationId?: string;
      activeTeamId?: string;
    };
  };
  organization?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Organization, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  member?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Member, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  invitation?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Invitation, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  team?: {
    modelName?: string;
    fields?: { [key in keyof Omit<Team, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
  teamMember?: {
    modelName?: string;
    fields?: { [key in keyof Omit<TeamMember, "id">]?: string };
  };
  organizationRole?: {
    modelName?: string;
    fields?: { [key in keyof Omit<OrganizationRole, "id">]?: string };
    additionalFields?: { [key in string]: DBFieldAttribute };
  };
} | undefined ? S_1 : undefined : undefined : undefined : S$1;
//#endregion
//#region src/plugins/phone-number/client.d.ts
declare const phoneNumberClient: () => {
  id: "phoneNumber";
  $InferServerPlugin: ReturnType<typeof phoneNumber>;
  atomListeners: {
    matcher(path: string): path is "/phone-number/verify" | "/sign-in/phone-number" | "/phone-number/update";
    signal: "$sessionSignal";
  }[];
};
//#endregion
//#region src/plugins/siwe/client.d.ts
declare const siweClient: () => {
  id: "siwe";
  $InferServerPlugin: ReturnType<typeof siwe>;
};
//#endregion
//#region src/plugins/username/client.d.ts
declare const usernameClient: () => {
  id: "username";
  $InferServerPlugin: ReturnType<typeof username>;
  atomListeners: {
    matcher: (path: string) => path is "/sign-in/username";
    signal: "$sessionSignal";
  }[];
};
//#endregion
//#region src/client/plugins/infer-plugin.d.ts
declare const InferServerPlugin: <AuthOrOption extends BetterAuthOptions | {
  options: BetterAuthOptions;
}, ID extends string>() => {
  id: "infer-server-plugin";
  $InferServerPlugin: (AuthOrOption extends {
    options: infer O;
  } ? O : AuthOrOption)["plugins"] extends (infer P)[] ? P extends {
    id: ID;
  } ? P : never : never;
};
//#endregion
export { ApiKeyClientPlugin, Awaitable, DeepPartial, Expand, GoogleOneTapActionOptions, GoogleOneTapOptions, HasRequiredKeys, InferServerPlugin, LastLoginMethodClientConfig, LiteralNumber, LiteralString, LiteralUnion, OidcClientPlugin, OmitId, PreserveJSDoc, Prettify, PrettifyDeep, Primitive, RequiredKeysOf, StripEmptyObjects, UnionToIntersection, WithoutEmpty, adminClient, anonymousClient, apiKeyClient, clientSideHasPermission, customSessionClient, deviceAuthorizationClient, emailOTPClient, genericOAuthClient, inferAdditionalFields, inferOrgAdditionalFields, jwtClient, lastLoginMethodClient, magicLinkClient, multiSessionClient, oidcClient, oneTapClient, oneTimeTokenClient, organizationClient, phoneNumberClient, siweClient, twoFactorClient, usernameClient };