// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as UserAgentsAPI from "./user-agents.mjs";
import { UserAgents } from "./user-agents.mjs";
export class Top extends APIResource {
    constructor() {
        super(...arguments);
        this.userAgents = new UserAgentsAPI.UserAgents(this._client);
    }
    domainCategories(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.domainCategories({}, query);
        }
        return this._client.get('/radar/robots_txt/top/domain_categories', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Top.UserAgents = UserAgents;
//# sourceMappingURL=top.mjs.map