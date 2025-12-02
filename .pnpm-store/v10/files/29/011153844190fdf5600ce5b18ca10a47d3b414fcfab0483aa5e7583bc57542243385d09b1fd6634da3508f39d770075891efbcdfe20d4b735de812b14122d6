import * as _better_auth_core10 from "@better-auth/core";

//#region src/plugins/haveibeenpwned/index.d.ts
interface HaveIBeenPwnedOptions {
  customPasswordCompromisedMessage?: string | undefined;
  /**
   * Paths to check for password
   *
   * @default ["/sign-up/email", "/change-password", "/reset-password"]
   */
  paths?: string[];
}
declare const haveIBeenPwned: (options?: HaveIBeenPwnedOptions | undefined) => {
  id: "haveIBeenPwned";
  init(ctx: _better_auth_core10.AuthContext): {
    context: {
      password: {
        hash(password: string): Promise<string>;
        verify: (data: {
          password: string;
          hash: string;
        }) => Promise<boolean>;
        config: {
          minPasswordLength: number;
          maxPasswordLength: number;
        };
        checkPassword: (userId: string, ctx: _better_auth_core10.GenericEndpointContext<_better_auth_core10.BetterAuthOptions>) => Promise<boolean>;
      };
    };
  };
  $ERROR_CODES: {
    readonly PASSWORD_COMPROMISED: "The password you entered has been compromised. Please choose a different password.";
  };
};
//#endregion
export { haveIBeenPwned as n, HaveIBeenPwnedOptions as t };