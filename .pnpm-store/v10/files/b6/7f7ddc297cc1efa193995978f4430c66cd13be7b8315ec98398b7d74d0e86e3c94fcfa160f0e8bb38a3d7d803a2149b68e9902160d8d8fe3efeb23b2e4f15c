"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Access = void 0;
const resource_1 = require("../../../resource.js");
const BookmarksAPI = __importStar(require("./bookmarks.js"));
const bookmarks_1 = require("./bookmarks.js");
const CustomPagesAPI = __importStar(require("./custom-pages.js"));
const custom_pages_1 = require("./custom-pages.js");
const GatewayCAAPI = __importStar(require("./gateway-ca.js"));
const gateway_ca_1 = require("./gateway-ca.js");
const GroupsAPI = __importStar(require("./groups.js"));
const groups_1 = require("./groups.js");
const KeysAPI = __importStar(require("./keys.js"));
const keys_1 = require("./keys.js");
const PoliciesAPI = __importStar(require("./policies.js"));
const policies_1 = require("./policies.js");
const ServiceTokensAPI = __importStar(require("./service-tokens.js"));
const service_tokens_1 = require("./service-tokens.js");
const TagsAPI = __importStar(require("./tags.js"));
const tags_1 = require("./tags.js");
const ApplicationsAPI = __importStar(require("./applications/applications.js"));
const applications_1 = require("./applications/applications.js");
const CertificatesAPI = __importStar(require("./certificates/certificates.js"));
const certificates_1 = require("./certificates/certificates.js");
const InfrastructureAPI = __importStar(require("./infrastructure/infrastructure.js"));
const infrastructure_1 = require("./infrastructure/infrastructure.js");
const LogsAPI = __importStar(require("./logs/logs.js"));
const logs_1 = require("./logs/logs.js");
const UsersAPI = __importStar(require("./users/users.js"));
const users_1 = require("./users/users.js");
class Access extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.gatewayCA = new GatewayCAAPI.GatewayCA(this._client);
        this.infrastructure = new InfrastructureAPI.Infrastructure(this._client);
        this.applications = new ApplicationsAPI.Applications(this._client);
        this.certificates = new CertificatesAPI.Certificates(this._client);
        this.groups = new GroupsAPI.Groups(this._client);
        this.serviceTokens = new ServiceTokensAPI.ServiceTokens(this._client);
        this.bookmarks = new BookmarksAPI.Bookmarks(this._client);
        this.keys = new KeysAPI.Keys(this._client);
        this.logs = new LogsAPI.Logs(this._client);
        this.users = new UsersAPI.Users(this._client);
        this.customPages = new CustomPagesAPI.CustomPages(this._client);
        this.tags = new TagsAPI.Tags(this._client);
        this.policies = new PoliciesAPI.Policies(this._client);
    }
}
exports.Access = Access;
Access.GatewayCA = gateway_ca_1.GatewayCA;
Access.GatewayCAListResponsesSinglePage = gateway_ca_1.GatewayCAListResponsesSinglePage;
Access.Infrastructure = infrastructure_1.Infrastructure;
Access.Applications = applications_1.Applications;
Access.ApplicationListResponsesSinglePage = applications_1.ApplicationListResponsesSinglePage;
Access.Certificates = certificates_1.Certificates;
Access.CertificatesSinglePage = certificates_1.CertificatesSinglePage;
Access.Groups = groups_1.Groups;
Access.GroupListResponsesSinglePage = groups_1.GroupListResponsesSinglePage;
Access.ServiceTokens = service_tokens_1.ServiceTokens;
Access.ServiceTokensSinglePage = service_tokens_1.ServiceTokensSinglePage;
Access.Bookmarks = bookmarks_1.Bookmarks;
Access.BookmarksSinglePage = bookmarks_1.BookmarksSinglePage;
Access.Keys = keys_1.Keys;
Access.Logs = logs_1.Logs;
Access.Users = users_1.Users;
Access.UserListResponsesSinglePage = users_1.UserListResponsesSinglePage;
Access.CustomPages = custom_pages_1.CustomPages;
Access.CustomPageWithoutHTMLsSinglePage = custom_pages_1.CustomPageWithoutHTMLsSinglePage;
Access.Tags = tags_1.Tags;
Access.TagsSinglePage = tags_1.TagsSinglePage;
Access.Policies = policies_1.Policies;
Access.PolicyListResponsesSinglePage = policies_1.PolicyListResponsesSinglePage;
//# sourceMappingURL=access.js.map