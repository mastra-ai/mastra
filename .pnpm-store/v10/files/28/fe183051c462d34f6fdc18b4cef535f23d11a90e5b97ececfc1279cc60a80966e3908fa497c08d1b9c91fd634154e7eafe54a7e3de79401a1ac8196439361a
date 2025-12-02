import { Cluster } from './cluster';
import { CppManagementRbacGroup, CppManagementRbacOrigin, CppManagementRbacRole, CppManagementRbacRoleAndDescription, CppManagementRbacRoleAndOrigins, CppManagementRbacUser, CppManagementRbacUserAndMetadata } from './binding';
import { NodeCallback } from './utilities';
/**
 * Contains information about an origin for a role.
 *
 * @category Management
 */
export declare class Origin {
    /**
     * The type of this origin.
     */
    type: string;
    /**
     * The name of this origin.
     */
    name?: string;
    /**
     * @internal
     */
    constructor(data: Origin);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacOrigin): Origin;
}
/**
 * Contains information about a role.
 *
 * @category Management
 */
export declare class Role {
    /**
     * The name of the role.
     */
    name: string;
    /**
     * The bucket this role applies to.
     */
    bucket: string | undefined;
    /**
     * The scope this role applies to.
     */
    scope: string | undefined;
    /**
     * The collection this role applies to.
     */
    collection: string | undefined;
    /**
     * @internal
     */
    constructor(data: Role);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacRole): Role;
    /**
     * @internal
     */
    static _toCppData(data: Role): CppManagementRbacRole;
}
/**
 * Contains information about a role along with its description.
 *
 * @category Management
 */
export declare class RoleAndDescription extends Role {
    /**
     * The user-friendly display name for this role.
     */
    displayName: string;
    /**
     * The description of this role.
     */
    description: string;
    /**
     * @internal
     */
    constructor(data: RoleAndDescription);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacRoleAndDescription): RoleAndDescription;
}
/**
 * Contains information about a role along with its origin.
 *
 * @category Management
 */
export declare class RoleAndOrigin extends Role {
    /**
     * The origins for this role.
     */
    origins: Origin[];
    /**
     * @internal
     */
    constructor(data: RoleAndOrigin);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacRoleAndOrigins): RoleAndOrigin;
}
/**
 * Specifies information about a user.
 *
 * @category Management
 */
export interface IUser {
    /**
     * The username of the user.
     */
    username: string;
    /**
     * The display name of the user.
     */
    displayName?: string;
    /**
     * The groups associated with this user.
     */
    groups?: string[];
    /**
     * The roles associates with this user.
     */
    roles?: (Role | string)[];
    /**
     * The password for this user.
     */
    password?: string;
}
/**
 * Contains information about a user.
 *
 * @category Management
 */
export declare class User implements IUser {
    /**
     * The username of the user.
     */
    username: string;
    /**
     * The display name of the user.
     */
    displayName?: string;
    /**
     * The groups associated with this user.
     */
    groups: string[];
    /**
     * The roles associates with this user.
     */
    roles: Role[];
    /**
     * This is never populated in a result returned by the server.
     */
    password: undefined;
    /**
     * @internal
     */
    constructor(data: User);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacUser): User;
    /**
     * @internal
     */
    static _toCppData(data: IUser): CppManagementRbacUser;
}
/**
 * Contains information about a user along with some additional meta-data
 * about that user.
 *
 * @category Management
 */
export declare class UserAndMetadata extends User {
    /**
     * The domain this user is part of.
     */
    domain: string;
    /**
     * The effective roles that are associated with this user.
     */
    effectiveRoles: RoleAndOrigin[];
    /**
     * The last time the users password was changed.
     */
    passwordChanged?: Date;
    /**
     * The external groups that this user is associated with.
     */
    externalGroups: string[];
    /**
     * Same as {@link effectiveRoles}, which already contains the roles
     * including their origins.
     *
     * @deprecated Use {@link effectiveRoles} instead.
     */
    get effectiveRolesAndOrigins(): RoleAndOrigin[];
    /**
     * @internal
     */
    constructor(data: UserAndMetadata);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacUserAndMetadata): UserAndMetadata;
}
/**
 * Specifies information about a group.
 *
 * @category Management
 */
export interface IGroup {
    /**
     * The name of the group.
     */
    name: string;
    /**
     * The description for the group.
     */
    description?: string;
    /**
     * The roles which are associated with this group.
     */
    roles?: (Role | string)[];
    /**
     * The LDAP group that this group is associated with.
     */
    ldapGroupReference?: string;
}
/**
 * Contains information about a group.
 *
 * @category Management
 */
export declare class Group {
    /**
     * The name of the group.
     */
    name: string;
    /**
     * The description for the group.
     */
    description: string;
    /**
     * The roles which are associated with this group.
     */
    roles: Role[];
    /**
     * The LDAP group that this group is associated with.
     */
    ldapGroupReference: string | undefined;
    /**
     * @internal
     */
    constructor(data: Group);
    /**
     * @internal
     */
    static _fromCppData(data: CppManagementRbacGroup): Group;
    /**
     * @internal
     */
    static _toCppData(data: IGroup): CppManagementRbacGroup;
}
/**
 * @category Management
 */
export interface GetUserOptions {
    /**
     * The domain to look in for the user.
     */
    domainName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllUsersOptions {
    /**
     * The domain to look in for users.
     */
    domainName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UpsertUserOptions {
    /**
     * The domain to upsert the user within.
     */
    domainName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface ChangePasswordOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropUserOptions {
    /**
     * The domain to drop the user from.
     */
    domainName?: string;
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetRolesOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetGroupOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface GetAllGroupsOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface UpsertGroupOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * @category Management
 */
export interface DropGroupOptions {
    /**
     * The timeout for this operation, represented in milliseconds.
     */
    timeout?: number;
}
/**
 * UserManager is an interface which enables the management of users,
 * groups and roles for the cluster.
 *
 * @category Management
 */
export declare class UserManager {
    private _cluster;
    /**
     * @internal
     */
    constructor(cluster: Cluster);
    /**
     * Returns a specific user by their username.
     *
     * @param username The username of the user to fetch.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getUser(username: string, options?: GetUserOptions, callback?: NodeCallback<UserAndMetadata>): Promise<UserAndMetadata>;
    /**
     * Returns a list of all existing users.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllUsers(options?: GetAllUsersOptions, callback?: NodeCallback<UserAndMetadata[]>): Promise<UserAndMetadata[]>;
    /**
     * Creates or updates an existing user.
     *
     * @param user The user to update.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    upsertUser(user: IUser, options?: UpsertUserOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Change password for the currently authenticatd user.
     *
     * @param newPassword The new password to be applied.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    changePassword(newPassword: string, options?: ChangePasswordOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops an existing user.
     *
     * @param username The username of the user to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropUser(username: string, options?: DropUserOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Returns a list of roles available on the server.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getRoles(options?: GetRolesOptions, callback?: NodeCallback<Role[]>): Promise<Role[]>;
    /**
     * Returns a group by it's name.
     *
     * @param groupName The name of the group to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getGroup(groupName: string, options?: GetGroupOptions, callback?: NodeCallback<Group>): Promise<Group>;
    /**
     * Returns a list of all existing groups.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    getAllGroups(options?: GetAllGroupsOptions, callback?: NodeCallback<Group[]>): Promise<Group[]>;
    /**
     * Creates or updates an existing group.
     *
     * @param group The group to update.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    upsertGroup(group: IGroup, options?: UpsertGroupOptions, callback?: NodeCallback<void>): Promise<void>;
    /**
     * Drops an existing group.
     *
     * @param groupName The name of the group to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    dropGroup(groupName: string, options?: DropGroupOptions, callback?: NodeCallback<void>): Promise<void>;
}
