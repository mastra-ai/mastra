// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as CloudIntegrationsAPI from "./cloud-integrations.mjs";
import { CloudIntegrationListResponsesSinglePage, CloudIntegrations, } from "./cloud-integrations.mjs";
import * as ResourcesAPI from "./resources.mjs";
import { ResourceListResponsesV4PagePaginationArray, Resources, } from "./resources.mjs";
import * as CatalogSyncsAPI from "./catalog-syncs/catalog-syncs.mjs";
import { CatalogSyncListResponsesSinglePage, CatalogSyncs, } from "./catalog-syncs/catalog-syncs.mjs";
import * as OnRampsAPI from "./on-ramps/on-ramps.mjs";
import { OnRampListResponsesSinglePage, OnRamps, } from "./on-ramps/on-ramps.mjs";
export class MagicCloudNetworking extends APIResource {
    constructor() {
        super(...arguments);
        this.catalogSyncs = new CatalogSyncsAPI.CatalogSyncs(this._client);
        this.onRamps = new OnRampsAPI.OnRamps(this._client);
        this.cloudIntegrations = new CloudIntegrationsAPI.CloudIntegrations(this._client);
        this.resources = new ResourcesAPI.Resources(this._client);
    }
}
MagicCloudNetworking.CatalogSyncs = CatalogSyncs;
MagicCloudNetworking.CatalogSyncListResponsesSinglePage = CatalogSyncListResponsesSinglePage;
MagicCloudNetworking.OnRamps = OnRamps;
MagicCloudNetworking.OnRampListResponsesSinglePage = OnRampListResponsesSinglePage;
MagicCloudNetworking.CloudIntegrations = CloudIntegrations;
MagicCloudNetworking.CloudIntegrationListResponsesSinglePage = CloudIntegrationListResponsesSinglePage;
MagicCloudNetworking.Resources = Resources;
MagicCloudNetworking.ResourceListResponsesV4PagePaginationArray = ResourceListResponsesV4PagePaginationArray;
//# sourceMappingURL=magic-cloud-networking.mjs.map