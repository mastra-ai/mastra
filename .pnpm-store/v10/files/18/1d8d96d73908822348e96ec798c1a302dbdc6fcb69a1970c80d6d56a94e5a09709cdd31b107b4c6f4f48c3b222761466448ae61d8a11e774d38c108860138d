import * as z from "zod/v4";
import { OpenEnum } from "../../types/enums.js";
import { Result as SafeParseResult } from "../../types/fp.js";
import { SDKValidationError } from "../errors/sdkvalidationerror.js";
/**
 * The method used to generate the code challenge
 */
export declare const ExchangeAuthCodeForAPIKeyCodeChallengeMethod: {
    readonly S256: "S256";
    readonly Plain: "plain";
};
/**
 * The method used to generate the code challenge
 */
export type ExchangeAuthCodeForAPIKeyCodeChallengeMethod = OpenEnum<typeof ExchangeAuthCodeForAPIKeyCodeChallengeMethod>;
export type ExchangeAuthCodeForAPIKeyRequest = {
    /**
     * The authorization code received from the OAuth redirect
     */
    code: string;
    /**
     * The code verifier if code_challenge was used in the authorization request
     */
    codeVerifier?: string | undefined;
    /**
     * The method used to generate the code challenge
     */
    codeChallengeMethod?: ExchangeAuthCodeForAPIKeyCodeChallengeMethod | null | undefined;
};
/**
 * Successfully exchanged code for an API key
 */
export type ExchangeAuthCodeForAPIKeyResponse = {
    /**
     * The API key to use for OpenRouter requests
     */
    key: string;
    /**
     * User ID associated with the API key
     */
    userId: string | null;
};
/** @internal */
export declare const ExchangeAuthCodeForAPIKeyCodeChallengeMethod$outboundSchema: z.ZodType<string, ExchangeAuthCodeForAPIKeyCodeChallengeMethod>;
/** @internal */
export type ExchangeAuthCodeForAPIKeyRequest$Outbound = {
    code: string;
    code_verifier?: string | undefined;
    code_challenge_method?: string | null | undefined;
};
/** @internal */
export declare const ExchangeAuthCodeForAPIKeyRequest$outboundSchema: z.ZodType<ExchangeAuthCodeForAPIKeyRequest$Outbound, ExchangeAuthCodeForAPIKeyRequest>;
export declare function exchangeAuthCodeForAPIKeyRequestToJSON(exchangeAuthCodeForAPIKeyRequest: ExchangeAuthCodeForAPIKeyRequest): string;
/** @internal */
export declare const ExchangeAuthCodeForAPIKeyResponse$inboundSchema: z.ZodType<ExchangeAuthCodeForAPIKeyResponse, unknown>;
export declare function exchangeAuthCodeForAPIKeyResponseFromJSON(jsonString: string): SafeParseResult<ExchangeAuthCodeForAPIKeyResponse, SDKValidationError>;
//# sourceMappingURL=exchangeauthcodeforapikey.d.ts.map