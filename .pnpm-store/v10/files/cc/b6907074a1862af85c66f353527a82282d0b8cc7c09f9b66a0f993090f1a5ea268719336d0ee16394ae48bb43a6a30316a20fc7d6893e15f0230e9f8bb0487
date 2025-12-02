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
exports.SSO = void 0;
const qs_1 = __importDefault(require("qs"));
const fetch_and_deserialize_1 = require("../common/utils/fetch-and-deserialize");
const pagination_1 = require("../common/utils/pagination");
const serializers_1 = require("./serializers");
const toQueryString = (options) => {
    return qs_1.default.stringify(options, {
        arrayFormat: 'repeat',
        // sorts the keys alphabetically to maintain backwards compatibility
        sort: (a, b) => a.localeCompare(b),
        // encodes space as + instead of %20 to maintain backwards compatibility
        format: 'RFC1738',
    });
};
class SSO {
    constructor(workos) {
        this.workos = workos;
    }
    listConnections(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new pagination_1.AutoPaginatable(yield (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/connections', serializers_1.deserializeConnection, options ? (0, serializers_1.serializeListConnectionsOptions)(options) : undefined), (params) => (0, fetch_and_deserialize_1.fetchAndDeserialize)(this.workos, '/connections', serializers_1.deserializeConnection, params), options ? (0, serializers_1.serializeListConnectionsOptions)(options) : undefined);
        });
    }
    deleteConnection(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workos.delete(`/connections/${id}`);
        });
    }
    getAuthorizationUrl({ connection, clientId, domain, domainHint, loginHint, organization, provider, providerQueryParams, providerScopes, redirectUri, state, }) {
        if (!domain && !provider && !connection && !organization) {
            throw new Error(`Incomplete arguments. Need to specify either a 'connection', 'organization', 'domain', or 'provider'.`);
        }
        if (domain) {
            this.workos.emitWarning('The `domain` parameter for `getAuthorizationURL` is deprecated. Please use `organization` instead.');
        }
        const query = toQueryString({
            connection,
            organization,
            domain,
            domain_hint: domainHint,
            login_hint: loginHint,
            provider,
            provider_query_params: providerQueryParams,
            provider_scopes: providerScopes,
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            state,
        });
        return `${this.workos.baseURL}/sso/authorize?${query}`;
    }
    getConnection(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get(`/connections/${id}`);
            return (0, serializers_1.deserializeConnection)(data);
        });
    }
    getProfileAndToken({ code, clientId, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new URLSearchParams({
                client_id: clientId,
                client_secret: this.workos.key,
                grant_type: 'authorization_code',
                code,
            });
            const { data } = yield this.workos.post('/sso/token', form);
            return (0, serializers_1.deserializeProfileAndToken)(data);
        });
    }
    getProfile({ accessToken, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data } = yield this.workos.get('/sso/profile', {
                accessToken,
            });
            return (0, serializers_1.deserializeProfile)(data);
        });
    }
}
exports.SSO = SSO;
