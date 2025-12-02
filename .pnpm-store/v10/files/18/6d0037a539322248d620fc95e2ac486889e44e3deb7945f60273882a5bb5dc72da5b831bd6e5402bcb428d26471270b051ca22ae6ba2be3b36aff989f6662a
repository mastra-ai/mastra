import { Gt as parseState, Wt as generateState, _ as User, s as Account } from "../index--CrC0_x3.mjs";
import "../types-CRiHq5rJ.mjs";
import "../helper-DU33OcfW.mjs";
import "../index-CNCxG_Zo.mjs";
import "../plugins-Brc8BsoZ.mjs";
import { AuthContext, GenericEndpointContext } from "@better-auth/core";
export * from "@better-auth/core/oauth2";

//#region src/oauth2/link-account.d.ts
declare function handleOAuthUserInfo(c: GenericEndpointContext, {
  userInfo,
  account,
  callbackURL,
  disableSignUp,
  overrideUserInfo
}: {
  userInfo: Omit<User, "createdAt" | "updatedAt">;
  account: Omit<Account, "id" | "userId" | "createdAt" | "updatedAt">;
  callbackURL?: string | undefined;
  disableSignUp?: boolean | undefined;
  overrideUserInfo?: boolean | undefined;
}): Promise<{
  error: string;
  data: null;
  isRegister?: undefined;
} | {
  error: string;
  data: null;
  isRegister: boolean;
} | {
  data: {
    session: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    };
    user: {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    };
  };
  error: null;
  isRegister: boolean;
}>;
//#endregion
//#region src/oauth2/utils.d.ts
declare function decryptOAuthToken(token: string, ctx: AuthContext): string | Promise<string>;
declare function setTokenUtil(token: string | null | undefined, ctx: AuthContext): string | Promise<string> | null | undefined;
//#endregion
export { decryptOAuthToken, generateState, handleOAuthUserInfo, parseState, setTokenUtil };