import type { DeepgramResponse } from "../lib/types/DeepgramResponse";
import type { GrantTokenResponse } from "../lib/types/GrantTokenResponse";
import { AbstractRestClient } from "./AbstractRestClient";
export declare class AuthRestClient extends AbstractRestClient {
    namespace: string;
    /**
     * Generates a new temporary token for the Deepgram API.
     * @param endpoint Optional custom endpoint to use for the request. Defaults to ":version/auth/grant".
     * @returns Object containing the result of the request or an error if one occurred. Result will contain access_token and expires_in properties.
     */
    grantToken(endpoint?: string): Promise<DeepgramResponse<GrantTokenResponse>>;
}
//# sourceMappingURL=AuthRestClient.d.ts.map