import { IRestResponse } from "../common.browser/Exports.js";
import { IAuthentication, SynthesizerConfig } from "./Exports.js";
/**
 * Implements methods for speaker recognition classes, sending requests to endpoint
 * and parsing response into expected format
 * @class SynthesisRestAdapter
 */
export declare class SynthesisRestAdapter {
    private privRestAdapter;
    private privUri;
    private privAuthentication;
    constructor(config: SynthesizerConfig, authentication: IAuthentication);
    /**
     * Sends list voices request to endpoint.
     * @function
     * @public
     * @param connectionId - guid for connectionId
     * @returns {Promise<IRestResponse>} rest response to status request
     */
    getVoicesList(connectionId: string): Promise<IRestResponse>;
}
