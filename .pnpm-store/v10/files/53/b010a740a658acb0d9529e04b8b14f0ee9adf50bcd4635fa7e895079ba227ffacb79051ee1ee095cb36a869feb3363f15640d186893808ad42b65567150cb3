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
const get_organization_domain_pending_json_1 = __importDefault(require("./fixtures/get-organization-domain-pending.json"));
const get_organization_domain_verified_json_1 = __importDefault(require("./fixtures/get-organization-domain-verified.json"));
const interfaces_1 = require("./interfaces");
const workos = new workos_1.WorkOS('sk_test_Sz3IQjepeSWaI4cMS4ms4sMuU');
describe('OrganizationDomains', () => {
    beforeEach(() => jest_fetch_mock_1.default.resetMocks());
    describe('get', () => {
        it('requests an Organization Domain', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(get_organization_domain_verified_json_1.default);
            const subject = yield workos.organizationDomains.get('org_domain_01HCZRAP3TPQ0X0DKJHR32TATG');
            expect((0, test_utils_1.fetchURL)()).toContain('/organization_domains/org_domain_01HCZRAP3TPQ0X0DKJHR32TATG');
            expect(subject.id).toEqual('org_domain_01HCZRAP3TPQ0X0DKJHR32TATG');
            expect(subject.domain).toEqual('workos.com');
            expect(subject.organizationId).toEqual('org_01JR8C1EHCRPV4B4XP4W2B9X1M');
            expect(subject.state).toEqual(interfaces_1.OrganizationDomainState.Verified);
            expect(subject.verificationToken).toBeNull();
            expect(subject.verificationStrategy).toEqual('manual');
        }));
        it('requests an Organization Domain', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(get_organization_domain_pending_json_1.default);
            const subject = yield workos.organizationDomains.get('org_domain_01HD50K7EPWCMNPGMKXKKE14XT');
            expect((0, test_utils_1.fetchURL)()).toContain('/organization_domains/org_domain_01HD50K7EPWCMNPGMKXKKE14XT');
            expect(subject.id).toEqual('org_domain_01HD50K7EPWCMNPGMKXKKE14XT');
            expect(subject.domain).toEqual('workos.com');
            expect(subject.organizationId).toEqual('org_01JR8C1EHCRPV4B4XP4W2B9X1M');
            expect(subject.state).toEqual(interfaces_1.OrganizationDomainState.Pending);
            expect(subject.verificationToken).toEqual('F06PGMsZIO0shrveGWuGxgCj7');
            expect(subject.verificationStrategy).toEqual('dns');
        }));
    });
    describe('verify', () => {
        it('start Organization Domain verification flow', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(get_organization_domain_pending_json_1.default);
            const subject = yield workos.organizationDomains.verify('org_domain_01HD50K7EPWCMNPGMKXKKE14XT');
            expect((0, test_utils_1.fetchURL)()).toContain('/organization_domains/org_domain_01HD50K7EPWCMNPGMKXKKE14XT/verify');
            expect(subject.id).toEqual('org_domain_01HD50K7EPWCMNPGMKXKKE14XT');
            expect(subject.domain).toEqual('workos.com');
            expect(subject.organizationId).toEqual('org_01JR8C1EHCRPV4B4XP4W2B9X1M');
            expect(subject.state).toEqual(interfaces_1.OrganizationDomainState.Pending);
            expect(subject.verificationToken).toEqual('F06PGMsZIO0shrveGWuGxgCj7');
            expect(subject.verificationStrategy).toEqual('dns');
        }));
    });
    describe('create', () => {
        it('creates an Organization Domain', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)(get_organization_domain_pending_json_1.default);
            const subject = yield workos.organizationDomains.create({
                organizationId: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
                domain: 'workos.com',
            });
            expect((0, test_utils_1.fetchURL)()).toContain('/organization_domains');
            expect((0, test_utils_1.fetchBody)()).toEqual({
                domain: 'workos.com',
                organization_id: 'org_01EHT88Z8J8795GZNQ4ZP1J81T',
            });
            expect(subject.id).toEqual('org_domain_01HD50K7EPWCMNPGMKXKKE14XT');
            expect(subject.domain).toEqual('workos.com');
            expect(subject.organizationId).toEqual('org_01JR8C1EHCRPV4B4XP4W2B9X1M');
            expect(subject.state).toEqual(interfaces_1.OrganizationDomainState.Pending);
            expect(subject.verificationToken).toEqual('F06PGMsZIO0shrveGWuGxgCj7');
            expect(subject.verificationStrategy).toEqual('dns');
        }));
    });
    describe('delete', () => {
        it('deletes an Organization Domain', () => __awaiter(void 0, void 0, void 0, function* () {
            (0, test_utils_1.fetchOnce)();
            yield workos.organizationDomains.delete('org_domain_01HCZRAP3TPQ0X0DKJHR32TATG');
            expect((0, test_utils_1.fetchURL)()).toContain('/organization_domains/org_domain_01HCZRAP3TPQ0X0DKJHR32TATG');
        }));
    });
});
