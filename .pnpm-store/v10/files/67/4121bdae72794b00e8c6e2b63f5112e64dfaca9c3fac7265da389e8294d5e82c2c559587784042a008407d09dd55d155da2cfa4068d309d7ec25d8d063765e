// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as GroupsAPI from "./groups.mjs";
import { Groups } from "./groups.mjs";
import * as UsersAPI from "./users.mjs";
import { Users } from "./users.mjs";
export class SCIM extends APIResource {
    constructor() {
        super(...arguments);
        this.groups = new GroupsAPI.Groups(this._client);
        this.users = new UsersAPI.Users(this._client);
    }
}
SCIM.Groups = Groups;
SCIM.Users = Users;
//# sourceMappingURL=scim.mjs.map