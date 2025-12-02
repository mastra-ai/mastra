"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_fetch_mock_1 = require("jest-fetch-mock");
const workos_1 = require("../workos");
const interfaces_1 = require("./interfaces");
describe.skip('FGA Live Test', () => {
    let workos;
    beforeAll(() => {
        (0, jest_fetch_mock_1.disableFetchMocks)();
        workos = new workos_1.WorkOS('API_KEY');
    });
    afterAll(() => {
        (0, jest_fetch_mock_1.enableFetchMocks)();
    });
    it('CRUD resources', () => __awaiter(void 0, void 0, void 0, function* () {
        const resource1 = yield workos.fga.createResource({
            resource: { resourceType: 'document' },
        });
        expect(resource1.resourceType).toEqual('document');
        expect(resource1.resourceId).toBeDefined();
        expect(resource1.meta).toBeUndefined();
        let resource2 = yield workos.fga.createResource({
            resource: { resourceType: 'folder', resourceId: 'planning' },
        });
        let refetchedResource = yield workos.fga.getResource(resource2);
        expect(refetchedResource.resourceType).toEqual(resource2.resourceType);
        expect(refetchedResource.resourceId).toEqual(resource2.resourceId);
        expect(refetchedResource.meta).toEqual(resource2.meta);
        resource2 = yield workos.fga.updateResource({
            resource: { resourceType: 'folder', resourceId: 'planning' },
            meta: { description: 'Second document' },
        });
        refetchedResource = yield workos.fga.getResource(resource2);
        expect(refetchedResource.resourceType).toEqual(resource2.resourceType);
        expect(refetchedResource.resourceId).toEqual(resource2.resourceId);
        expect(refetchedResource.meta).toEqual(resource2.meta);
        let resourcesList = yield workos.fga.listResources({ limit: 10 });
        expect(resourcesList.data.length).toEqual(2);
        expect(resourcesList.data[0].resourceType).toEqual(resource2.resourceType);
        expect(resourcesList.data[0].resourceId).toEqual(resource2.resourceId);
        expect(resourcesList.data[1].resourceType).toEqual(resource1.resourceType);
        expect(resourcesList.data[1].resourceId).toEqual(resource1.resourceId);
        resourcesList = yield workos.fga.listResources({
            limit: 10,
            search: 'planning',
        });
        expect(resourcesList.data.length).toEqual(1);
        expect(resourcesList.data[0].resourceType).toEqual(resource2.resourceType);
        expect(resourcesList.data[0].resourceId).toEqual(resource2.resourceId);
        yield workos.fga.deleteResource(resource1);
        yield workos.fga.deleteResource(resource2);
        resourcesList = yield workos.fga.listResources({ limit: 10 });
        expect(resourcesList.data.length).toEqual(0);
    }));
    it('multi-tenancy example', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create users
        const user1 = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        const user2 = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        // Create tenants
        const tenant1 = yield workos.fga.createResource({
            resource: { resourceType: 'tenant', resourceId: 'tenant-1' },
            meta: { name: 'Tenant 1' },
        });
        const tenant2 = yield workos.fga.createResource({
            resource: { resourceType: 'tenant', resourceId: 'tenant-2' },
            meta: { name: 'Tenant 2' },
        });
        let user1TenantsList = yield workos.fga.query({
            q: `select tenant where user:${user1.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(user1TenantsList.data.length).toEqual(0);
        let tenant1UsersList = yield workos.fga.query({
            q: `select member of type user for tenant:${tenant1.resourceId}`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(tenant1UsersList.data.length).toEqual(0);
        // Assign user1 -> tenant1
        yield workos.fga.writeWarrant({
            resource: tenant1,
            relation: 'member',
            subject: user1,
        });
        user1TenantsList = yield workos.fga.query({
            q: `select tenant where user:${user1.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(user1TenantsList.data.length).toEqual(1);
        expect(user1TenantsList.data[0].resourceType).toEqual('tenant');
        expect(user1TenantsList.data[0].resourceId).toEqual('tenant-1');
        expect(user1TenantsList.data[0].meta).toEqual({ name: 'Tenant 1' });
        tenant1UsersList = yield workos.fga.query({
            q: `select member of type user for tenant:${tenant1.resourceId}`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(tenant1UsersList.data.length).toEqual(1);
        expect(tenant1UsersList.data[0].resourceType).toEqual('user');
        expect(tenant1UsersList.data[0].resourceId).toEqual(user1.resourceId);
        expect(tenant1UsersList.data[0].meta).toBeUndefined();
        // Remove user1 -> tenant1
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: tenant1,
            relation: 'member',
            subject: user1,
        });
        user1TenantsList = yield workos.fga.query({
            q: `select tenant where user:${user1.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(user1TenantsList.data.length).toEqual(0);
        tenant1UsersList = yield workos.fga.query({
            q: `select member of type user for tenant:${tenant1.resourceId}`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(tenant1UsersList.data.length).toEqual(0);
        // Clean up
        yield workos.fga.deleteResource(user1);
        yield workos.fga.deleteResource(user2);
        yield workos.fga.deleteResource(tenant1);
        yield workos.fga.deleteResource(tenant2);
    }));
    it('RBAC example', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create users
        const adminUser = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        const viewerUser = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        // Create roles
        const adminRole = yield workos.fga.createResource({
            resource: { resourceType: 'role', resourceId: 'admin' },
            meta: { name: 'Admin', description: 'The admin role' },
        });
        const viewerRole = yield workos.fga.createResource({
            resource: { resourceType: 'role', resourceId: 'viewer' },
            meta: { name: 'Viewer', description: 'The viewer role' },
        });
        // Create permissions
        const createPermission = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'create-report' },
            meta: {
                name: 'Create Report',
                description: 'Permission to create reports',
            },
        });
        const viewPermission = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'view-report' },
            meta: { name: 'View Report', description: 'Permission to view reports' },
        });
        let adminUserRolesList = yield workos.fga.query({
            q: `select role where user:${adminUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        let adminRolePermissionsList = yield workos.fga.query({
            q: `select permission where role:${adminRole.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(adminUserRolesList.data.length).toEqual(0);
        expect(adminRolePermissionsList.data.length).toEqual(0);
        let adminUserHasPermission = yield workos.fga.check({
            checks: [
                {
                    resource: createPermission,
                    relation: 'member',
                    subject: adminUser,
                },
            ],
        }, { warrantToken: 'latest' });
        expect(adminUserHasPermission.isAuthorized()).toEqual(false);
        // Assign 'create-report' -> admin role -> admin user
        yield workos.fga.writeWarrant({
            resource: createPermission,
            relation: 'member',
            subject: adminRole,
        });
        yield workos.fga.writeWarrant({
            resource: adminRole,
            relation: 'member',
            subject: adminUser,
        });
        adminUserHasPermission = yield workos.fga.check({
            checks: [
                {
                    resource: createPermission,
                    relation: 'member',
                    subject: adminUser,
                },
            ],
        }, { warrantToken: 'latest' });
        expect(adminUserHasPermission.isAuthorized()).toEqual(true);
        adminUserRolesList = yield workos.fga.query({
            q: `select role where user:${adminUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(adminUserRolesList.data.length).toEqual(1);
        expect(adminUserRolesList.data[0].resourceType).toEqual('role');
        expect(adminUserRolesList.data[0].resourceId).toEqual('admin');
        expect(adminUserRolesList.data[0].meta).toEqual({
            name: 'Admin',
            description: 'The admin role',
        });
        adminRolePermissionsList = yield workos.fga.query({
            q: `select permission where role:${adminRole.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(adminRolePermissionsList.data.length).toEqual(1);
        expect(adminRolePermissionsList.data[0].resourceType).toEqual('permission');
        expect(adminRolePermissionsList.data[0].resourceId).toEqual('create-report');
        expect(adminRolePermissionsList.data[0].meta).toEqual({
            name: 'Create Report',
            description: 'Permission to create reports',
        });
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: createPermission,
            relation: 'member',
            subject: adminRole,
        });
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: adminRole,
            relation: 'member',
            subject: adminUser,
        });
        adminUserHasPermission = yield workos.fga.check({
            checks: [
                {
                    resource: createPermission,
                    relation: 'member',
                    subject: adminUser,
                },
            ],
        }, { warrantToken: 'latest' });
        expect(adminUserHasPermission.isAuthorized()).toEqual(false);
        adminUserRolesList = yield workos.fga.query({
            q: `select role where user:${adminUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(adminUserRolesList.data.length).toEqual(0);
        adminRolePermissionsList = yield workos.fga.query({
            q: `select permission where role:${adminRole.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(adminRolePermissionsList.data.length).toEqual(0);
        // Assign 'view-report' -> viewer user
        let viewerUserHasPermission = yield workos.fga.check({
            checks: [
                { resource: viewPermission, relation: 'member', subject: viewerUser },
            ],
        }, { warrantToken: 'latest' });
        expect(viewerUserHasPermission.isAuthorized()).toEqual(false);
        let viewerUserPermissionsList = yield workos.fga.query({
            q: `select permission where user:${viewerUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(viewerUserPermissionsList.data.length).toEqual(0);
        yield workos.fga.writeWarrant({
            resource: viewPermission,
            relation: 'member',
            subject: viewerUser,
        });
        viewerUserHasPermission = yield workos.fga.check({
            checks: [
                { resource: viewPermission, relation: 'member', subject: viewerUser },
            ],
        }, { warrantToken: 'latest' });
        expect(viewerUserHasPermission.isAuthorized()).toEqual(true);
        viewerUserPermissionsList = yield workos.fga.query({
            q: `select permission where user:${viewerUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(viewerUserPermissionsList.data.length).toEqual(1);
        expect(viewerUserPermissionsList.data[0].resourceType).toEqual('permission');
        expect(viewerUserPermissionsList.data[0].resourceId).toEqual('view-report');
        expect(viewerUserPermissionsList.data[0].meta).toEqual({
            name: 'View Report',
            description: 'Permission to view reports',
        });
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: viewPermission,
            relation: 'member',
            subject: viewerUser,
        });
        viewerUserHasPermission = yield workos.fga.check({
            checks: [
                { resource: viewPermission, relation: 'member', subject: viewerUser },
            ],
        }, { warrantToken: 'latest' });
        expect(viewerUserHasPermission.isAuthorized()).toEqual(false);
        viewerUserPermissionsList = yield workos.fga.query({
            q: `select permission where user:${viewerUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(viewerUserPermissionsList.data.length).toEqual(0);
        // Clean up
        yield workos.fga.deleteResource(adminUser);
        yield workos.fga.deleteResource(viewerUser);
        yield workos.fga.deleteResource(adminRole);
        yield workos.fga.deleteResource(viewerRole);
        yield workos.fga.deleteResource(createPermission);
        yield workos.fga.deleteResource(viewPermission);
    }), 10000);
    it('pricing tiers, features, and users example', () => __awaiter(void 0, void 0, void 0, function* () {
        // Create users
        const freeUser = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        const paidUser = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        // Create pricing tiers
        const freeTier = yield workos.fga.createResource({
            resource: { resourceType: 'pricing-tier', resourceId: 'free' },
            meta: { name: 'Free Tier' },
        });
        const paidTier = yield workos.fga.createResource({
            resource: { resourceType: 'pricing-tier', resourceId: 'paid' },
        });
        // Create features
        const customFeature = yield workos.fga.createResource({
            resource: { resourceType: 'feature', resourceId: 'custom-feature' },
            meta: { name: 'Custom Feature' },
        });
        const feature1 = yield workos.fga.createResource({
            resource: { resourceType: 'feature', resourceId: 'feature-1' },
        });
        const feature2 = yield workos.fga.createResource({
            resource: { resourceType: 'feature', resourceId: 'feature-2' },
        });
        // Assign 'custom-feature' -> paid user
        let paidUserHasFeature = yield workos.fga.check({
            checks: [
                { resource: customFeature, relation: 'member', subject: paidUser },
            ],
        }, { warrantToken: 'latest' });
        expect(paidUserHasFeature.isAuthorized()).toEqual(false);
        let paidUserFeaturesList = yield workos.fga.query({
            q: `select feature where user:${paidUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(paidUserFeaturesList.data.length).toEqual(0);
        yield workos.fga.writeWarrant({
            resource: customFeature,
            relation: 'member',
            subject: paidUser,
        });
        paidUserHasFeature = yield workos.fga.check({
            checks: [
                { resource: customFeature, relation: 'member', subject: paidUser },
            ],
        }, { warrantToken: 'latest' });
        expect(paidUserHasFeature.isAuthorized()).toEqual(true);
        paidUserFeaturesList = yield workos.fga.query({
            q: `select feature where user:${paidUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(paidUserFeaturesList.data.length).toEqual(1);
        expect(paidUserFeaturesList.data[0].resourceType).toEqual('feature');
        expect(paidUserFeaturesList.data[0].resourceId).toEqual('custom-feature');
        expect(paidUserFeaturesList.data[0].meta).toEqual({
            name: 'Custom Feature',
        });
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: customFeature,
            relation: 'member',
            subject: paidUser,
        });
        paidUserHasFeature = yield workos.fga.check({
            checks: [
                { resource: customFeature, relation: 'member', subject: paidUser },
            ],
        }, { warrantToken: 'latest' });
        expect(paidUserHasFeature.isAuthorized()).toEqual(false);
        paidUserFeaturesList = yield workos.fga.query({
            q: `select feature where user:${paidUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(paidUserFeaturesList.data.length).toEqual(0);
        // Assign 'feature-1' -> 'free' tier -> free user
        let freeUserHasFeature = yield workos.fga.check({
            checks: [{ resource: feature1, relation: 'member', subject: freeUser }],
        }, { warrantToken: 'latest' });
        expect(freeUserHasFeature.isAuthorized()).toEqual(false);
        let freeUserFeaturesList = yield workos.fga.query({
            q: `select feature where user:${freeUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(freeUserFeaturesList.data.length).toEqual(0);
        let freeUserTiersList = yield workos.fga.query({
            q: `select pricing-tier where user:${freeUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(freeUserTiersList.data.length).toEqual(0);
        yield workos.fga.writeWarrant({
            resource: feature1,
            relation: 'member',
            subject: freeTier,
        });
        yield workos.fga.writeWarrant({
            resource: freeTier,
            relation: 'member',
            subject: freeUser,
        });
        freeUserHasFeature = yield workos.fga.check({
            checks: [{ resource: feature1, relation: 'member', subject: freeUser }],
        }, { warrantToken: 'latest' });
        expect(freeUserHasFeature.isAuthorized()).toEqual(true);
        freeUserFeaturesList = yield workos.fga.query({
            q: `select feature where user:${freeUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(freeUserFeaturesList.data.length).toEqual(1);
        expect(freeUserFeaturesList.data[0].resourceType).toEqual('feature');
        expect(freeUserFeaturesList.data[0].resourceId).toEqual('feature-1');
        expect(freeUserFeaturesList.data[0].meta).toBeUndefined();
        freeUserTiersList = yield workos.fga.query({
            q: `select pricing-tier where user:${freeUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(freeUserTiersList.data.length).toEqual(1);
        expect(freeUserTiersList.data[0].resourceType).toEqual('pricing-tier');
        expect(freeUserTiersList.data[0].resourceId).toEqual('free');
        expect(freeUserTiersList.data[0].meta).toEqual({ name: 'Free Tier' });
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: feature1,
            relation: 'member',
            subject: freeTier,
        });
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: freeTier,
            relation: 'member',
            subject: freeUser,
        });
        freeUserHasFeature = yield workos.fga.check({
            checks: [{ resource: feature1, relation: 'member', subject: freeUser }],
        }, { warrantToken: 'latest' });
        expect(freeUserHasFeature.isAuthorized()).toEqual(false);
        freeUserFeaturesList = yield workos.fga.query({
            q: `select feature where user:${freeUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(freeUserFeaturesList.data.length).toEqual(0);
        freeUserTiersList = yield workos.fga.query({
            q: `select pricing-tier where user:${freeUser.resourceId} is member`,
            limit: 10,
        }, { warrantToken: 'latest' });
        expect(freeUserTiersList.data.length).toEqual(0);
        // Clean up
        yield workos.fga.deleteResource(freeUser);
        yield workos.fga.deleteResource(paidUser);
        yield workos.fga.deleteResource(freeTier);
        yield workos.fga.deleteResource(paidTier);
        yield workos.fga.deleteResource(customFeature);
        yield workos.fga.deleteResource(feature1);
        yield workos.fga.deleteResource(feature2);
    }), 10000);
    it('warrants', () => __awaiter(void 0, void 0, void 0, function* () {
        const user1 = yield workos.fga.createResource({
            resource: { resourceType: 'user', resourceId: 'userA' },
        });
        const user2 = yield workos.fga.createResource({
            resource: { resourceType: 'user', resourceId: 'userB' },
        });
        const newPermission = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm1' },
            meta: { name: 'Permission 1', description: 'Permission 1' },
        });
        let userHasPermission = yield workos.fga.check({
            checks: [
                { resource: newPermission, relation: 'member', subject: user1 },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermission.isAuthorized()).toEqual(false);
        const warrant1 = yield workos.fga.writeWarrant({
            resource: newPermission,
            relation: 'member',
            subject: user1,
        });
        expect(warrant1.warrantToken).toBeDefined();
        const warrant2 = yield workos.fga.writeWarrant({
            resource: newPermission,
            relation: 'member',
            subject: user2,
            policy: 'region == "us"',
        });
        expect(warrant2.warrantToken).toBeDefined();
        const warrants1 = yield workos.fga.listWarrants({ limit: 1 }, { warrantToken: 'latest' });
        expect(warrants1.data.length).toEqual(1);
        expect(warrants1.data[0].resourceType).toEqual('permission');
        expect(warrants1.data[0].resourceId).toEqual('perm1');
        expect(warrants1.data[0].relation).toEqual('member');
        expect(warrants1.data[0].subject.resourceType).toEqual('user');
        expect(warrants1.data[0].subject.resourceId).toEqual(user2.resourceId);
        expect(warrants1.data[0].policy).toEqual('region == "us"');
        const warrants2 = yield workos.fga.listWarrants({ limit: 1, after: warrants1.listMetadata.after }, { warrantToken: 'latest' });
        expect(warrants2.data.length).toEqual(1);
        expect(warrants2.data[0].resourceType).toEqual('permission');
        expect(warrants2.data[0].resourceId).toEqual('perm1');
        expect(warrants2.data[0].relation).toEqual('member');
        expect(warrants2.data[0].subject.resourceType).toEqual('user');
        expect(warrants2.data[0].subject.resourceId).toEqual(user1.resourceId);
        const warrants3 = yield workos.fga.listWarrants({ subjectType: 'user', subjectId: user1.resourceId }, { warrantToken: 'latest' });
        expect(warrants3.data.length).toEqual(1);
        expect(warrants3.data[0].resourceType).toEqual('permission');
        expect(warrants3.data[0].resourceId).toEqual('perm1');
        expect(warrants3.data[0].relation).toEqual('member');
        expect(warrants3.data[0].subject.resourceType).toEqual('user');
        expect(warrants3.data[0].subject.resourceId).toEqual(user1.resourceId);
        userHasPermission = yield workos.fga.check({
            checks: [
                { resource: newPermission, relation: 'member', subject: user1 },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermission.isAuthorized()).toEqual(true);
        const query = `select permission where user:${user1.resourceId} is member`;
        const response = yield workos.fga.query({ q: query }, { warrantToken: 'latest' });
        expect(response.data.length).toEqual(1);
        expect(response.data[0].resourceType).toEqual('permission');
        expect(response.data[0].resourceId).toEqual('perm1');
        expect(response.data[0].relation).toEqual('member');
        yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: newPermission,
            relation: 'member',
            subject: user1,
        });
        userHasPermission = yield workos.fga.check({
            checks: [
                { resource: newPermission, relation: 'member', subject: user1 },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermission.isAuthorized()).toEqual(false);
        // Clean up
        yield workos.fga.deleteResource(user1);
        yield workos.fga.deleteResource(user2);
        yield workos.fga.deleteResource(newPermission);
    }));
    it('check many warrants', () => __awaiter(void 0, void 0, void 0, function* () {
        const newUser = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        const permission1 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm1' },
            meta: { name: 'Permission 1', description: 'Permission 1' },
        });
        const permission2 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm2' },
            meta: { name: 'Permission 2', description: 'Permission 2' },
        });
        const userHasPermissions = yield workos.fga.check({
            op: interfaces_1.CheckOp.AnyOf,
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermissions.isAuthorized()).toEqual(false);
        let warrantResponse = yield workos.fga.writeWarrant({
            resource: permission1,
            relation: 'member',
            subject: newUser,
        });
        expect(warrantResponse.warrantToken).toBeDefined();
        let userHasAtLeastOnePermission = yield workos.fga.check({
            op: interfaces_1.CheckOp.AnyOf,
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasAtLeastOnePermission.isAuthorized()).toEqual(true);
        let userHasAllPermissions = yield workos.fga.check({
            op: interfaces_1.CheckOp.AllOf,
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasAllPermissions.isAuthorized()).toEqual(false);
        warrantResponse = yield workos.fga.writeWarrant({
            resource: permission2,
            relation: 'member',
            subject: newUser,
        });
        expect(warrantResponse.warrantToken).toBeDefined();
        userHasAtLeastOnePermission = yield workos.fga.check({
            op: interfaces_1.CheckOp.AnyOf,
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasAtLeastOnePermission.isAuthorized()).toEqual(true);
        userHasAllPermissions = yield workos.fga.check({
            op: interfaces_1.CheckOp.AllOf,
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasAllPermissions.isAuthorized()).toEqual(true);
        warrantResponse = yield workos.fga.batchWriteWarrants([
            {
                op: interfaces_1.WarrantOp.Delete,
                resource: permission1,
                relation: 'member',
                subject: newUser,
            },
            {
                op: interfaces_1.WarrantOp.Delete,
                resource: permission2,
                relation: 'member',
                subject: newUser,
            },
        ]);
        expect(warrantResponse.warrantToken).toBeDefined();
        // Clean up
        yield workos.fga.deleteResource(newUser);
        yield workos.fga.deleteResource(permission1);
        yield workos.fga.deleteResource(permission2);
    }));
    it('batch create/delete/check warrants', () => __awaiter(void 0, void 0, void 0, function* () {
        const newUser = yield workos.fga.createResource({
            resource: { resourceType: 'user' },
        });
        const permission1 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm1' },
            meta: { name: 'Permission 1', description: 'Permission 1' },
        });
        const permission2 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm2' },
            meta: { name: 'Permission 2', description: 'Permission 2' },
        });
        let userHasPermissions = yield workos.fga.checkBatch({
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermissions[0].isAuthorized()).toEqual(false);
        expect(userHasPermissions[1].isAuthorized()).toEqual(false);
        const warrants = yield workos.fga.batchWriteWarrants([
            { resource: permission1, relation: 'member', subject: newUser },
            { resource: permission2, relation: 'member', subject: newUser },
        ]);
        expect(warrants.warrantToken).toBeDefined();
        userHasPermissions = yield workos.fga.checkBatch({
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermissions[0].isAuthorized()).toEqual(true);
        expect(userHasPermissions[1].isAuthorized()).toEqual(true);
        const warrantToken = yield workos.fga.batchWriteWarrants([
            {
                op: interfaces_1.WarrantOp.Delete,
                resource: permission1,
                relation: 'member',
                subject: newUser,
            },
            {
                op: interfaces_1.WarrantOp.Delete,
                resource: permission2,
                relation: 'member',
                subject: newUser,
            },
        ]);
        expect(warrantToken).toBeDefined();
        userHasPermissions = yield workos.fga.checkBatch({
            checks: [
                { resource: permission1, relation: 'member', subject: newUser },
                { resource: permission2, relation: 'member', subject: newUser },
            ],
        }, { warrantToken: 'latest' });
        expect(userHasPermissions[0].isAuthorized()).toEqual(false);
        expect(userHasPermissions[1].isAuthorized()).toEqual(false);
        yield workos.fga.deleteResource(newUser);
        yield workos.fga.deleteResource(permission1);
        yield workos.fga.deleteResource(permission2);
    }));
    it('warrant with policy', () => __awaiter(void 0, void 0, void 0, function* () {
        let writeResult = yield workos.fga.writeWarrant({
            resource: { resourceType: 'permission', resourceId: 'test-permission' },
            relation: 'member',
            subject: { resourceType: 'user', resourceId: 'user-1' },
            policy: `geo == "us"`,
        });
        expect(writeResult.warrantToken).toBeDefined();
        let checkResult = yield workos.fga.check({
            checks: [
                {
                    resource: {
                        resourceType: 'permission',
                        resourceId: 'test-permission',
                    },
                    relation: 'member',
                    subject: { resourceType: 'user', resourceId: 'user-1' },
                    context: { geo: 'us' },
                },
            ],
        }, {
            warrantToken: 'latest',
        });
        expect(checkResult.isAuthorized()).toEqual(true);
        checkResult = yield workos.fga.check({
            checks: [
                {
                    resource: {
                        resourceType: 'permission',
                        resourceId: 'test-permission',
                    },
                    relation: 'member',
                    subject: { resourceType: 'user', resourceId: 'user-1' },
                    context: { geo: 'eu' },
                },
            ],
        }, {
            warrantToken: 'latest',
        });
        expect(checkResult.isAuthorized()).toEqual(false);
        writeResult = yield workos.fga.writeWarrant({
            op: interfaces_1.WarrantOp.Delete,
            resource: { resourceType: 'permission', resourceId: 'test-permission' },
            relation: 'member',
            subject: { resourceType: 'user', resourceId: 'user-1' },
            policy: `geo == "us"`,
        });
        expect(writeResult.warrantToken).toBeDefined();
        // Clean up
        yield workos.fga.deleteResource({
            resourceType: 'permission',
            resourceId: 'test-permission',
        });
        yield workos.fga.deleteResource({
            resourceType: 'user',
            resourceId: 'user-1',
        });
    }));
    it('query', () => __awaiter(void 0, void 0, void 0, function* () {
        const userA = yield workos.fga.createResource({
            resource: { resourceType: 'user', resourceId: 'userA' },
        });
        const userB = yield workos.fga.createResource({
            resource: { resourceType: 'user', resourceId: 'userB' },
        });
        const permission1 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm1' },
            meta: { name: 'Permission 1', description: 'This is permission 1.' },
        });
        const permission2 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm2' },
        });
        const permission3 = yield workos.fga.createResource({
            resource: { resourceType: 'permission', resourceId: 'perm3' },
            meta: { name: 'Permission 3', description: 'This is permission 3.' },
        });
        const role1 = yield workos.fga.createResource({
            resource: { resourceType: 'role', resourceId: 'role1' },
            meta: { name: 'Role 1', description: 'This is role 1.' },
        });
        const role2 = yield workos.fga.createResource({
            resource: { resourceType: 'role', resourceId: 'role2' },
            meta: { name: 'Role 2' },
        });
        yield workos.fga.writeWarrant({
            resource: permission1,
            relation: 'member',
            subject: role1,
        });
        yield workos.fga.writeWarrant({
            resource: permission2,
            relation: 'member',
            subject: role2,
        });
        yield workos.fga.writeWarrant({
            resource: permission3,
            relation: 'member',
            subject: role2,
        });
        yield workos.fga.writeWarrant({
            resource: role2,
            relation: 'member',
            subject: role1,
        });
        yield workos.fga.writeWarrant({
            resource: permission1,
            relation: 'member',
            subject: role2,
            policy: 'tenantId == 123',
        });
        yield workos.fga.writeWarrant({
            resource: role1,
            relation: 'member',
            subject: userA,
        });
        yield workos.fga.writeWarrant({
            resource: role2,
            relation: 'member',
            subject: userB,
        });
        let resultSet = yield workos.fga.query({ q: 'select role where user:userA is member', limit: 1, order: 'asc' }, { warrantToken: 'latest' });
        expect(resultSet.data.length).toEqual(1);
        expect(resultSet.data[0].resourceType).toEqual('role');
        expect(resultSet.data[0].resourceId).toEqual('role1');
        expect(resultSet.data[0].relation).toEqual('member');
        expect(resultSet.data[0].warrant.resourceType).toEqual('role');
        expect(resultSet.data[0].warrant.resourceId).toEqual('role1');
        expect(resultSet.data[0].warrant.relation).toEqual('member');
        expect(resultSet.data[0].warrant.subject.resourceType).toEqual('user');
        expect(resultSet.data[0].warrant.subject.resourceId).toEqual('userA');
        expect(resultSet.data[0].warrant.policy).toBeUndefined();
        expect(resultSet.data[0].isImplicit).toEqual(false);
        resultSet = yield workos.fga.query({
            q: 'select role where user:userA is member',
            limit: 1,
            order: 'asc',
            after: resultSet.listMetadata.after,
        }, { warrantToken: 'latest' });
        expect(resultSet.data.length).toEqual(1);
        expect(resultSet.data[0].resourceType).toEqual('role');
        expect(resultSet.data[0].resourceId).toEqual('role2');
        expect(resultSet.data[0].relation).toEqual('member');
        expect(resultSet.data[0].warrant.resourceType).toEqual('role');
        expect(resultSet.data[0].warrant.resourceId).toEqual('role2');
        expect(resultSet.data[0].warrant.relation).toEqual('member');
        expect(resultSet.data[0].warrant.subject.resourceType).toEqual('role');
        expect(resultSet.data[0].warrant.subject.resourceId).toEqual('role1');
        expect(resultSet.data[0].warrant.policy).toBeUndefined();
        expect(resultSet.data[0].isImplicit).toEqual(true);
        resultSet = yield workos.fga.query({
            q: 'select permission where user:userB is member',
            context: { tenantId: 123 },
            order: 'asc',
        }, { warrantToken: 'latest' });
        expect(resultSet.data.length).toEqual(3);
        expect(resultSet.data[0].resourceType).toEqual('permission');
        expect(resultSet.data[0].resourceId).toEqual('perm1');
        expect(resultSet.data[0].relation).toEqual('member');
        expect(resultSet.data[1].resourceType).toEqual('permission');
        expect(resultSet.data[1].resourceId).toEqual('perm2');
        expect(resultSet.data[1].relation).toEqual('member');
        expect(resultSet.data[2].resourceType).toEqual('permission');
        expect(resultSet.data[2].resourceId).toEqual('perm3');
        expect(resultSet.data[2].relation).toEqual('member');
        // Clean up
        yield workos.fga.deleteResource(role1);
        yield workos.fga.deleteResource(role2);
        yield workos.fga.deleteResource(permission1);
        yield workos.fga.deleteResource(permission2);
        yield workos.fga.deleteResource(permission3);
        yield workos.fga.deleteResource(userA);
        yield workos.fga.deleteResource(userB);
    }));
    it('batch write resources', () => __awaiter(void 0, void 0, void 0, function* () {
        const objects = yield workos.fga.batchWriteResources({
            op: interfaces_1.ResourceOp.Create,
            resources: [
                {
                    resource: {
                        resourceType: 'user',
                        resourceId: 'user1',
                    },
                },
                {
                    resource: {
                        resourceType: 'user',
                        resourceId: 'user2',
                    },
                },
                {
                    resource: {
                        resourceType: 'tenant',
                        resourceId: 'tenantA',
                    },
                    meta: {
                        name: 'Tenant A',
                    },
                },
            ],
        });
        expect(objects.length).toEqual(3);
        expect(objects[0].resourceType).toEqual('user');
        expect(objects[0].resourceId).toEqual('user1');
        expect(objects[1].resourceType).toEqual('user');
        expect(objects[1].resourceId).toEqual('user2');
        expect(objects[2].resourceType).toEqual('tenant');
        expect(objects[2].resourceId).toEqual('tenantA');
        expect(objects[2].meta).toEqual({ name: 'Tenant A' });
        yield workos.fga.batchWriteResources({
            op: interfaces_1.ResourceOp.Delete,
            resources: [
                {
                    resourceType: 'user',
                    resourceId: 'user1',
                },
                {
                    resourceType: 'user',
                    resourceId: 'user2',
                },
                {
                    resourceType: 'tenant',
                    resourceId: 'tenantA',
                },
            ],
        });
    }));
});
