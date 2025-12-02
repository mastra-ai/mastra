import { t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import * as better_call165 from "better-call";
import * as z from "zod";

//#region src/plugins/siwe/schema.d.ts
declare const schema: {
  walletAddress: {
    fields: {
      userId: {
        type: "string";
        references: {
          model: string;
          field: string;
        };
        required: true;
        index: true;
      };
      address: {
        type: "string";
        required: true;
      };
      chainId: {
        type: "number";
        required: true;
      };
      isPrimary: {
        type: "boolean";
        defaultValue: false;
      };
      createdAt: {
        type: "date";
        required: true;
      };
    };
  };
};
//#endregion
//#region src/plugins/siwe/types.d.ts

interface CacaoHeader {
  t: "caip122";
}
interface CacaoPayload {
  domain: string;
  aud: string;
  nonce: string;
  iss: string;
  version?: string | undefined;
  iat?: string | undefined;
  nbf?: string | undefined;
  exp?: string | undefined;
  statement?: string | undefined;
  requestId?: string | undefined;
  resources?: string[] | undefined;
  type?: string | undefined;
}
interface Cacao {
  h: CacaoHeader;
  p: CacaoPayload;
  s: {
    t: "eip191" | "eip1271";
    s: string;
    m?: string | undefined;
  };
}
interface SIWEVerifyMessageArgs {
  message: string;
  signature: string;
  address: string;
  chainId: number;
  cacao?: Cacao | undefined;
}
interface ENSLookupArgs {
  walletAddress: string;
}
interface ENSLookupResult {
  name: string;
  avatar: string;
}
//#endregion
//#region src/plugins/siwe/index.d.ts
interface SIWEPluginOptions {
  domain: string;
  emailDomainName?: string | undefined;
  anonymous?: boolean | undefined;
  getNonce: () => Promise<string>;
  verifyMessage: (args: SIWEVerifyMessageArgs) => Promise<boolean>;
  ensLookup?: ((args: ENSLookupArgs) => Promise<ENSLookupResult>) | undefined;
  schema?: InferOptionSchema<typeof schema> | undefined;
}
declare const siwe: (options: SIWEPluginOptions) => {
  id: "siwe";
  schema: {
    walletAddress: {
      fields: {
        userId: {
          type: "string";
          references: {
            model: string;
            field: string;
          };
          required: true;
          index: true;
        };
        address: {
          type: "string";
          required: true;
        };
        chainId: {
          type: "number";
          required: true;
        };
        isPrimary: {
          type: "boolean";
          defaultValue: false;
        };
        createdAt: {
          type: "date";
          required: true;
        };
      };
    };
  };
  endpoints: {
    getSiweNonce: better_call165.StrictEndpoint<"/siwe/nonce", {
      method: "POST";
      body: z.ZodObject<{
        walletAddress: z.ZodString;
        chainId: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
      }, z.core.$strip>;
    } & {
      use: any[];
    }, {
      nonce: string;
    }>;
    verifySiweMessage: better_call165.StrictEndpoint<"/siwe/verify", {
      method: "POST";
      body: z.ZodObject<{
        message: z.ZodString;
        signature: z.ZodString;
        walletAddress: z.ZodString;
        chainId: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        email: z.ZodOptional<z.ZodEmail>;
      }, z.core.$strip>;
      requireRequest: true;
    } & {
      use: any[];
    }, {
      token: string;
      success: boolean;
      user: {
        id: string;
        walletAddress: string;
        chainId: number;
      };
    }>;
  };
};
//#endregion
export { siwe as n, SIWEPluginOptions as t };