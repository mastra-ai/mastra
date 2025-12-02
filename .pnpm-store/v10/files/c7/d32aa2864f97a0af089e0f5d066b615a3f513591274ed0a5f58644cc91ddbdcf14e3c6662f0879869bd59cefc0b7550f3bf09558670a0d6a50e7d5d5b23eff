"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("./lib/errors");
const packages_1 = require("./packages");
/**
 * The DeepgramClient class provides access to various Deepgram API clients, including ListenClient, ManageClient, SelfHostedRestClient, ReadClient, and SpeakClient.
 *
 * @see https://github.com/deepgram/deepgram-js-sdk
 */
class DeepgramClient extends packages_1.AbstractClient {
    /**
     * Returns a new instance of the AuthRestClient, which provides access to the Deepgram API's temporary token endpoints.
     *
     * @returns {AuthRestClient} A new instance of the AuthRestClient.
     * @see https://developers.deepgram.com/reference/token-based-auth-api/grant-token
     */
    get auth() {
        return new packages_1.AuthRestClient(this.options);
    }
    /**
     * Returns a new instance of the ListenClient, which provides access to the Deepgram API's listening functionality.
     *
     * @returns {ListenClient} A new instance of the ListenClient.
     */
    get listen() {
        return new packages_1.ListenClient(this.options);
    }
    /**
     * Returns a new instance of the ManageClient, which provides access to the Deepgram API's management functionality.
     *
     * @returns {ManageClient} A new instance of the ManageClient.
     */
    get manage() {
        return new packages_1.ManageClient(this.options);
    }
    /**
     * Returns a new instance of the ModelsRestClient, which provides access to the Deepgram API's model functionality.
     *
     * @returns {ModelsRestClient} A new instance of the ModelsRestClient.
     */
    get models() {
        return new packages_1.ModelsRestClient(this.options);
    }
    /**
     * Returns a new instance of the SelfHostedRestClient, which provides access to the Deepgram API's self-hosted functionality.
     *
     * @returns {OnPremClient} A new instance of the SelfHostedRestClient named as OnPremClient.
     * @deprecated use selfhosted() instead
     */
    get onprem() {
        return this.selfhosted;
    }
    /**
     * Returns a new instance of the SelfHostedRestClient, which provides access to the Deepgram API's self-hosted functionality.
     *
     * @returns {SelfHostedRestClient} A new instance of the SelfHostedRestClient.
     */
    get selfhosted() {
        return new packages_1.SelfHostedRestClient(this.options);
    }
    /**
     * Returns a new instance of the ReadClient, which provides access to the Deepgram API's reading functionality.
     *
     * @returns {ReadClient} A new instance of the ReadClient.
     */
    get read() {
        return new packages_1.ReadClient(this.options);
    }
    /**
     * Returns a new instance of the SpeakClient, which provides access to the Deepgram API's speaking functionality.
     *
     * @returns {SpeakClient} A new instance of the SpeakClient.
     */
    get speak() {
        return new packages_1.SpeakClient(this.options);
    }
    /**
     * Returns a new instance of the AgentLiveClient, which provides access to Deepgram's Voice Agent API.
     *
     * @returns {AgentLiveClient} A new instance of the AgentLiveClient.
     * @beta
     */
    agent(endpoint = "/:version/agent/converse") {
        return new packages_1.AgentLiveClient(this.options, endpoint);
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get transcription() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get projects() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get keys() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get members() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get scopes() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get invitation() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get usage() {
        throw new errors_1.DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get billing() {
        throw new errors_1.DeepgramVersionError();
    }
}
exports.default = DeepgramClient;
//# sourceMappingURL=DeepgramClient.js.map