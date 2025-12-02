import { _ as User, g as Session } from "./index--CrC0_x3.mjs";
import { BetterAuthCookies, BetterAuthOptions, GenericEndpointContext } from "@better-auth/core";
import { CookieOptions } from "better-call";
import "zod";

//#region src/cookies/cookie-utils.d.ts
interface CookieAttributes {
  value: string;
  "max-age"?: number | undefined;
  expires?: Date | undefined;
  domain?: string | undefined;
  path?: string | undefined;
  secure?: boolean | undefined;
  httponly?: boolean | undefined;
  samesite?: ("strict" | "lax" | "none") | undefined;
  [key: string]: any;
}
declare function parseSetCookieHeader(setCookie: string): Map<string, CookieAttributes>;
declare function setCookieToHeader(headers: Headers): (context: {
  response: Response;
}) => void;
//#endregion
//#region src/cookies/session-store.d.ts
interface Cookie {
  name: string;
  value: string;
  options: CookieOptions;
}
/**
 * Create a session store for handling cookie chunking.
 * When session data exceeds 4KB, it automatically splits it into multiple cookies.
 *
 * Based on next-auth's SessionStore implementation.
 * @see https://github.com/nextauthjs/next-auth/blob/27b2519b84b8eb9cf053775dea29d577d2aa0098/packages/next-auth/src/core/lib/cookie.ts
 */
declare function createSessionStore(cookieName: string, cookieOptions: CookieOptions, ctx: GenericEndpointContext): {
  /**
   * Get the full session data by joining all chunks
   */
  getValue(): string;
  /**
   * Check if there are existing chunks
   */
  hasChunks(): boolean;
  /**
   * Chunk a cookie value and return all cookies to set (including cleanup cookies)
   */
  chunk(value: string, options?: Partial<CookieOptions>): Cookie[];
  /**
   * Get cookies to clean up all chunks
   */
  clean(): Cookie[];
  /**
   * Set all cookies in the context
   */
  setCookies(cookies: Cookie[]): void;
};
declare function getChunkedCookie(ctx: GenericEndpointContext, cookieName: string): string | null;
//#endregion
//#region src/cookies/index.d.ts
declare function createCookieGetter(options: BetterAuthOptions): (cookieName: string, overrideAttributes?: Partial<CookieOptions>) => {
  name: string;
  attributes: CookieOptions;
};
declare function getCookies(options: BetterAuthOptions): {
  sessionToken: {
    name: string;
    options: CookieOptions;
  };
  /**
   * This cookie is used to store the session data in the cookie
   * This is useful for when you want to cache the session in the cookie
   */
  sessionData: {
    name: string;
    options: CookieOptions;
  };
  dontRememberToken: {
    name: string;
    options: CookieOptions;
  };
  accountData: {
    name: string;
    options: CookieOptions;
  };
};
declare function setCookieCache(ctx: GenericEndpointContext, session: {
  session: Session & Record<string, any>;
  user: User;
}, dontRememberMe: boolean): Promise<void>;
declare function setSessionCookie(ctx: GenericEndpointContext, session: {
  session: Session & Record<string, any>;
  user: User;
}, dontRememberMe?: boolean | undefined, overrides?: Partial<CookieOptions> | undefined): Promise<void>;
declare function deleteSessionCookie(ctx: GenericEndpointContext, skipDontRememberMe?: boolean | undefined): void;
declare function parseCookies(cookieHeader: string): Map<string, string>;
type EligibleCookies = (string & {}) | (keyof BetterAuthCookies & {});
declare const getSessionCookie: (request: Request | Headers, config?: {
  cookiePrefix?: string;
  cookieName?: string;
  path?: string;
} | undefined) => string | null;
declare const getCookieCache: <S extends {
  session: Session & Record<string, any>;
  user: User & Record<string, any>;
  updatedAt: number;
  version?: string;
}>(request: Request | Headers, config?: {
  cookiePrefix?: string;
  cookieName?: string;
  isSecure?: boolean;
  secret?: string;
  strategy?: "compact" | "jwt" | "jwe";
  version?: string | ((session: Session & Record<string, any>, user: User & Record<string, any>) => string) | ((session: Session & Record<string, any>, user: User & Record<string, any>) => Promise<string>);
} | undefined) => Promise<S | null>;
//#endregion
export { getCookies as a, setCookieCache as c, getChunkedCookie as d, parseSetCookieHeader as f, getCookieCache as i, setSessionCookie as l, createCookieGetter as n, getSessionCookie as o, setCookieToHeader as p, deleteSessionCookie as r, parseCookies as s, EligibleCookies as t, createSessionStore as u };