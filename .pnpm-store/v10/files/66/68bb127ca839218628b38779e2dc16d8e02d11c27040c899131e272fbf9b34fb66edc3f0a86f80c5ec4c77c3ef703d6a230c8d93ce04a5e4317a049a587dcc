// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as VirtualNetworksAPI from "./virtual-networks.mjs";
import { VirtualNetworks, VirtualNetworksSinglePage, } from "./virtual-networks.mjs";
import * as RoutesAPI from "./routes/routes.mjs";
import { Routes, TeamnetsV4PagePaginationArray, } from "./routes/routes.mjs";
import * as SubnetsAPI from "./subnets/subnets.mjs";
import { SubnetListResponsesV4PagePaginationArray, Subnets, } from "./subnets/subnets.mjs";
export class Networks extends APIResource {
    constructor() {
        super(...arguments);
        this.routes = new RoutesAPI.Routes(this._client);
        this.virtualNetworks = new VirtualNetworksAPI.VirtualNetworks(this._client);
        this.subnets = new SubnetsAPI.Subnets(this._client);
    }
}
Networks.Routes = Routes;
Networks.TeamnetsV4PagePaginationArray = TeamnetsV4PagePaginationArray;
Networks.VirtualNetworks = VirtualNetworks;
Networks.VirtualNetworksSinglePage = VirtualNetworksSinglePage;
Networks.Subnets = Subnets;
Networks.SubnetListResponsesV4PagePaginationArray = SubnetListResponsesV4PagePaginationArray;
//# sourceMappingURL=networks.mjs.map