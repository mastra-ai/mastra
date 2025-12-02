"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserManager = exports.Group = exports.UserAndMetadata = exports.User = exports.RoleAndOrigin = exports.RoleAndDescription = exports.Role = exports.Origin = void 0;
const bindingutilities_1 = require("./bindingutilities");
const utilities_1 = require("./utilities");
/**
 * Contains information about an origin for a role.
 *
 * @category Management
 */
class Origin {
    /**
     * @internal
     */
    constructor(data) {
        this.type = data.type;
        this.name = data.name;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new Origin({
            type: data.type,
            name: data.name,
        });
    }
}
exports.Origin = Origin;
/**
 * Contains information about a role.
 *
 * @category Management
 */
class Role {
    /**
     * @internal
     */
    constructor(data) {
        this.name = data.name;
        this.bucket = data.bucket;
        this.scope = data.scope;
        this.collection = data.collection;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new Role({
            name: data.name,
            bucket: data.bucket,
            scope: data.scope,
            collection: data.collection,
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        return {
            name: data.name,
            bucket: data.bucket,
            scope: data.scope,
            collection: data.collection,
        };
    }
}
exports.Role = Role;
/**
 * Contains information about a role along with its description.
 *
 * @category Management
 */
class RoleAndDescription extends Role {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.displayName = data.displayName;
        this.description = data.description;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        const role = Role._fromCppData(data);
        return new RoleAndDescription({
            ...role,
            displayName: data.name,
            description: data.description,
        });
    }
}
exports.RoleAndDescription = RoleAndDescription;
/**
 * Contains information about a role along with its origin.
 *
 * @category Management
 */
class RoleAndOrigin extends Role {
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.origins = data.origins;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        const origins = data.origins.map((origin) => Origin._fromCppData(origin));
        return new RoleAndOrigin({
            ...Role._fromCppData({
                name: data.name,
                bucket: data.bucket,
                scope: data.scope,
                collection: data.collection,
            }),
            origins,
        });
    }
}
exports.RoleAndOrigin = RoleAndOrigin;
/**
 * Contains information about a user.
 *
 * @category Management
 */
class User {
    /**
     * @internal
     */
    constructor(data) {
        this.username = data.username;
        this.displayName = data.displayName;
        this.groups = data.groups;
        this.roles = data.roles;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new User({
            username: data.username,
            displayName: data.display_name,
            groups: data.groups,
            roles: data.roles.map((role) => Role._fromCppData(role)),
            password: undefined,
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        const roles = [];
        if (data.roles) {
            data.roles.forEach((role) => {
                if (typeof role === 'string') {
                    roles.push({
                        name: role,
                    });
                }
                else {
                    roles.push(Role._toCppData(role));
                }
            });
        }
        return {
            username: data.username,
            display_name: data.displayName,
            groups: data.groups ? data.groups : [],
            roles: roles,
            password: data.password,
        };
    }
}
exports.User = User;
/**
 * Contains information about a user along with some additional meta-data
 * about that user.
 *
 * @category Management
 */
class UserAndMetadata extends User {
    /**
     * Same as {@link effectiveRoles}, which already contains the roles
     * including their origins.
     *
     * @deprecated Use {@link effectiveRoles} instead.
     */
    get effectiveRolesAndOrigins() {
        return this.effectiveRoles;
    }
    /**
     * @internal
     */
    constructor(data) {
        super(data);
        this.domain = data.domain;
        this.effectiveRoles = data.effectiveRoles;
        this.passwordChanged = data.passwordChanged;
        this.externalGroups = data.externalGroups;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        const user = User._fromCppData({
            username: data.username,
            display_name: data.display_name,
            groups: data.groups,
            roles: data.roles,
            password: data.password,
        });
        const effectiveRoles = data.effective_roles.map((erole) => RoleAndOrigin._fromCppData(erole));
        return new UserAndMetadata({
            ...user,
            domain: (0, bindingutilities_1.authDomainFromCpp)(data.domain),
            effectiveRoles: effectiveRoles,
            effectiveRolesAndOrigins: effectiveRoles,
            passwordChanged: data.password_changed
                ? new Date(data.password_changed)
                : undefined,
            externalGroups: data.external_groups,
        });
    }
}
exports.UserAndMetadata = UserAndMetadata;
/**
 * Contains information about a group.
 *
 * @category Management
 */
class Group {
    /**
     * @internal
     */
    constructor(data) {
        this.name = data.name;
        this.description = data.description;
        this.roles = data.roles;
        this.ldapGroupReference = data.ldapGroupReference;
    }
    /**
     * @internal
     */
    static _fromCppData(data) {
        return new Group({
            name: data.name,
            description: data.description || '',
            roles: data.roles.map((role) => Role._fromCppData(role)),
            ldapGroupReference: data.ldap_group_reference,
        });
    }
    /**
     * @internal
     */
    static _toCppData(data) {
        const roles = [];
        if (data.roles) {
            data.roles.forEach((role) => {
                if (typeof role === 'string') {
                    roles.push({
                        name: role,
                    });
                }
                else {
                    roles.push(Role._toCppData(role));
                }
            });
        }
        return {
            name: data.name,
            description: data.description,
            roles: roles,
            ldap_group_reference: data.ldapGroupReference,
        };
    }
}
exports.Group = Group;
/**
 * UserManager is an interface which enables the management of users,
 * groups and roles for the cluster.
 *
 * @category Management
 */
class UserManager {
    /**
     * @internal
     */
    constructor(cluster) {
        this._cluster = cluster;
    }
    /**
     * Returns a specific user by their username.
     *
     * @param username The username of the user to fetch.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getUser(username, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const cppDomain = (0, bindingutilities_1.authDomainToCpp)(options.domainName || 'local');
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementUserGet({
                username: username,
                domain: cppDomain,
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(null, UserAndMetadata._fromCppData(resp.user));
            });
        }, callback);
    }
    /**
     * Returns a list of all existing users.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllUsers(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const cppDomain = (0, bindingutilities_1.authDomainToCpp)(options.domainName || 'local');
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementUserGetAll({
                domain: cppDomain,
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const users = resp.users.map((user) => UserAndMetadata._fromCppData(user));
                wrapCallback(null, users);
            });
        }, callback);
    }
    /**
     * Creates or updates an existing user.
     *
     * @param user The user to update.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async upsertUser(user, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const cppDomain = (0, bindingutilities_1.authDomainToCpp)(options.domainName || 'local');
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementUserUpsert({
                user: User._toCppData(user),
                domain: cppDomain,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Change password for the currently authenticatd user.
     *
     * @param newPassword The new password to be applied.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async changePassword(newPassword, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementChangePassword({
                newPassword: newPassword,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Drops an existing user.
     *
     * @param username The username of the user to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropUser(username, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const cppDomain = (0, bindingutilities_1.authDomainToCpp)(options.domainName || 'local');
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementUserDrop({
                username: username,
                domain: cppDomain,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Returns a list of roles available on the server.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getRoles(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementRoleGetAll({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const roles = resp.roles.map((role) => Role._fromCppData(role));
                wrapCallback(null, roles);
            });
        }, callback);
    }
    /**
     * Returns a group by it's name.
     *
     * @param groupName The name of the group to retrieve.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getGroup(groupName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementGroupGet({
                name: groupName,
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(null, Group._fromCppData(resp.group));
            });
        }, callback);
    }
    /**
     * Returns a list of all existing groups.
     *
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async getAllGroups(options, callback) {
        if (options instanceof Function) {
            callback = arguments[0];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementGroupGetAll({
                timeout: timeout,
            }, (cppErr, resp) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                const groups = resp.groups.map((group) => Group._fromCppData(group));
                wrapCallback(null, groups);
            });
        }, callback);
    }
    /**
     * Creates or updates an existing group.
     *
     * @param group The group to update.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async upsertGroup(group, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementGroupUpsert({
                group: Group._toCppData(group),
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
    /**
     * Drops an existing group.
     *
     * @param groupName The name of the group to drop.
     * @param options Optional parameters for this operation.
     * @param callback A node-style callback to be invoked after execution.
     */
    async dropGroup(groupName, options, callback) {
        if (options instanceof Function) {
            callback = arguments[1];
            options = undefined;
        }
        if (!options) {
            options = {};
        }
        const timeout = options.timeout || this._cluster.managementTimeout;
        return utilities_1.PromiseHelper.wrap((wrapCallback) => {
            this._cluster.conn.managementGroupDrop({
                name: groupName,
                timeout: timeout,
            }, (cppErr) => {
                const err = (0, bindingutilities_1.errorFromCpp)(cppErr);
                if (err) {
                    return wrapCallback(err, null);
                }
                wrapCallback(err);
            });
        }, callback);
    }
}
exports.UserManager = UserManager;
