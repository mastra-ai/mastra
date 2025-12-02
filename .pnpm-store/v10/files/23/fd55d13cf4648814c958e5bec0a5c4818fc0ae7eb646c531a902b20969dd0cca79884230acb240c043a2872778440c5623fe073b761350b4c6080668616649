// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class UserAgents extends APIResource {
    directive(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.directive({}, query);
        }
        return this._client.get('/radar/robots_txt/top/user_agents/directive', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=user-agents.mjs.map