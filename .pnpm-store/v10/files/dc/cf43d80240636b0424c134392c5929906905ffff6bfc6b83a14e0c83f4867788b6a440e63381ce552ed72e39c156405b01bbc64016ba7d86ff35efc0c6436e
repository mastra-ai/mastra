// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as GroupsAPI from './groups';
import { GroupListParams, Groups } from './groups';
import * as UsersAPI from './users';
import { UserListParams, Users } from './users';

export class SCIM extends APIResource {
  groups: GroupsAPI.Groups = new GroupsAPI.Groups(this._client);
  users: UsersAPI.Users = new UsersAPI.Users(this._client);
}

SCIM.Groups = Groups;
SCIM.Users = Users;

export declare namespace SCIM {
  export { Groups as Groups, type GroupListParams as GroupListParams };

  export { Users as Users, type UserListParams as UserListParams };
}
