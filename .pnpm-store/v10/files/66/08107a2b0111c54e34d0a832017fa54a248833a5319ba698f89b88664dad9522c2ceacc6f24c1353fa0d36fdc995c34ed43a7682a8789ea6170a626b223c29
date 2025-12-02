import * as _better_auth_core17 from "@better-auth/core";
import { GenericEndpointContext } from "@better-auth/core";
import * as _better_auth_core_db2 from "@better-auth/core/db";
import * as better_call201 from "better-call";
import * as z from "zod";

//#region src/plugins/email-otp/index.d.ts
interface EmailOTPOptions {
  /**
   * Function to send email verification.
   *
   * It is recommended to not await the email sending to avoid timing attacks.
   * On serverless platforms, use `waitUntil` or similar to ensure the email is sent.
   */
  sendVerificationOTP: (data: {
    email: string;
    otp: string;
    type: "sign-in" | "email-verification" | "forget-password";
  }, ctx?: GenericEndpointContext | undefined) => Promise<void>;
  /**
   * Length of the OTP
   *
   * @default 6
   */
  otpLength?: number | undefined;
  /**
   * Expiry time of the OTP in seconds
   *
   * @default 300 (5 minutes)
   */
  expiresIn?: number | undefined;
  /**
   * Custom function to generate otp
   */
  generateOTP?: (data: {
    email: string;
    type: "sign-in" | "email-verification" | "forget-password";
  }, ctx?: GenericEndpointContext) => string | undefined;
  /**
   * Send email verification on sign-up
   *
   * @Default false
   */
  sendVerificationOnSignUp?: boolean | undefined;
  /**
   * A boolean value that determines whether to prevent
   * automatic sign-up when the user is not registered.
   *
   * @Default false
   */
  disableSignUp?: boolean | undefined;
  /**
   * Allowed attempts for the OTP code
   * @default 3
   */
  allowedAttempts?: number | undefined;
  /**
   * Store the OTP in your database in a secure way
   * Note: This will not affect the OTP sent to the user, it will only affect the OTP stored in your database
   *
   * @default "plain"
   */
  storeOTP?: ("hashed" | "plain" | "encrypted" | {
    hash: (otp: string) => Promise<string>;
  } | {
    encrypt: (otp: string) => Promise<string>;
    decrypt: (otp: string) => Promise<string>;
  }) | undefined;
  /**
   * Override the default email verification to use email otp instead
   *
   * @default false
   */
  overrideDefaultEmailVerification?: boolean | undefined;
}
declare const emailOTP: (options: EmailOTPOptions) => {
  id: "email-otp";
  init(ctx: _better_auth_core17.AuthContext): {
    options: {
      emailVerification: {
        sendVerificationEmail(data: {
          user: _better_auth_core_db2.User;
          url: string;
          token: string;
        }, request: Request | undefined): Promise<void>;
      };
    };
  } | undefined;
  endpoints: {
    createVerificationOTP: better_call201.StrictEndpoint<"/email-otp/create-verification-otp", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        type: z.ZodEnum<{
          "sign-in": "sign-in";
          "email-verification": "email-verification";
          "forget-password": "forget-password";
        }>;
      }, z.core.$strip>;
      metadata: {
        SERVER_ONLY: true;
        openapi: {
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "string";
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, string>;
    /**
     * ### Endpoint
     *
     * GET `/email-otp/get-verification-otp`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.getVerificationOTP`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-email-otp-get-verification-otp)
     */
    getVerificationOTP: better_call201.StrictEndpoint<"/email-otp/get-verification-otp", {
      method: "GET";
      query: z.ZodObject<{
        email: z.ZodString;
        type: z.ZodEnum<{
          "sign-in": "sign-in";
          "email-verification": "email-verification";
          "forget-password": "forget-password";
        }>;
      }, z.core.$strip>;
      metadata: {
        SERVER_ONLY: true;
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      otp: {
                        type: string;
                        nullable: boolean;
                        description: string;
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
      otp: null;
    } | {
      otp: string;
    }>;
    /**
     * ### Endpoint
     *
     * GET `/email-otp/check-verification-otp`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.checkVerificationOTP`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-email-otp-check-verification-otp)
     */
    checkVerificationOTP: better_call201.StrictEndpoint<"/email-otp/check-verification-otp", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        type: z.ZodEnum<{
          "sign-in": "sign-in";
          "email-verification": "email-verification";
          "forget-password": "forget-password";
        }>;
        otp: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/email-otp/verify-email`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.verifyEmailOTP`
     *
     * **client:**
     * `authClient.emailOtp.verifyEmail`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-email-otp-verify-email)
     */
    verifyEmailOTP: better_call201.StrictEndpoint<"/email-otp/verify-email", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        otp: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            200: {
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
                        $ref: string;
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
      token: string;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        image: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
      };
    } | {
      status: boolean;
      token: null;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        image: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    /**
     * ### Endpoint
     *
     * POST `/sign-in/email-otp`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.signInEmailOTP`
     *
     * **client:**
     * `authClient.signIn.emailOtp`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-sign-in-email-otp)
     */
    signInEmailOTP: better_call201.StrictEndpoint<"/sign-in/email-otp", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        otp: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        description: string;
                      };
                      user: {
                        $ref: string;
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
      token: string;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        image: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    /**
     * ### Endpoint
     *
     * POST `/forget-password/email-otp`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.forgetPasswordEmailOTP`
     *
     * **client:**
     * `authClient.forgetPassword.emailOtp`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-forget-password-email-otp)
     */
    forgetPasswordEmailOTP: better_call201.StrictEndpoint<"/forget-password/email-otp", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                        description: string;
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/email-otp/reset-password`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.resetPasswordEmailOTP`
     *
     * **client:**
     * `authClient.emailOtp.resetPassword`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-email-otp-reset-password)
     */
    resetPasswordEmailOTP: better_call201.StrictEndpoint<"/email-otp/reset-password", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        otp: z.ZodString;
        password: z.ZodString;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              contnt: {
                "application/json": {
                  schema: {
                    type: string;
                    properties: {
                      success: {
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/email-otp/send-verification-otp`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.sendVerificationOTP`
     *
     * **client:**
     * `authClient.emailOtp.sendVerificationOtp`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/email-otp#api-method-email-otp-send-verification-otp)
     */
    sendVerificationOTP: better_call201.StrictEndpoint<"/email-otp/send-verification-otp", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        type: z.ZodEnum<{
          "sign-in": "sign-in";
          "email-verification": "email-verification";
          "forget-password": "forget-password";
        }>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
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
      success: boolean;
    }>;
  };
  hooks: {
    after: {
      matcher(context: _better_auth_core17.HookEndpointContext): boolean;
      handler: (inputContext: better_call201.MiddlewareInputContext<better_call201.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  $ERROR_CODES: {
    readonly OTP_EXPIRED: "OTP expired";
    readonly INVALID_OTP: "Invalid OTP";
    readonly TOO_MANY_ATTEMPTS: "Too many attempts";
  };
  rateLimit: ({
    pathMatcher(path: string): path is "/email-otp/send-verification-otp";
    window: number;
    max: number;
  } | {
    pathMatcher(path: string): path is "/email-otp/check-verification-otp";
    window: number;
    max: number;
  } | {
    pathMatcher(path: string): path is "/email-otp/verify-email";
    window: number;
    max: number;
  } | {
    pathMatcher(path: string): path is "/sign-in/email-otp";
    window: number;
    max: number;
  })[];
};
//#endregion
export { emailOTP as n, EmailOTPOptions as t };