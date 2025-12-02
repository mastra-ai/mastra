"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisRestAdapter = void 0;
const Exports_js_1 = require("../common.browser/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const ConnectionFactoryBase_js_1 = require("./ConnectionFactoryBase.js");
const HeaderNames_js_1 = require("./HeaderNames.js");
/**
 * Implements methods for speaker recognition classes, sending requests to endpoint
 * and parsing response into expected format
 * @class SynthesisRestAdapter
 */
class SynthesisRestAdapter {
    constructor(config, authentication) {
        let endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, undefined);
        if (!endpoint) {
            const region = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, "westus");
            const hostSuffix = ConnectionFactoryBase_js_1.ConnectionFactoryBase.getHostSuffix(region);
            endpoint = config.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, `https://${region}.tts.speech${hostSuffix}`);
        }
        this.privUri = `${endpoint}/cognitiveservices/voices/list`;
        const options = Exports_js_1.RestConfigBase.requestOptions;
        this.privRestAdapter = new Exports_js_1.RestMessageAdapter(options);
        this.privAuthentication = authentication;
    }
    /**
     * Sends list voices request to endpoint.
     * @function
     * @public
     * @param connectionId - guid for connectionId
     * @returns {Promise<IRestResponse>} rest response to status request
     */
    getVoicesList(connectionId) {
        this.privRestAdapter.setHeaders(HeaderNames_js_1.HeaderNames.ConnectionId, connectionId);
        return this.privAuthentication.fetch(connectionId).then((authInfo) => {
            this.privRestAdapter.setHeaders(authInfo.headerName, authInfo.token);
            return this.privRestAdapter.request(Exports_js_1.RestRequestType.Get, this.privUri);
        });
    }
}
exports.SynthesisRestAdapter = SynthesisRestAdapter;

//# sourceMappingURL=SynthesisRestAdapter.js.map
