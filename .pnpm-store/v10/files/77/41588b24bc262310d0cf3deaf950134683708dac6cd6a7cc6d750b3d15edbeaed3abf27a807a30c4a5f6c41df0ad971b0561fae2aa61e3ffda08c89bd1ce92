import { DeepgramVersionError } from "./lib/errors";
import { AbstractClient, AgentLiveClient, AuthRestClient, ListenClient, ManageClient, ReadClient, SelfHostedRestClient, SpeakClient, ModelsRestClient, } from "./packages";
/**
 * The DeepgramClient class provides access to various Deepgram API clients, including ListenClient, ManageClient, SelfHostedRestClient, ReadClient, and SpeakClient.
 *
 * @see https://github.com/deepgram/deepgram-js-sdk
 */
export default class DeepgramClient extends AbstractClient {
    /**
     * Returns a new instance of the AuthRestClient, which provides access to the Deepgram API's temporary token endpoints.
     *
     * @returns {AuthRestClient} A new instance of the AuthRestClient.
     * @see https://developers.deepgram.com/reference/token-based-auth-api/grant-token
     */
    get auth() {
        return new AuthRestClient(this.options);
    }
    /**
     * Returns a new instance of the ListenClient, which provides access to the Deepgram API's listening functionality.
     *
     * @returns {ListenClient} A new instance of the ListenClient.
     */
    get listen() {
        return new ListenClient(this.options);
    }
    /**
     * Returns a new instance of the ManageClient, which provides access to the Deepgram API's management functionality.
     *
     * @returns {ManageClient} A new instance of the ManageClient.
     */
    get manage() {
        return new ManageClient(this.options);
    }
    /**
     * Returns a new instance of the ModelsRestClient, which provides access to the Deepgram API's model functionality.
     *
     * @returns {ModelsRestClient} A new instance of the ModelsRestClient.
     */
    get models() {
        return new ModelsRestClient(this.options);
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
        return new SelfHostedRestClient(this.options);
    }
    /**
     * Returns a new instance of the ReadClient, which provides access to the Deepgram API's reading functionality.
     *
     * @returns {ReadClient} A new instance of the ReadClient.
     */
    get read() {
        return new ReadClient(this.options);
    }
    /**
     * Returns a new instance of the SpeakClient, which provides access to the Deepgram API's speaking functionality.
     *
     * @returns {SpeakClient} A new instance of the SpeakClient.
     */
    get speak() {
        return new SpeakClient(this.options);
    }
    /**
     * Returns a new instance of the AgentLiveClient, which provides access to Deepgram's Voice Agent API.
     *
     * @returns {AgentLiveClient} A new instance of the AgentLiveClient.
     * @beta
     */
    agent(endpoint = "/:version/agent/converse") {
        return new AgentLiveClient(this.options, endpoint);
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get transcription() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get projects() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get keys() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get members() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get scopes() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get invitation() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get usage() {
        throw new DeepgramVersionError();
    }
    /**
     * @deprecated
     * @see https://dpgr.am/js-v3
     */
    get billing() {
        throw new DeepgramVersionError();
    }
}
//# sourceMappingURL=DeepgramClient.js.map