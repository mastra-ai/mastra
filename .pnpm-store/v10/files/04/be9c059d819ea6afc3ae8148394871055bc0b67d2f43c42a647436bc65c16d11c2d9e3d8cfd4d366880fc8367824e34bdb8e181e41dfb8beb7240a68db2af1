// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as RoutingAPI from "./routing/routing.mjs";
import { Routing } from "./routing/routing.mjs";
import * as SecurityAPI from "./security/security.mjs";
import { Security } from "./security/security.mjs";
export class Email extends APIResource {
    constructor() {
        super(...arguments);
        this.routing = new RoutingAPI.Routing(this._client);
        this.security = new SecurityAPI.Security(this._client);
    }
}
Email.Routing = Routing;
Email.Security = Security;
//# sourceMappingURL=email.mjs.map