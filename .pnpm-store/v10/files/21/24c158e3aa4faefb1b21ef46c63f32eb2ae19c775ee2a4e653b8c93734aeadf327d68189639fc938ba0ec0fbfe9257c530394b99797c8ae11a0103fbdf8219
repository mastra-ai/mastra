import * as better_call232 from "better-call";
import * as z from "zod";

//#region src/plugins/one-tap/index.d.ts
interface OneTapOptions {
  /**
   * Disable the signup flow
   *
   * @default false
   */
  disableSignup?: boolean | undefined;
  /**
   * Google Client ID
   *
   * If a client ID is provided in the social provider configuration,
   * it will be used.
   */
  clientId?: string | undefined;
}
declare const oneTap: (options?: OneTapOptions | undefined) => {
  id: "one-tap";
  endpoints: {
    oneTapCallback: better_call232.StrictEndpoint<"/one-tap/callback", {
      method: "POST";
      body: z.ZodObject<{
        idToken: z.ZodString;
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
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      error: string;
    } | {
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
  };
};
//#endregion
export { oneTap as t };