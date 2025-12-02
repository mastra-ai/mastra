// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as DNSSECAPI from "./dnssec.mjs";
import { DNSSECResource, } from "./dnssec.mjs";
import * as RecordsAPI from "./records.mjs";
import { RecordResponsesV4PagePaginationArray, Records, } from "./records.mjs";
import * as AnalyticsAPI from "./analytics/analytics.mjs";
import { Analytics } from "./analytics/analytics.mjs";
import * as SettingsAPI from "./settings/settings.mjs";
import { Settings } from "./settings/settings.mjs";
import * as ZoneTransfersAPI from "./zone-transfers/zone-transfers.mjs";
import { ZoneTransfers } from "./zone-transfers/zone-transfers.mjs";
export class DNS extends APIResource {
    constructor() {
        super(...arguments);
        this.dnssec = new DNSSECAPI.DNSSECResource(this._client);
        this.records = new RecordsAPI.Records(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.analytics = new AnalyticsAPI.Analytics(this._client);
        this.zoneTransfers = new ZoneTransfersAPI.ZoneTransfers(this._client);
    }
}
DNS.DNSSECResource = DNSSECResource;
DNS.Records = Records;
DNS.RecordResponsesV4PagePaginationArray = RecordResponsesV4PagePaginationArray;
DNS.Settings = Settings;
DNS.Analytics = Analytics;
DNS.ZoneTransfers = ZoneTransfers;
//# sourceMappingURL=dns.mjs.map