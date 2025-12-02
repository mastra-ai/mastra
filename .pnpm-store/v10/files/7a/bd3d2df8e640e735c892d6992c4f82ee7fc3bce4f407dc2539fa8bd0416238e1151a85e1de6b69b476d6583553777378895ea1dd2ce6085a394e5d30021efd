//#region src/error/codes.d.ts
declare const BASE_ERROR_CODES: {
  readonly USER_NOT_FOUND: "User not found";
  readonly FAILED_TO_CREATE_USER: "Failed to create user";
  readonly FAILED_TO_CREATE_SESSION: "Failed to create session";
  readonly FAILED_TO_UPDATE_USER: "Failed to update user";
  readonly FAILED_TO_GET_SESSION: "Failed to get session";
  readonly INVALID_PASSWORD: "Invalid password";
  readonly INVALID_EMAIL: "Invalid email";
  readonly INVALID_EMAIL_OR_PASSWORD: "Invalid email or password";
  readonly SOCIAL_ACCOUNT_ALREADY_LINKED: "Social account already linked";
  readonly PROVIDER_NOT_FOUND: "Provider not found";
  readonly INVALID_TOKEN: "Invalid token";
  readonly ID_TOKEN_NOT_SUPPORTED: "id_token not supported";
  readonly FAILED_TO_GET_USER_INFO: "Failed to get user info";
  readonly USER_EMAIL_NOT_FOUND: "User email not found";
  readonly EMAIL_NOT_VERIFIED: "Email not verified";
  readonly PASSWORD_TOO_SHORT: "Password too short";
  readonly PASSWORD_TOO_LONG: "Password too long";
  readonly USER_ALREADY_EXISTS: "User already exists.";
  readonly USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Use another email.";
  readonly EMAIL_CAN_NOT_BE_UPDATED: "Email can not be updated";
  readonly CREDENTIAL_ACCOUNT_NOT_FOUND: "Credential account not found";
  readonly SESSION_EXPIRED: "Session expired. Re-authenticate to perform this action.";
  readonly FAILED_TO_UNLINK_LAST_ACCOUNT: "You can't unlink your last account";
  readonly ACCOUNT_NOT_FOUND: "Account not found";
  readonly USER_ALREADY_HAS_PASSWORD: "User already has a password. Provide that to delete the account.";
};
//#endregion
//#region src/error/index.d.ts
declare class BetterAuthError extends Error {
  constructor(message: string, cause?: string | undefined);
}
//#endregion
export { BASE_ERROR_CODES, BetterAuthError };