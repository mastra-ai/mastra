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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_fetch_mock_1 = __importDefault(require("jest-fetch-mock"));
const test_utils_1 = require("../common/utils/test-utils");
const workos_1 = require("../workos");
const clear_stripe_customer_id_json_1 = __importDefault(require("./fixtures/clear-stripe-customer-id.json"));
const create_organization_invalid_json_1 = __importDefault(require("./fixtures/create-organization-invalid.json"));
const create_organization_json_1 = __importDefault(require("./fixtures/create-organization.json"));
const get_organization_json_1 = __importDefault(require("./fixtures/get-organization.json"));
const list_organizations_json_1 = __importDefault(require("./fixtures/list-organizations.json"));
const list_organization_roles_json_1 = __importDefault(require("./fixtures/list-organization-roles.json"));
const list_organization_feature_flags_json_1 = __importDefault(require("./fixtures/list-organization-feature-flags.json"));
const update_organization_json_1 = __importDefault(require("./fixtures/update-organization.json"));
const set_stripe_customer_id_json_1 = __importDefault(require("./fixtures/set-stripe-customer-id.json"));
const set_stripe_customer_id_disabled_json_1 = __importDefault(require("./fixtures/set-stripe-customer-id-disabled.json"));
const interfaces_1 = require("./interfaces");
const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
describe('Organizations', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('listOrganizations', () => {
        describe('without any options', () => {
            it('returns organizations and metadata', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organizations_json_1.default);
                const { data, listMetadata } = yield workos.organizations.listOrganizations();
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations');
                expect(data).toHaveLength(7);
                expect(listMetadata).toEqual({
                    after: null,
                    before: 'before-id',
                });
            }));
        });
        describe('with the domain option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organizations_json_1.default);
                const { data } = yield workos.organizations.listOrganizations({
                    domains: ['example.com', 'example2.com'],
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    domains: 'example.com,example2.com',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations');
                expect(data).toHaveLength(7);
            }));
        });
        describe('with the before option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organizations_json_1.default);
                const { data } = yield workos.organizations.listOrganizations({
                    before: 'before-id',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    before: 'before-id',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations');
                expect(data).toHaveLength(7);
            }));
        });
        describe('with the after option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organizations_json_1.default);
                const { data } = yield workos.organizations.listOrganizations({
                    after: 'after-id',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    after: 'after-id',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations');
                expect(data).toHaveLength(7);
            }));
        });
        describe('with the limit option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organizations_json_1.default);
                const { data } = yield workos.organizations.listOrganizations({
                    limit: 10,
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    limit: '10',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations');
                expect(data).toHaveLength(7);
            }));
        });
    });
    describe('createOrganization', () => {
        describe('with an idempotency key', () => {
            it('includes an idempotency key with request', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(create_organization_json_1.default, { status: 201 });
                yield workos.organizations.createOrganization({
                    domains: ['example.com'],
                    name: 'Test Organization',
                }, {
                    idempotencyKey: 'the-idempotency-key',
                });
                expect((0, test_utils_1.fetchHeaders)()).toMatchObject({
                    'Idempotency-Key': 'the-idempotency-key',
                });
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    domains: ['example.com'],
                    name: 'Test Organization',
                });
            }));
        });
        describe('with a valid payload', () => {
            describe('with `domains`', () => {
                it('creates an organization', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)(create_organization_json_1.default, { status: 201 });
                    const subject = yield workos.organizations.createOrganization({
                        domains: ['example.com'],
                        name: 'Test Organization',
                    });
                    expect((0, test_utils_1.fetchBody)()).toEqual({
                        domains: ['example.com'],
                        name: 'Test Organization',
                    });
                    expect(subject.id).toEqual('org_01EHT88Z8J8795GZNQ4ZP1J81T');
                    expect(subject.name).toEqual('Test Organization');
                    expect(subject.domains).toHaveLength(1);
                }));
            });
            describe('with `domain_data`', () => {
                it('creates an organization', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)(create_organization_json_1.default, { status: 201 });
                    const subject = yield workos.organizations.createOrganization({
                        domainData: [
                            { domain: 'example.com', state: interfaces_1.DomainDataState.Verified },
                        ],
                        name: 'Test Organization',
                    });
                    expect((0, test_utils_1.fetchBody)()).toEqual({
                        domain_data: [{ domain: 'example.com', state: 'verified' }],
                        name: 'Test Organization',
                    });
                    expect(subject.id).toEqual('org_01EHT88Z8J8795GZNQ4ZP1J81T');
                    expect(subject.name).toEqual('Test Organization');
                    expect(subject.domains).toHaveLength(1);
                }));
            });
            it('adds metadata to the request', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(create_organization_json_1.default, { status: 201 });
                yield workos.organizations.createOrganization({
                    name: 'My organization',
                    metadata: { key: 'value' },
                });
                expect((0, test_utils_1.fetchBody)()).toMatchObject({
                    metadata: { key: 'value' },
                });
            }));
        });
        describe('with an invalid payload', () => {
            it('returns an error', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(create_organization_invalid_json_1.default, {
                    status: 409,
                    headers: { 'X-Request-ID': 'a-request-id' },
                });
                yield expect(workos.organizations.createOrganization({
                    domains: ['example.com'],
                    name: 'Test Organization',
                })).rejects.toThrowError('An Organization with the domain example.com already exists.');
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    domains: ['example.com'],
                    name: 'Test Organization',
                });
            }));
        });
    });
    describe('getOrganization', () => {
        it(`requests an Organization`, () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(get_organization_json_1.default);
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            const subject = yield workos.organizations.getOrganization('org_01EHT88Z8J8795GZNQ4ZP1J81T');
            expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T');
            expect(subject.id).toEqual('org_01EHT88Z8J8795GZNQ4ZP1J81T');
            expect(subject.name).toEqual('Test Organization 3');
            expect(subject.allowProfilesOutsideOrganization).toEqual(false);
            expect(subject.domains).toEqual([
                {
                    object: 'organization_domain',
                    id: 'org_domain_01EHT88Z8WZEFWYPM6EC9BX2R8',
                    domain: 'example.com',
                    state: 'verified',
                    verificationStrategy: 'dns',
                    verificationToken: 'xB8SeACdKJQP9DP4CahU4YuQZ',
                },
            ]);
        }));
    });
    describe('getOrganizationByExternalId', () => {
        it('sends request', () => __awaiter(void 0, void 0, void 0, function* () {
            const externalId = 'user_external_id';
            const apiResponse = Object.assign(Object.assign({}, get_organization_json_1.default), { external_id: externalId });
            (0, test_utils_1.fetchOnce)(apiResponse);
            const organization = yield workos.organizations.getOrganizationByExternalId(externalId);
            expect((0, test_utils_1.fetchURL)()).toContain(`/organizations/external_id/${externalId}`);
            expect(organization).toMatchObject({
                id: apiResponse.id,
                externalId: apiResponse.external_id,
            });
        }));
    });
    describe('deleteOrganization', () => {
        it('sends request to delete an Organization', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
            yield workos.organizations.deleteOrganization('org_01EHT88Z8J8795GZNQ4ZP1J81T');
            expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T');
        }));
    });
    describe('updateOrganization', () => {
        describe('with a valid payload', () => {
            describe('with `domains', () => {
                it('updates an organization', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)(update_organization_json_1.default, { status: 201 });
                    const subject = yield workos.organizations.updateOrganization({
                        organization: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                        domains: ['example.com'],
                        name: 'Test Organization 2',
                    });
                    expect((0, test_utils_1.fetchBody)()).toEqual({
                        domains: ['example.com'],
                        name: 'Test Organization 2',
                    });
                    expect(subject.id).toEqual('org_01EHT88Z8J8795GZNQ4ZP1J81T');
                    expect(subject.name).toEqual('Test Organization 2');
                    expect(subject.domains).toHaveLength(1);
                }));
            });
            describe('with `domain_data`', () => {
                it('updates an organization', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)(update_organization_json_1.default, { status: 201 });
                    const subject = yield workos.organizations.updateOrganization({
                        organization: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                        domainData: [
                            { domain: 'example.com', state: interfaces_1.DomainDataState.Verified },
                        ],
                    });
                    expect((0, test_utils_1.fetchBody)()).toEqual({
                        domain_data: [{ domain: 'example.com', state: 'verified' }],
                    });
                    expect(subject.id).toEqual('org_01EHT88Z8J8795GZNQ4ZP1J81T');
                    expect(subject.name).toEqual('Test Organization 2');
                    expect(subject.domains).toHaveLength(1);
                }));
            });
            it('adds metadata to the request', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(update_organization_json_1.default, { status: 201 });
                yield workos.organizations.updateOrganization({
                    organization: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                    metadata: { key: 'value' },
                });
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    metadata: { key: 'value' },
                });
            }));
        });
        describe('when given `stripeCustomerId`', () => {
            it('updates the organization’s Stripe customer ID', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(set_stripe_customer_id_json_1.default);
                const subject = yield workos.organizations.updateOrganization({
                    organization: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                    stripeCustomerId: 'cus_MX8J9nfK4lP2Yw',
                });
                expect((0, test_utils_1.fetchBody)()).toMatchObject({
                    stripe_customer_id: 'cus_MX8J9nfK4lP2Yw',
                });
                expect(subject.stripeCustomerId).toBe('cus_MX8J9nfK4lP2Yw');
            }));
            it('clears the organization’s Stripe customer ID with a `null` value', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(clear_stripe_customer_id_json_1.default);
                const subject = yield workos.organizations.updateOrganization({
                    organization: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                    stripeCustomerId: null,
                });
                expect((0, test_utils_1.fetchBody)()).toEqual({
                    stripe_customer_id: null,
                });
                expect(subject.stripeCustomerId).toBeUndefined();
            }));
            describe('when the feature is not enabled', () => {
                it('returns an error', () => __awaiter(void 0, void 0, void 0, function* () {
                    (0, test_utils_1.fetchOnce)(set_stripe_customer_id_disabled_json_1.default, { status: 422 });
                    yield expect(workos.organizations.updateOrganization({
                        organization: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                        stripeCustomerId: 'cus_MX8J9nfK4lP2Yw',
                    })).rejects.toThrowError('stripe_customer_id is not enabled for this environment');
                    expect((0, test_utils_1.fetchBody)()).toEqual({
                        stripe_customer_id: 'cus_MX8J9nfK4lP2Yw',
                    });
                }));
            });
        });
    });
    describe('listOrganizationRoles', () => {
        it('returns roles for the organization', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_organization_roles_json_1.default);
            const { data, object } = yield workos.organizations.listOrganizationRoles({
                organizationId: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T/roles');
            expect(object).toEqual('list');
            expect(data).toHaveLength(3);
            expect(data).toEqual([
                {
                    object: 'role',
                    id: 'role_01EHQMYV6MBK39QC5PZXHY59C5',
                    name: 'Admin',
                    slug: 'admin',
                    description: null,
                    permissions: ['posts:create', 'posts:delete'],
                    type: 'EnvironmentRole',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    object: 'role',
                    id: 'role_01EHQMYV6MBK39QC5PZXHY59C3',
                    name: 'Member',
                    slug: 'member',
                    description: null,
                    permissions: [],
                    type: 'EnvironmentRole',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    object: 'role',
                    id: 'role_01EHQMYV6MBK39QC5PZXHY59C3',
                    name: 'OrganizationMember',
                    slug: 'org-member',
                    description: null,
                    permissions: ['posts:read'],
                    type: 'OrganizationRole',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
            ]);
        }));
    });
    describe('listOrganizationFeatureFlags', () => {
        it('returns feature flags for the organization', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(list_organization_feature_flags_json_1.default);
            const { data, object, listMetadata } = yield workos.organizations.listOrganizationFeatureFlags({
                organizationId: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T/feature-flags');
            expect(object).toEqual('list');
            expect(listMetadata).toEqual({});
            expect(data).toHaveLength(3);
            expect(data).toEqual([
                {
                    object: 'feature_flag',
                    id: 'flag_01EHQMYV6MBK39QC5PZXHY59C5',
                    name: 'Advanced Dashboard',
                    slug: 'advanced-dashboard',
                    description: 'Enable advanced dashboard features',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    object: 'feature_flag',
                    id: 'flag_01EHQMYV6MBK39QC5PZXHY59C6',
                    name: 'Beta Features',
                    slug: 'beta-features',
                    description: null,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
                {
                    object: 'feature_flag',
                    id: 'flag_01EHQMYV6MBK39QC5PZXHY59C7',
                    name: 'Premium Support',
                    slug: 'premium-support',
                    description: 'Access to premium support features',
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                },
            ]);
        }));
        describe('with the before option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organization_feature_flags_json_1.default);
                const { data } = yield workos.organizations.listOrganizationFeatureFlags({
                    organizationId: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                    before: 'flag_before_id',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    before: 'flag_before_id',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T/feature-flags');
                expect(data).toHaveLength(3);
            }));
        });
        describe('with the after option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organization_feature_flags_json_1.default);
                const { data } = yield workos.organizations.listOrganizationFeatureFlags({
                    organizationId: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                    after: 'flag_after_id',
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    after: 'flag_after_id',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T/feature-flags');
                expect(data).toHaveLength(3);
            }));
        });
        describe('with the limit option', () => {
            it('forms the proper request to the API', () => __awaiter(void 0, void 0, void 0, function* () {
                (0, test_utils_1.fetchOnce)(list_organization_feature_flags_json_1.default);
                const { data } = yield workos.organizations.listOrganizationFeatureFlags({
                    organizationId: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                    limit: 10,
                });
                expect((0, test_utils_1.fetchSearchParams)()).toEqual({
                    limit: '10',
                    order: 'desc',
                });
                expect((0, test_utils_1.fetchURL)()).toContain('/organizations/org_01EHT88Z8J8795GZNQ4ZP1J81T/feature-flags');
                expect(data).toHaveLength(3);
            }));
        });
    });
});
