// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class DeviceType extends APIResource {
    get(deviceType, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(deviceType, {}, query);
        }
        return this._client.get(`/radar/http/top/locations/device_type/${deviceType}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=device-type.mjs.map