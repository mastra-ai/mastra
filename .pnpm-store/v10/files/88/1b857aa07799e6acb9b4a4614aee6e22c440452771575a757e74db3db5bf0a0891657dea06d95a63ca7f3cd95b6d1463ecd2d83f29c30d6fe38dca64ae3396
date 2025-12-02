// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as EligibleAPI from "./eligible.mjs";
import { Eligible } from "./eligible.mjs";
import * as PagerdutyAPI from "./pagerduty.mjs";
import { PagerdutiesSinglePage, PagerdutyResource, } from "./pagerduty.mjs";
import * as WebhooksAPI from "./webhooks.mjs";
import { WebhooksSinglePage, } from "./webhooks.mjs";
export class Destinations extends APIResource {
    constructor() {
        super(...arguments);
        this.eligible = new EligibleAPI.Eligible(this._client);
        this.pagerduty = new PagerdutyAPI.PagerdutyResource(this._client);
        this.webhooks = new WebhooksAPI.Webhooks(this._client);
    }
}
Destinations.Eligible = Eligible;
Destinations.PagerdutyResource = PagerdutyResource;
Destinations.PagerdutiesSinglePage = PagerdutiesSinglePage;
Destinations.WebhooksSinglePage = WebhooksSinglePage;
//# sourceMappingURL=destinations.mjs.map