import * as better_call153 from "better-call";
import * as z from "zod";
import { StringValue } from "ms";

//#region src/plugins/device-authorization/index.d.ts
declare const deviceAuthorizationOptionsSchema: z.ZodObject<{
  expiresIn: z.ZodDefault<z.ZodCustom<StringValue, StringValue>>;
  interval: z.ZodDefault<z.ZodCustom<StringValue, StringValue>>;
  deviceCodeLength: z.ZodDefault<z.ZodNumber>;
  userCodeLength: z.ZodDefault<z.ZodNumber>;
  generateDeviceCode: z.ZodOptional<z.ZodCustom<() => string | Promise<string>, () => string | Promise<string>>>;
  generateUserCode: z.ZodOptional<z.ZodCustom<() => string | Promise<string>, () => string | Promise<string>>>;
  validateClient: z.ZodOptional<z.ZodCustom<(clientId: string) => boolean | Promise<boolean>, (clientId: string) => boolean | Promise<boolean>>>;
  onDeviceAuthRequest: z.ZodOptional<z.ZodCustom<(clientId: string, scope: string | undefined) => void | Promise<void>, (clientId: string, scope: string | undefined) => void | Promise<void>>>;
  verificationUri: z.ZodOptional<z.ZodString>;
  schema: z.ZodCustom<{
    deviceCode?: {
      modelName?: string | undefined;
      fields?: {
        deviceCode?: string | undefined;
        userCode?: string | undefined;
        userId?: string | undefined;
        expiresAt?: string | undefined;
        status?: string | undefined;
        lastPolledAt?: string | undefined;
        pollingInterval?: string | undefined;
        clientId?: string | undefined;
        scope?: string | undefined;
      } | undefined;
    } | undefined;
  }, {
    deviceCode?: {
      modelName?: string | undefined;
      fields?: {
        deviceCode?: string | undefined;
        userCode?: string | undefined;
        userId?: string | undefined;
        expiresAt?: string | undefined;
        status?: string | undefined;
        lastPolledAt?: string | undefined;
        pollingInterval?: string | undefined;
        clientId?: string | undefined;
        scope?: string | undefined;
      } | undefined;
    } | undefined;
  }>;
}, z.core.$strip>;
type DeviceAuthorizationOptions = z.infer<typeof deviceAuthorizationOptionsSchema>;
declare const deviceAuthorization: (options?: Partial<DeviceAuthorizationOptions>) => {
  id: "device-authorization";
  schema: {
    deviceCode: {
      fields: {
        deviceCode: {
          type: "string";
          required: true;
        };
        userCode: {
          type: "string";
          required: true;
        };
        userId: {
          type: "string";
          required: false;
        };
        expiresAt: {
          type: "date";
          required: true;
        };
        status: {
          type: "string";
          required: true;
        };
        lastPolledAt: {
          type: "date";
          required: false;
        };
        pollingInterval: {
          type: "number";
          required: false;
        };
        clientId: {
          type: "string";
          required: false;
        };
        scope: {
          type: "string";
          required: false;
        };
      };
    };
  };
  endpoints: {
    deviceCode: better_call153.StrictEndpoint<"/device/code", {
      method: "POST";
      body: z.ZodObject<{
        client_id: z.ZodString;
        scope: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
      error: z.ZodObject<{
        error: z.ZodEnum<{
          invalid_request: "invalid_request";
          invalid_client: "invalid_client";
        }>;
        error_description: z.ZodString;
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
                      device_code: {
                        type: string;
                        description: string;
                      };
                      user_code: {
                        type: string;
                        description: string;
                      };
                      verification_uri: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      verification_uri_complete: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      expires_in: {
                        type: string;
                        description: string;
                      };
                      interval: {
                        type: string;
                        description: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      error: {
                        type: string;
                        enum: string[];
                      };
                      error_description: {
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
      device_code: string;
      user_code: string;
      verification_uri: string;
      verification_uri_complete: string;
      expires_in: number;
      interval: number;
    }>;
    deviceToken: better_call153.StrictEndpoint<"/device/token", {
      method: "POST";
      body: z.ZodObject<{
        grant_type: z.ZodLiteral<"urn:ietf:params:oauth:grant-type:device_code">;
        device_code: z.ZodString;
        client_id: z.ZodString;
      }, z.core.$strip>;
      error: z.ZodObject<{
        error: z.ZodEnum<{
          invalid_request: "invalid_request";
          authorization_pending: "authorization_pending";
          slow_down: "slow_down";
          expired_token: "expired_token";
          access_denied: "access_denied";
          invalid_grant: "invalid_grant";
        }>;
        error_description: z.ZodString;
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
                      session: {
                        $ref: string;
                      };
                      user: {
                        $ref: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      error: {
                        type: string;
                        enum: string[];
                      };
                      error_description: {
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
      access_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    }>;
    deviceVerify: better_call153.StrictEndpoint<"/device", {
      method: "GET";
      query: z.ZodObject<{
        user_code: z.ZodString;
      }, z.core.$strip>;
      error: z.ZodObject<{
        error: z.ZodEnum<{
          invalid_request: "invalid_request";
        }>;
        error_description: z.ZodString;
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
                      user_code: {
                        type: string;
                        description: string;
                      };
                      status: {
                        type: string;
                        enum: string[];
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
      user_code: string;
      status: string;
    }>;
    deviceApprove: better_call153.StrictEndpoint<"/device/approve", {
      method: "POST";
      body: z.ZodObject<{
        userCode: z.ZodString;
      }, z.core.$strip>;
      error: z.ZodObject<{
        error: z.ZodEnum<{
          invalid_request: "invalid_request";
          expired_token: "expired_token";
          device_code_already_processed: "device_code_already_processed";
        }>;
        error_description: z.ZodString;
      }, z.core.$strip>;
      requireHeaders: true;
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
    deviceDeny: better_call153.StrictEndpoint<"/device/deny", {
      method: "POST";
      body: z.ZodObject<{
        userCode: z.ZodString;
      }, z.core.$strip>;
      error: z.ZodObject<{
        error: z.ZodEnum<{
          invalid_request: "invalid_request";
          expired_token: "expired_token";
        }>;
        error_description: z.ZodString;
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
  $ERROR_CODES: {
    readonly INVALID_DEVICE_CODE: "Invalid device code";
    readonly EXPIRED_DEVICE_CODE: "Device code has expired";
    readonly EXPIRED_USER_CODE: "User code has expired";
    readonly AUTHORIZATION_PENDING: "Authorization pending";
    readonly ACCESS_DENIED: "Access denied";
    readonly INVALID_USER_CODE: "Invalid user code";
    readonly DEVICE_CODE_ALREADY_PROCESSED: "Device code already processed";
    readonly POLLING_TOO_FREQUENTLY: "Polling too frequently";
    readonly USER_NOT_FOUND: "User not found";
    readonly FAILED_TO_CREATE_SESSION: "Failed to create session";
    readonly INVALID_DEVICE_CODE_STATUS: "Invalid device code status";
    readonly AUTHENTICATION_REQUIRED: "Authentication required";
  };
};
//#endregion
export { deviceAuthorization as n, deviceAuthorizationOptionsSchema as r, DeviceAuthorizationOptions as t };