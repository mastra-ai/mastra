"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const organization_serializer_1 = require("./organization.serializer");
const get_organization_json_1 = __importDefault(require("../fixtures/get-organization.json"));
const organizationResponse = Object.assign(Object.assign({}, get_organization_json_1.default), { object: 'organization', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), domains: [] });
describe('deserializeOrganization', () => {
    it('includes metadata if present', () => {
        const metadata = { key: 'value' };
        expect((0, organization_serializer_1.deserializeOrganization)(Object.assign(Object.assign({}, organizationResponse), { metadata }))).toMatchObject({
            metadata,
        });
    });
    it('coerces missing metadata to empty object', () => {
        const { metadata } = organizationResponse, organizationResponseWithoutMetadata = __rest(organizationResponse, ["metadata"]);
        expect((0, organization_serializer_1.deserializeOrganization)(organizationResponseWithoutMetadata)).toMatchObject({
            metadata: {},
        });
    });
});
