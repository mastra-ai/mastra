// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AvailabilitiesAPI from "./availabilities.mjs";
import { Availabilities } from "./availabilities.mjs";
import * as ScheduleAPI from "./schedule.mjs";
import { ScheduleResource, } from "./schedule.mjs";
import * as PagesAPI from "./pages/pages.mjs";
import { PageListResponsesSinglePage, Pages, } from "./pages/pages.mjs";
export class Speed extends APIResource {
    constructor() {
        super(...arguments);
        this.schedule = new ScheduleAPI.ScheduleResource(this._client);
        this.availabilities = new AvailabilitiesAPI.Availabilities(this._client);
        this.pages = new PagesAPI.Pages(this._client);
    }
}
Speed.ScheduleResource = ScheduleResource;
Speed.Availabilities = Availabilities;
Speed.Pages = Pages;
Speed.PageListResponsesSinglePage = PageListResponsesSinglePage;
//# sourceMappingURL=speed.mjs.map