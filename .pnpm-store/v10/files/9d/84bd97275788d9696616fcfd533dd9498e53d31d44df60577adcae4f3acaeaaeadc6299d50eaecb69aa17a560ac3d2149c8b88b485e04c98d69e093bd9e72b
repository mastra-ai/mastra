import * as _better_auth_core0 from "@better-auth/core";
import { BetterAuthOptions } from "@better-auth/core";
import * as _better_auth_core_db0 from "@better-auth/core/db";

//#region src/types.d.ts

interface TelemetryEvent {
  type: string;
  anonymousId?: string | undefined;
  payload: Record<string, any>;
}
interface TelemetryContext {
  customTrack?: ((event: TelemetryEvent) => Promise<void>) | undefined;
  database?: string | undefined;
  adapter?: string | undefined;
  skipTestCheck?: boolean | undefined;
}
//#endregion
//#region src/detectors/detect-auth-config.d.ts
declare function getTelemetryAuthConfig(options: BetterAuthOptions, context?: TelemetryContext | undefined): {
  database: string | undefined;
  adapter: string | undefined;
  emailVerification: {
    sendVerificationEmail: boolean;
    sendOnSignUp: boolean;
    sendOnSignIn: boolean;
    autoSignInAfterVerification: boolean;
    expiresIn: number | undefined;
    onEmailVerification: boolean;
    afterEmailVerification: boolean;
  };
  emailAndPassword: {
    enabled: boolean;
    disableSignUp: boolean;
    requireEmailVerification: boolean;
    maxPasswordLength: number | undefined;
    minPasswordLength: number | undefined;
    sendResetPassword: boolean;
    resetPasswordTokenExpiresIn: number | undefined;
    onPasswordReset: boolean;
    password: {
      hash: boolean;
      verify: boolean;
    };
    autoSignIn: boolean;
    revokeSessionsOnPasswordReset: boolean;
  };
  socialProviders: ({
    id?: undefined;
    mapProfileToUser?: undefined;
    disableDefaultScope?: undefined;
    disableIdTokenSignIn?: undefined;
    disableImplicitSignUp?: undefined;
    disableSignUp?: undefined;
    getUserInfo?: undefined;
    overrideUserInfoOnSignIn?: undefined;
    prompt?: undefined;
    verifyIdToken?: undefined;
    scope?: undefined;
    refreshAccessToken?: undefined;
  } | {
    id: string;
    mapProfileToUser: boolean;
    disableDefaultScope: boolean;
    disableIdTokenSignIn: boolean;
    disableImplicitSignUp: boolean | undefined;
    disableSignUp: boolean | undefined;
    getUserInfo: boolean;
    overrideUserInfoOnSignIn: boolean;
    prompt: "select_account" | "consent" | "login" | "none" | "select_account consent" | undefined;
    verifyIdToken: boolean;
    scope: string[] | undefined;
    refreshAccessToken: boolean;
  })[];
  plugins: string[] | undefined;
  user: {
    modelName: string | undefined;
    fields: Partial<Record<"createdAt" | "updatedAt" | "email" | "emailVerified" | "name" | "image", string>> | undefined;
    additionalFields: {
      [key: string]: _better_auth_core_db0.DBFieldAttribute;
    } | undefined;
    changeEmail: {
      enabled: boolean | undefined;
      sendChangeEmailVerification: boolean;
    };
  };
  verification: {
    modelName: string | undefined;
    disableCleanup: boolean | undefined;
    fields: Partial<Record<"createdAt" | "updatedAt" | "value" | "expiresAt" | "identifier", string>> | undefined;
  };
  session: {
    modelName: string | undefined;
    additionalFields: {
      [key: string]: _better_auth_core_db0.DBFieldAttribute;
    } | undefined;
    cookieCache: {
      enabled: boolean | undefined;
      maxAge: number | undefined;
      strategy: "compact" | "jwt" | "jwe" | undefined;
    };
    disableSessionRefresh: boolean | undefined;
    expiresIn: number | undefined;
    fields: Partial<Record<"createdAt" | "updatedAt" | "expiresAt" | "userId" | "token" | "ipAddress" | "userAgent", string>> | undefined;
    freshAge: number | undefined;
    preserveSessionInDatabase: boolean | undefined;
    storeSessionInDatabase: boolean | undefined;
    updateAge: number | undefined;
  };
  account: {
    modelName: string | undefined;
    fields: Partial<Record<"createdAt" | "updatedAt" | "userId" | "providerId" | "accountId" | "accessToken" | "refreshToken" | "idToken" | "accessTokenExpiresAt" | "refreshTokenExpiresAt" | "scope" | "password", string>> | undefined;
    encryptOAuthTokens: boolean | undefined;
    updateAccountOnSignIn: boolean | undefined;
    accountLinking: {
      enabled: boolean | undefined;
      trustedProviders: _better_auth_core0.LiteralUnion<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | "email-password", string>[] | undefined;
      updateUserInfoOnLink: boolean | undefined;
      allowUnlinkingAll: boolean | undefined;
    };
  };
  hooks: {
    after: boolean;
    before: boolean;
  };
  secondaryStorage: boolean;
  advanced: {
    cookiePrefix: boolean;
    cookies: boolean;
    crossSubDomainCookies: {
      domain: boolean;
      enabled: boolean | undefined;
      additionalCookies: string[] | undefined;
    };
    database: {
      useNumberId: boolean;
      generateId: false | _better_auth_core0.GenerateIdFn | "serial" | "uuid" | undefined;
      defaultFindManyLimit: number | undefined;
    };
    useSecureCookies: boolean | undefined;
    ipAddress: {
      disableIpTracking: boolean | undefined;
      ipAddressHeaders: string[] | undefined;
    };
    disableCSRFCheck: boolean | undefined;
    cookieAttributes: {
      expires: Date | undefined;
      secure: boolean | undefined;
      sameSite: "none" | "Strict" | "Lax" | "None" | "strict" | "lax" | undefined;
      domain: boolean;
      path: string | undefined;
      httpOnly: boolean | undefined;
    };
  };
  trustedOrigins: number | undefined;
  rateLimit: {
    storage: "database" | "memory" | "secondary-storage" | undefined;
    modelName: string | undefined;
    window: number | undefined;
    customStorage: boolean;
    enabled: boolean | undefined;
    max: number | undefined;
  };
  onAPIError: {
    errorURL: string | undefined;
    onError: boolean;
    throw: boolean | undefined;
  };
  logger: {
    disabled: boolean | undefined;
    level: "error" | "info" | "warn" | "debug" | undefined;
    log: boolean;
  };
  databaseHooks: {
    user: {
      create: {
        after: boolean;
        before: boolean;
      };
      update: {
        after: boolean;
        before: boolean;
      };
    };
    session: {
      create: {
        after: boolean;
        before: boolean;
      };
      update: {
        after: boolean;
        before: boolean;
      };
    };
    account: {
      create: {
        after: boolean;
        before: boolean;
      };
      update: {
        after: boolean;
        before: boolean;
      };
    };
    verification: {
      create: {
        after: boolean;
        before: boolean;
      };
      update: {
        after: boolean;
        before: boolean;
      };
    };
  };
};
//#endregion
//#region src/index.d.ts
declare function createTelemetry(options: BetterAuthOptions, context?: TelemetryContext | undefined): Promise<{
  publish: (event: TelemetryEvent) => Promise<void>;
}>;
//#endregion
export { type TelemetryEvent, createTelemetry, getTelemetryAuthConfig };