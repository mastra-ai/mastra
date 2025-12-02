import { _ as User } from "./index--CrC0_x3.mjs";
import { t as Awaitable } from "./helper-DU33OcfW.mjs";
import { t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import * as _better_auth_core15 from "@better-auth/core";
import { GenericEndpointContext } from "@better-auth/core";
import * as better_call174 from "better-call";
import * as z from "zod";

//#region src/plugins/phone-number/schema.d.ts
declare const schema: {
  user: {
    fields: {
      phoneNumber: {
        type: "string";
        required: false;
        unique: true;
        sortable: true;
        returned: true;
      };
      phoneNumberVerified: {
        type: "boolean";
        required: false;
        returned: true;
        input: false;
      };
    };
  };
};
//#endregion
//#region src/plugins/phone-number/types.d.ts
interface UserWithPhoneNumber extends User {
  phoneNumber: string;
  phoneNumberVerified: boolean;
}
interface PhoneNumberOptions {
  /**
   * Length of the OTP code
   * @default 6
   */
  otpLength?: number | undefined;
  /**
   * Send OTP code to the user
   *
   * @param phoneNumber
   * @param code
   * @returns
   */
  sendOTP: (data: {
    phoneNumber: string;
    code: string;
  }, ctx?: GenericEndpointContext | undefined) => Awaitable<void>;
  /**
   * Custom OTP verification function
   *
   * If provided, this function will be called instead of the internal verification logic.
   * This is useful when using SMS providers that handle their own OTP generation and verification.
   *
   * @param data - Contains phone number and OTP code
   * @param request - The request object
   * @returns true if OTP is valid, false otherwise
   */
  verifyOTP?: ((data: {
    phoneNumber: string;
    code: string;
  }, ctx?: GenericEndpointContext) => Awaitable<boolean>) | undefined;
  /**
   * a callback to send otp on user requesting to reset their password
   *
   * @param data - contains phone number and code
   * @param request - the request object
   * @returns
   */
  sendPasswordResetOTP?: ((data: {
    phoneNumber: string;
    code: string;
  }, ctx?: GenericEndpointContext) => Awaitable<void>) | undefined;
  /**
   * Expiry time of the OTP code in seconds
   * @default 300
   */
  expiresIn?: number | undefined;
  /**
   * Function to validate phone number
   *
   * by default any string is accepted
   */
  phoneNumberValidator?: ((phoneNumber: string) => Awaitable<boolean>) | undefined;
  /**
   * Require a phone number verification before signing in
   *
   * @default false
   */
  requireVerification?: boolean | undefined;
  /**
   * Callback when phone number is verified
   */
  callbackOnVerification?: ((data: {
    phoneNumber: string;
    user: UserWithPhoneNumber;
  }, ctx?: GenericEndpointContext) => Awaitable<void>) | undefined;
  /**
   * Sign up user after phone number verification
   *
   * the user will be signed up with the temporary email
   * and the phone number will be updated after verification
   */
  signUpOnVerification?: {
    /**
     * When a user signs up, a temporary email will be need to be created
     * to sign up the user. This function should return a temporary email
     * for the user given the phone number
     *
     * @param phoneNumber
     * @returns string (temporary email)
     */
    getTempEmail: (phoneNumber: string) => string;
    /**
     * When a user signs up, a temporary name will be need to be created
     * to sign up the user. This function should return a temporary name
     * for the user given the phone number
     *
     * @param phoneNumber
     * @returns string (temporary name)
     *
     * @default phoneNumber - the phone number will be used as the name
     */
    getTempName?: (phoneNumber: string) => string;
  } | undefined;
  /**
   * Custom schema for the admin plugin
   */
  schema?: InferOptionSchema<typeof schema> | undefined;
  /**
   * Allowed attempts for the OTP code
   * @default 3
   */
  allowedAttempts?: number | undefined;
}
//#endregion
//#region src/plugins/phone-number/index.d.ts
declare const phoneNumber: (options?: PhoneNumberOptions | undefined) => {
  id: "phone-number";
  hooks: {
    before: {
      matcher: (ctx: _better_auth_core15.HookEndpointContext) => boolean;
      handler: (inputContext: better_call174.MiddlewareInputContext<better_call174.MiddlewareOptions>) => Promise<never>;
    }[];
  };
  endpoints: {
    /**
     * ### Endpoint
     *
     * POST `/sign-in/phone-number`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.signInPhoneNumber`
     *
     * **client:**
     * `authClient.signIn.phoneNumber`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/phone-number#api-method-sign-in-phone-number)
     */
    signInPhoneNumber: better_call174.StrictEndpoint<"/sign-in/phone-number", {
      method: "POST";
      body: z.ZodObject<{
        phoneNumber: z.ZodString;
        password: z.ZodString;
        rememberMe: z.ZodOptional<z.ZodBoolean>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        $ref: string;
                      };
                      session: {
                        $ref: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      token: string;
      user: UserWithPhoneNumber;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/phone-number/send-otp`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.sendPhoneNumberOTP`
     *
     * **client:**
     * `authClient.phoneNumber.sendOtp`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/phone-number#api-method-phone-number-send-otp)
     */
    sendPhoneNumberOTP: better_call174.StrictEndpoint<"/phone-number/send-otp", {
      method: "POST";
      body: z.ZodObject<{
        phoneNumber: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      message: string;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/phone-number/verify`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.verifyPhoneNumber`
     *
     * **client:**
     * `authClient.phoneNumber.verify`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/phone-number#api-method-phone-number-verify)
     */
    verifyPhoneNumber: better_call174.StrictEndpoint<"/phone-number/verify", {
      method: "POST";
      body: z.ZodObject<{
        phoneNumber: z.ZodString;
        code: z.ZodString;
        disableSession: z.ZodOptional<z.ZodBoolean>;
        updatePhoneNumber: z.ZodOptional<z.ZodBoolean>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          summary: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                        enum: boolean[];
                      };
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        nullable: boolean;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          name: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          phoneNumber: {
                            type: string;
                            description: string;
                          };
                          phoneNumberVerified: {
                            type: string;
                            description: string;
                          };
                          createdAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          updatedAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                        };
                        required: string[];
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
      token: string;
      user: UserWithPhoneNumber;
    } | {
      status: boolean;
      token: null;
      user: UserWithPhoneNumber;
    }>;
    requestPasswordResetPhoneNumber: better_call174.StrictEndpoint<"/phone-number/request-password-reset", {
      method: "POST";
      body: z.ZodObject<{
        phoneNumber: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                        enum: boolean[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    resetPasswordPhoneNumber: better_call174.StrictEndpoint<"/phone-number/reset-password", {
      method: "POST";
      body: z.ZodObject<{
        otp: z.ZodString;
        phoneNumber: z.ZodString;
        newPassword: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                        enum: boolean[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
  };
  schema: {
    user: {
      fields: {
        phoneNumber: {
          type: "string";
          required: false;
          unique: true;
          sortable: true;
          returned: true;
        };
        phoneNumberVerified: {
          type: "boolean";
          required: false;
          returned: true;
          input: false;
        };
      };
    };
  };
  rateLimit: {
    pathMatcher(path: string): boolean;
    window: number;
    max: number;
  }[];
  $ERROR_CODES: {
    readonly INVALID_PHONE_NUMBER: "Invalid phone number";
    readonly PHONE_NUMBER_EXIST: "Phone number already exists";
    readonly PHONE_NUMBER_NOT_EXIST: "phone number isn't registered";
    readonly INVALID_PHONE_NUMBER_OR_PASSWORD: "Invalid phone number or password";
    readonly UNEXPECTED_ERROR: "Unexpected error";
    readonly OTP_NOT_FOUND: "OTP not found";
    readonly OTP_EXPIRED: "OTP expired";
    readonly INVALID_OTP: "Invalid OTP";
    readonly PHONE_NUMBER_NOT_VERIFIED: "Phone number not verified";
    readonly PHONE_NUMBER_CANNOT_BE_UPDATED: "Phone number cannot be updated";
    readonly SEND_OTP_NOT_IMPLEMENTED: "sendOTP not implemented";
    readonly TOO_MANY_ATTEMPTS: "Too many attempts";
  };
};
//#endregion
export { PhoneNumberOptions as n, UserWithPhoneNumber as r, phoneNumber as t };