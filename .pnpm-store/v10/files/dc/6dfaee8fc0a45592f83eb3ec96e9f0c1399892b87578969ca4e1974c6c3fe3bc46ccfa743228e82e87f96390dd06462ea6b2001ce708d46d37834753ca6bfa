// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as PayloadsAPI from "./payloads.mjs";
import { PayloadCreateResponsesSinglePage, PayloadDeleteResponsesSinglePage, PayloadListResponsesSinglePage, Payloads, } from "./payloads.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings } from "./settings.mjs";
export class ContentScanning extends APIResource {
    constructor() {
        super(...arguments);
        this.payloads = new PayloadsAPI.Payloads(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
    }
    /**
     * Disable Content Scanning.
     */
    disable(params, options) {
        const { zone_id } = params;
        return this._client.post(`/zones/${zone_id}/content-upload-scan/disable`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Enable Content Scanning.
     */
    enable(params, options) {
        const { zone_id } = params;
        return this._client.post(`/zones/${zone_id}/content-upload-scan/enable`, options)._thenUnwrap((obj) => obj.result);
    }
}
ContentScanning.Payloads = Payloads;
ContentScanning.PayloadCreateResponsesSinglePage = PayloadCreateResponsesSinglePage;
ContentScanning.PayloadListResponsesSinglePage = PayloadListResponsesSinglePage;
ContentScanning.PayloadDeleteResponsesSinglePage = PayloadDeleteResponsesSinglePage;
ContentScanning.Settings = Settings;
//# sourceMappingURL=content-scanning.mjs.map