"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  createClerkClient: () => createClerkClient,
  verifyToken: () => verifyToken2
});
module.exports = __toCommonJS(index_exports);
var import_telemetry = require("@clerk/shared/telemetry");

// src/util/path.ts
var SEPARATOR = "/";
var MULTIPLE_SEPARATOR_REGEX = new RegExp("(?<!:)" + SEPARATOR + "{1,}", "g");
function joinPaths(...args) {
  return args.filter((p) => p).join(SEPARATOR).replace(MULTIPLE_SEPARATOR_REGEX, SEPARATOR);
}

// src/api/endpoints/AbstractApi.ts
var AbstractAPI = class {
  constructor(request) {
    this.request = request;
  }
  requireId(id) {
    if (!id) {
      throw new Error("A valid resource ID is required.");
    }
  }
};

// src/api/endpoints/ActorTokenApi.ts
var basePath = "/actor_tokens";
var ActorTokenAPI = class extends AbstractAPI {
  async create(params) {
    return this.request({
      method: "POST",
      path: basePath,
      bodyParams: params
    });
  }
  async revoke(actorTokenId) {
    this.requireId(actorTokenId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath, actorTokenId, "revoke")
    });
  }
};

// src/api/endpoints/AccountlessApplicationsAPI.ts
var basePath2 = "/accountless_applications";
var AccountlessApplicationAPI = class extends AbstractAPI {
  async createAccountlessApplication() {
    return this.request({
      method: "POST",
      path: basePath2
    });
  }
  async completeAccountlessApplicationOnboarding() {
    return this.request({
      method: "POST",
      path: joinPaths(basePath2, "complete")
    });
  }
};

// src/api/endpoints/AllowlistIdentifierApi.ts
var basePath3 = "/allowlist_identifiers";
var AllowlistIdentifierAPI = class extends AbstractAPI {
  async getAllowlistIdentifierList(params = {}) {
    return this.request({
      method: "GET",
      path: basePath3,
      queryParams: { ...params, paginated: true }
    });
  }
  async createAllowlistIdentifier(params) {
    return this.request({
      method: "POST",
      path: basePath3,
      bodyParams: params
    });
  }
  async deleteAllowlistIdentifier(allowlistIdentifierId) {
    this.requireId(allowlistIdentifierId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath3, allowlistIdentifierId)
    });
  }
};

// src/api/endpoints/BetaFeaturesApi.ts
var basePath4 = "/beta_features";
var BetaFeaturesAPI = class extends AbstractAPI {
  /**
   * Change the domain of a production instance.
   *
   * Changing the domain requires updating the DNS records accordingly, deploying new SSL certificates,
   * updating your Social Connection's redirect URLs and setting the new keys in your code.
   *
   * @remarks
   * WARNING: Changing your domain will invalidate all current user sessions (i.e. users will be logged out).
   *          Also, while your application is being deployed, a small downtime is expected to occur.
   */
  async changeDomain(params) {
    return this.request({
      method: "POST",
      path: joinPaths(basePath4, "change_domain"),
      bodyParams: params
    });
  }
};

// src/api/endpoints/BlocklistIdentifierApi.ts
var basePath5 = "/blocklist_identifiers";
var BlocklistIdentifierAPI = class extends AbstractAPI {
  async getBlocklistIdentifierList(params = {}) {
    return this.request({
      method: "GET",
      path: basePath5,
      queryParams: params
    });
  }
  async createBlocklistIdentifier(params) {
    return this.request({
      method: "POST",
      path: basePath5,
      bodyParams: params
    });
  }
  async deleteBlocklistIdentifier(blocklistIdentifierId) {
    this.requireId(blocklistIdentifierId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath5, blocklistIdentifierId)
    });
  }
};

// src/api/endpoints/ClientApi.ts
var basePath6 = "/clients";
var ClientAPI = class extends AbstractAPI {
  async getClientList(params = {}) {
    return this.request({
      method: "GET",
      path: basePath6,
      queryParams: { ...params, paginated: true }
    });
  }
  async getClient(clientId) {
    this.requireId(clientId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath6, clientId)
    });
  }
  verifyClient(token) {
    return this.request({
      method: "POST",
      path: joinPaths(basePath6, "verify"),
      bodyParams: { token }
    });
  }
  async getHandshakePayload(queryParams) {
    return this.request({
      method: "GET",
      path: joinPaths(basePath6, "handshake_payload"),
      queryParams
    });
  }
};

// src/api/endpoints/DomainApi.ts
var basePath7 = "/domains";
var DomainAPI = class extends AbstractAPI {
  async list() {
    return this.request({
      method: "GET",
      path: basePath7
    });
  }
  async add(params) {
    return this.request({
      method: "POST",
      path: basePath7,
      bodyParams: params
    });
  }
  async update(params) {
    const { domainId, ...bodyParams } = params;
    this.requireId(domainId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath7, domainId),
      bodyParams
    });
  }
  /**
   * Deletes a satellite domain for the instance.
   * It is currently not possible to delete the instance's primary domain.
   */
  async delete(satelliteDomainId) {
    return this.deleteDomain(satelliteDomainId);
  }
  /**
   * @deprecated Use `delete` instead
   */
  async deleteDomain(satelliteDomainId) {
    this.requireId(satelliteDomainId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath7, satelliteDomainId)
    });
  }
};

// src/api/endpoints/EmailAddressApi.ts
var basePath8 = "/email_addresses";
var EmailAddressAPI = class extends AbstractAPI {
  async getEmailAddress(emailAddressId) {
    this.requireId(emailAddressId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath8, emailAddressId)
    });
  }
  async createEmailAddress(params) {
    return this.request({
      method: "POST",
      path: basePath8,
      bodyParams: params
    });
  }
  async updateEmailAddress(emailAddressId, params = {}) {
    this.requireId(emailAddressId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath8, emailAddressId),
      bodyParams: params
    });
  }
  async deleteEmailAddress(emailAddressId) {
    this.requireId(emailAddressId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath8, emailAddressId)
    });
  }
};

// src/api/endpoints/InstanceApi.ts
var basePath9 = "/instance";
var InstanceAPI = class extends AbstractAPI {
  async get() {
    return this.request({
      method: "GET",
      path: basePath9
    });
  }
  async update(params) {
    return this.request({
      method: "PATCH",
      path: basePath9,
      bodyParams: params
    });
  }
  async updateRestrictions(params) {
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath9, "restrictions"),
      bodyParams: params
    });
  }
  async updateOrganizationSettings(params) {
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath9, "organization_settings"),
      bodyParams: params
    });
  }
};

// src/api/endpoints/InvitationApi.ts
var basePath10 = "/invitations";
var InvitationAPI = class extends AbstractAPI {
  async getInvitationList(params = {}) {
    return this.request({
      method: "GET",
      path: basePath10,
      queryParams: { ...params, paginated: true }
    });
  }
  async createInvitation(params) {
    return this.request({
      method: "POST",
      path: basePath10,
      bodyParams: params
    });
  }
  async revokeInvitation(invitationId) {
    this.requireId(invitationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath10, invitationId, "revoke")
    });
  }
};

// src/api/endpoints/JwksApi.ts
var basePath11 = "/jwks";
var JwksAPI = class extends AbstractAPI {
  async getJwks() {
    return this.request({
      method: "GET",
      path: basePath11
    });
  }
};

// src/api/endpoints/JwtTemplatesApi.ts
var basePath12 = "/jwt_templates";
var JwtTemplatesApi = class extends AbstractAPI {
  async list(params = {}) {
    return this.request({
      method: "GET",
      path: basePath12,
      queryParams: { ...params, paginated: true }
    });
  }
  async get(templateId) {
    this.requireId(templateId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath12, templateId)
    });
  }
  async create(params) {
    return this.request({
      method: "POST",
      path: basePath12,
      bodyParams: params
    });
  }
  async update(params) {
    const { templateId, ...bodyParams } = params;
    this.requireId(templateId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath12, templateId),
      bodyParams
    });
  }
  async delete(templateId) {
    this.requireId(templateId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath12, templateId)
    });
  }
};

// src/runtime.ts
var import_crypto = require("#crypto");
var globalFetch = fetch.bind(globalThis);
var runtime = {
  crypto: import_crypto.webcrypto,
  get fetch() {
    return process.env.NODE_ENV === "test" ? fetch : globalFetch;
  },
  AbortController: globalThis.AbortController,
  Blob: globalThis.Blob,
  FormData: globalThis.FormData,
  Headers: globalThis.Headers,
  Request: globalThis.Request,
  Response: globalThis.Response
};

// src/api/endpoints/OrganizationApi.ts
var basePath13 = "/organizations";
var OrganizationAPI = class extends AbstractAPI {
  async getOrganizationList(params) {
    return this.request({
      method: "GET",
      path: basePath13,
      queryParams: params
    });
  }
  async createOrganization(params) {
    return this.request({
      method: "POST",
      path: basePath13,
      bodyParams: params
    });
  }
  async getOrganization(params) {
    const { includeMembersCount } = params;
    const organizationIdOrSlug = "organizationId" in params ? params.organizationId : params.slug;
    this.requireId(organizationIdOrSlug);
    return this.request({
      method: "GET",
      path: joinPaths(basePath13, organizationIdOrSlug),
      queryParams: {
        includeMembersCount
      }
    });
  }
  async updateOrganization(organizationId, params) {
    this.requireId(organizationId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath13, organizationId),
      bodyParams: params
    });
  }
  async updateOrganizationLogo(organizationId, params) {
    this.requireId(organizationId);
    const formData = new runtime.FormData();
    formData.append("file", params?.file);
    if (params?.uploaderUserId) {
      formData.append("uploader_user_id", params?.uploaderUserId);
    }
    return this.request({
      method: "PUT",
      path: joinPaths(basePath13, organizationId, "logo"),
      formData
    });
  }
  async deleteOrganizationLogo(organizationId) {
    this.requireId(organizationId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath13, organizationId, "logo")
    });
  }
  async updateOrganizationMetadata(organizationId, params) {
    this.requireId(organizationId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath13, organizationId, "metadata"),
      bodyParams: params
    });
  }
  async deleteOrganization(organizationId) {
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath13, organizationId)
    });
  }
  async getOrganizationMembershipList(params) {
    const { organizationId, ...queryParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath13, organizationId, "memberships"),
      queryParams
    });
  }
  async getInstanceOrganizationMembershipList(params) {
    return this.request({
      method: "GET",
      path: "/organization_memberships",
      queryParams: params
    });
  }
  async createOrganizationMembership(params) {
    const { organizationId, ...bodyParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath13, organizationId, "memberships"),
      bodyParams
    });
  }
  async updateOrganizationMembership(params) {
    const { organizationId, userId, ...bodyParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath13, organizationId, "memberships", userId),
      bodyParams
    });
  }
  async updateOrganizationMembershipMetadata(params) {
    const { organizationId, userId, ...bodyParams } = params;
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath13, organizationId, "memberships", userId, "metadata"),
      bodyParams
    });
  }
  async deleteOrganizationMembership(params) {
    const { organizationId, userId } = params;
    this.requireId(organizationId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath13, organizationId, "memberships", userId)
    });
  }
  async getOrganizationInvitationList(params) {
    const { organizationId, ...queryParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath13, organizationId, "invitations"),
      queryParams
    });
  }
  async createOrganizationInvitation(params) {
    const { organizationId, ...bodyParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath13, organizationId, "invitations"),
      bodyParams
    });
  }
  async createOrganizationInvitationBulk(organizationId, params) {
    this.requireId(organizationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath13, organizationId, "invitations", "bulk"),
      bodyParams: params
    });
  }
  async getOrganizationInvitation(params) {
    const { organizationId, invitationId } = params;
    this.requireId(organizationId);
    this.requireId(invitationId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath13, organizationId, "invitations", invitationId)
    });
  }
  async revokeOrganizationInvitation(params) {
    const { organizationId, invitationId, ...bodyParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath13, organizationId, "invitations", invitationId, "revoke"),
      bodyParams
    });
  }
  async getOrganizationDomainList(params) {
    const { organizationId, ...queryParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath13, organizationId, "domains"),
      queryParams
    });
  }
  async createOrganizationDomain(params) {
    const { organizationId, ...bodyParams } = params;
    this.requireId(organizationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath13, organizationId, "domains"),
      bodyParams: {
        ...bodyParams,
        verified: bodyParams.verified ?? true
      }
    });
  }
  async updateOrganizationDomain(params) {
    const { organizationId, domainId, ...bodyParams } = params;
    this.requireId(organizationId);
    this.requireId(domainId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath13, organizationId, "domains", domainId),
      bodyParams
    });
  }
  async deleteOrganizationDomain(params) {
    const { organizationId, domainId } = params;
    this.requireId(organizationId);
    this.requireId(domainId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath13, organizationId, "domains", domainId)
    });
  }
};

// src/api/endpoints/OAuthApplicationsApi.ts
var basePath14 = "/oauth_applications";
var OAuthApplicationsApi = class extends AbstractAPI {
  async list(params = {}) {
    return this.request({
      method: "GET",
      path: basePath14,
      queryParams: params
    });
  }
  async get(oauthApplicationId) {
    this.requireId(oauthApplicationId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath14, oauthApplicationId)
    });
  }
  async create(params) {
    return this.request({
      method: "POST",
      path: basePath14,
      bodyParams: params
    });
  }
  async update(params) {
    const { oauthApplicationId, ...bodyParams } = params;
    this.requireId(oauthApplicationId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath14, oauthApplicationId),
      bodyParams
    });
  }
  async delete(oauthApplicationId) {
    this.requireId(oauthApplicationId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath14, oauthApplicationId)
    });
  }
  async rotateSecret(oauthApplicationId) {
    this.requireId(oauthApplicationId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath14, oauthApplicationId, "rotate_secret")
    });
  }
};

// src/api/endpoints/PhoneNumberApi.ts
var basePath15 = "/phone_numbers";
var PhoneNumberAPI = class extends AbstractAPI {
  async getPhoneNumber(phoneNumberId) {
    this.requireId(phoneNumberId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath15, phoneNumberId)
    });
  }
  async createPhoneNumber(params) {
    return this.request({
      method: "POST",
      path: basePath15,
      bodyParams: params
    });
  }
  async updatePhoneNumber(phoneNumberId, params = {}) {
    this.requireId(phoneNumberId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath15, phoneNumberId),
      bodyParams: params
    });
  }
  async deletePhoneNumber(phoneNumberId) {
    this.requireId(phoneNumberId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath15, phoneNumberId)
    });
  }
};

// src/api/endpoints/ProxyCheckApi.ts
var basePath16 = "/proxy_checks";
var ProxyCheckAPI = class extends AbstractAPI {
  async verify(params) {
    return this.request({
      method: "POST",
      path: basePath16,
      bodyParams: params
    });
  }
};

// src/api/endpoints/RedirectUrlApi.ts
var basePath17 = "/redirect_urls";
var RedirectUrlAPI = class extends AbstractAPI {
  async getRedirectUrlList() {
    return this.request({
      method: "GET",
      path: basePath17,
      queryParams: { paginated: true }
    });
  }
  async getRedirectUrl(redirectUrlId) {
    this.requireId(redirectUrlId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath17, redirectUrlId)
    });
  }
  async createRedirectUrl(params) {
    return this.request({
      method: "POST",
      path: basePath17,
      bodyParams: params
    });
  }
  async deleteRedirectUrl(redirectUrlId) {
    this.requireId(redirectUrlId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath17, redirectUrlId)
    });
  }
};

// src/api/endpoints/SamlConnectionApi.ts
var basePath18 = "/saml_connections";
var SamlConnectionAPI = class extends AbstractAPI {
  async getSamlConnectionList(params = {}) {
    return this.request({
      method: "GET",
      path: basePath18,
      queryParams: params
    });
  }
  async createSamlConnection(params) {
    return this.request({
      method: "POST",
      path: basePath18,
      bodyParams: params
    });
  }
  async getSamlConnection(samlConnectionId) {
    this.requireId(samlConnectionId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath18, samlConnectionId)
    });
  }
  async updateSamlConnection(samlConnectionId, params = {}) {
    this.requireId(samlConnectionId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath18, samlConnectionId),
      bodyParams: params
    });
  }
  async deleteSamlConnection(samlConnectionId) {
    this.requireId(samlConnectionId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath18, samlConnectionId)
    });
  }
};

// src/api/endpoints/SessionApi.ts
var basePath19 = "/sessions";
var SessionAPI = class extends AbstractAPI {
  async getSessionList(params = {}) {
    return this.request({
      method: "GET",
      path: basePath19,
      queryParams: { ...params, paginated: true }
    });
  }
  async getSession(sessionId) {
    this.requireId(sessionId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath19, sessionId)
    });
  }
  async createSession(params) {
    return this.request({
      method: "POST",
      path: basePath19,
      bodyParams: params
    });
  }
  async revokeSession(sessionId) {
    this.requireId(sessionId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath19, sessionId, "revoke")
    });
  }
  async verifySession(sessionId, token) {
    this.requireId(sessionId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath19, sessionId, "verify"),
      bodyParams: { token }
    });
  }
  async getToken(sessionId, template) {
    this.requireId(sessionId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath19, sessionId, "tokens", template || "")
    });
  }
  async refreshSession(sessionId, params) {
    this.requireId(sessionId);
    const { suffixed_cookies, ...restParams } = params;
    return this.request({
      method: "POST",
      path: joinPaths(basePath19, sessionId, "refresh"),
      bodyParams: restParams,
      queryParams: { suffixed_cookies }
    });
  }
};

// src/api/endpoints/SignInTokenApi.ts
var basePath20 = "/sign_in_tokens";
var SignInTokenAPI = class extends AbstractAPI {
  async createSignInToken(params) {
    return this.request({
      method: "POST",
      path: basePath20,
      bodyParams: params
    });
  }
  async revokeSignInToken(signInTokenId) {
    this.requireId(signInTokenId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath20, signInTokenId, "revoke")
    });
  }
};

// src/api/endpoints/SignUpApi.ts
var basePath21 = "/sign_ups";
var SignUpAPI = class extends AbstractAPI {
  async get(signUpAttemptId) {
    this.requireId(signUpAttemptId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath21, signUpAttemptId)
    });
  }
  async update(params) {
    const { signUpAttemptId, ...bodyParams } = params;
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath21, signUpAttemptId),
      bodyParams
    });
  }
};

// src/api/endpoints/TestingTokenApi.ts
var basePath22 = "/testing_tokens";
var TestingTokenAPI = class extends AbstractAPI {
  async createTestingToken() {
    return this.request({
      method: "POST",
      path: basePath22
    });
  }
};

// src/util/shared.ts
var import_url = require("@clerk/shared/url");
var import_retry = require("@clerk/shared/retry");
var import_keys = require("@clerk/shared/keys");
var import_deprecated = require("@clerk/shared/deprecated");
var import_error = require("@clerk/shared/error");
var import_keys2 = require("@clerk/shared/keys");
var errorThrower = (0, import_error.buildErrorThrower)({ packageName: "@clerk/backend" });
var { isDevOrStagingUrl } = (0, import_keys2.createDevOrStagingUrlCache)();

// src/api/endpoints/UserApi.ts
var basePath23 = "/users";
var UserAPI = class extends AbstractAPI {
  async getUserList(params = {}) {
    const { limit, offset, orderBy, ...userCountParams } = params;
    const [data, totalCount] = await Promise.all([
      this.request({
        method: "GET",
        path: basePath23,
        queryParams: params
      }),
      this.getCount(userCountParams)
    ]);
    return { data, totalCount };
  }
  async getUser(userId) {
    this.requireId(userId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath23, userId)
    });
  }
  async createUser(params) {
    return this.request({
      method: "POST",
      path: basePath23,
      bodyParams: params
    });
  }
  async updateUser(userId, params = {}) {
    this.requireId(userId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath23, userId),
      bodyParams: params
    });
  }
  async updateUserProfileImage(userId, params) {
    this.requireId(userId);
    const formData = new runtime.FormData();
    formData.append("file", params?.file);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "profile_image"),
      formData
    });
  }
  async updateUserMetadata(userId, params) {
    this.requireId(userId);
    return this.request({
      method: "PATCH",
      path: joinPaths(basePath23, userId, "metadata"),
      bodyParams: params
    });
  }
  async deleteUser(userId) {
    this.requireId(userId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, userId)
    });
  }
  async getCount(params = {}) {
    return this.request({
      method: "GET",
      path: joinPaths(basePath23, "count"),
      queryParams: params
    });
  }
  async getUserOauthAccessToken(userId, provider) {
    this.requireId(userId);
    const hasPrefix = provider.startsWith("oauth_");
    const _provider = hasPrefix ? provider : `oauth_${provider}`;
    if (hasPrefix) {
      (0, import_deprecated.deprecated)(
        "getUserOauthAccessToken(userId, provider)",
        "Remove the `oauth_` prefix from the `provider` argument."
      );
    }
    return this.request({
      method: "GET",
      path: joinPaths(basePath23, userId, "oauth_access_tokens", _provider),
      queryParams: { paginated: true }
    });
  }
  async disableUserMFA(userId) {
    this.requireId(userId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, userId, "mfa")
    });
  }
  async getOrganizationMembershipList(params) {
    const { userId, limit, offset } = params;
    this.requireId(userId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath23, userId, "organization_memberships"),
      queryParams: { limit, offset }
    });
  }
  async getOrganizationInvitationList(params) {
    const { userId, ...queryParams } = params;
    this.requireId(userId);
    return this.request({
      method: "GET",
      path: joinPaths(basePath23, userId, "organization_invitations"),
      queryParams
    });
  }
  async verifyPassword(params) {
    const { userId, password } = params;
    this.requireId(userId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "verify_password"),
      bodyParams: { password }
    });
  }
  async verifyTOTP(params) {
    const { userId, code } = params;
    this.requireId(userId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "verify_totp"),
      bodyParams: { code }
    });
  }
  async banUser(userId) {
    this.requireId(userId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "ban")
    });
  }
  async unbanUser(userId) {
    this.requireId(userId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "unban")
    });
  }
  async lockUser(userId) {
    this.requireId(userId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "lock")
    });
  }
  async unlockUser(userId) {
    this.requireId(userId);
    return this.request({
      method: "POST",
      path: joinPaths(basePath23, userId, "unlock")
    });
  }
  async deleteUserProfileImage(userId) {
    this.requireId(userId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, userId, "profile_image")
    });
  }
  async deleteUserPasskey(params) {
    this.requireId(params.userId);
    this.requireId(params.passkeyIdentificationId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, params.userId, "passkeys", params.passkeyIdentificationId)
    });
  }
  async deleteUserWeb3Wallet(params) {
    this.requireId(params.userId);
    this.requireId(params.web3WalletIdentificationId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, params.userId, "web3_wallets", params.web3WalletIdentificationId)
    });
  }
  async deleteUserExternalAccount(params) {
    this.requireId(params.userId);
    this.requireId(params.externalAccountId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, params.userId, "external_accounts", params.externalAccountId)
    });
  }
  async deleteUserBackupCodes(userId) {
    this.requireId(userId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, userId, "backup_code")
    });
  }
  async deleteUserTOTP(userId) {
    this.requireId(userId);
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath23, userId, "totp")
    });
  }
};

// src/api/endpoints/WaitlistEntryApi.ts
var basePath24 = "/waitlist_entries";
var WaitlistEntryAPI = class extends AbstractAPI {
  async list(params = {}) {
    return this.request({
      method: "GET",
      path: basePath24,
      queryParams: params
    });
  }
  async create(params) {
    return this.request({
      method: "POST",
      path: basePath24,
      bodyParams: params
    });
  }
};

// src/api/endpoints/WebhookApi.ts
var basePath25 = "/webhooks";
var WebhookAPI = class extends AbstractAPI {
  async createSvixApp() {
    return this.request({
      method: "POST",
      path: joinPaths(basePath25, "svix")
    });
  }
  async generateSvixAuthURL() {
    return this.request({
      method: "POST",
      path: joinPaths(basePath25, "svix_url")
    });
  }
  async deleteSvixApp() {
    return this.request({
      method: "DELETE",
      path: joinPaths(basePath25, "svix")
    });
  }
};

// src/api/request.ts
var import_error2 = require("@clerk/shared/error");
var import_snakecase_keys = __toESM(require("snakecase-keys"));

// src/constants.ts
var API_URL = "https://api.clerk.com";
var API_VERSION = "v1";
var USER_AGENT = `${"@clerk/backend"}@${"1.34.0"}`;
var MAX_CACHE_LAST_UPDATED_AT_SECONDS = 5 * 60;
var SUPPORTED_BAPI_VERSION = "2025-04-10";
var Attributes = {
  AuthToken: "__clerkAuthToken",
  AuthSignature: "__clerkAuthSignature",
  AuthStatus: "__clerkAuthStatus",
  AuthReason: "__clerkAuthReason",
  AuthMessage: "__clerkAuthMessage",
  ClerkUrl: "__clerkUrl"
};
var Cookies = {
  Session: "__session",
  Refresh: "__refresh",
  ClientUat: "__client_uat",
  Handshake: "__clerk_handshake",
  DevBrowser: "__clerk_db_jwt",
  RedirectCount: "__clerk_redirect_count",
  HandshakeNonce: "__clerk_handshake_nonce"
};
var QueryParameters = {
  ClerkSynced: "__clerk_synced",
  SuffixedCookies: "suffixed_cookies",
  ClerkRedirectUrl: "__clerk_redirect_url",
  // use the reference to Cookies to indicate that it's the same value
  DevBrowser: Cookies.DevBrowser,
  Handshake: Cookies.Handshake,
  HandshakeHelp: "__clerk_help",
  LegacyDevBrowser: "__dev_session",
  HandshakeReason: "__clerk_hs_reason",
  HandshakeNonce: Cookies.HandshakeNonce
};
var Headers2 = {
  Accept: "accept",
  AuthMessage: "x-clerk-auth-message",
  Authorization: "authorization",
  AuthReason: "x-clerk-auth-reason",
  AuthSignature: "x-clerk-auth-signature",
  AuthStatus: "x-clerk-auth-status",
  AuthToken: "x-clerk-auth-token",
  CacheControl: "cache-control",
  ClerkRedirectTo: "x-clerk-redirect-to",
  ClerkRequestData: "x-clerk-request-data",
  ClerkUrl: "x-clerk-clerk-url",
  CloudFrontForwardedProto: "cloudfront-forwarded-proto",
  ContentType: "content-type",
  ContentSecurityPolicy: "content-security-policy",
  ContentSecurityPolicyReportOnly: "content-security-policy-report-only",
  EnableDebug: "x-clerk-debug",
  ForwardedHost: "x-forwarded-host",
  ForwardedPort: "x-forwarded-port",
  ForwardedProto: "x-forwarded-proto",
  Host: "host",
  Location: "location",
  Nonce: "x-nonce",
  Origin: "origin",
  Referrer: "referer",
  SecFetchDest: "sec-fetch-dest",
  UserAgent: "user-agent",
  ReportingEndpoints: "reporting-endpoints"
};
var ContentTypes = {
  Json: "application/json"
};
var constants = {
  Attributes,
  Cookies,
  Headers: Headers2,
  ContentTypes,
  QueryParameters
};

// src/util/optionsAssertions.ts
function assertValidSecretKey(val) {
  if (!val || typeof val !== "string") {
    throw Error("Missing Clerk Secret Key. Go to https://dashboard.clerk.com and get your key for your instance.");
  }
}
function assertValidPublishableKey(val) {
  (0, import_keys.parsePublishableKey)(val, { fatal: true });
}

// src/api/resources/ActorToken.ts
var ActorToken = class _ActorToken {
  constructor(id, status, userId, actor, token, url, createdAt, updatedAt) {
    this.id = id;
    this.status = status;
    this.userId = userId;
    this.actor = actor;
    this.token = token;
    this.url = url;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _ActorToken(
      data.id,
      data.status,
      data.user_id,
      data.actor,
      data.token,
      data.url,
      data.created_at,
      data.updated_at
    );
  }
};

// src/api/resources/AccountlessApplication.ts
var AccountlessApplication = class _AccountlessApplication {
  constructor(publishableKey, secretKey, claimUrl, apiKeysUrl) {
    this.publishableKey = publishableKey;
    this.secretKey = secretKey;
    this.claimUrl = claimUrl;
    this.apiKeysUrl = apiKeysUrl;
  }
  static fromJSON(data) {
    return new _AccountlessApplication(data.publishable_key, data.secret_key, data.claim_url, data.api_keys_url);
  }
};

// src/api/resources/AllowlistIdentifier.ts
var AllowlistIdentifier = class _AllowlistIdentifier {
  constructor(id, identifier, identifierType, createdAt, updatedAt, instanceId, invitationId) {
    this.id = id;
    this.identifier = identifier;
    this.identifierType = identifierType;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.instanceId = instanceId;
    this.invitationId = invitationId;
  }
  static fromJSON(data) {
    return new _AllowlistIdentifier(
      data.id,
      data.identifier,
      data.identifier_type,
      data.created_at,
      data.updated_at,
      data.instance_id,
      data.invitation_id
    );
  }
};

// src/api/resources/BlocklistIdentifier.ts
var BlocklistIdentifier = class _BlocklistIdentifier {
  constructor(id, identifier, identifierType, createdAt, updatedAt, instanceId) {
    this.id = id;
    this.identifier = identifier;
    this.identifierType = identifierType;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.instanceId = instanceId;
  }
  static fromJSON(data) {
    return new _BlocklistIdentifier(
      data.id,
      data.identifier,
      data.identifier_type,
      data.created_at,
      data.updated_at,
      data.instance_id
    );
  }
};

// src/api/resources/Session.ts
var SessionActivity = class _SessionActivity {
  constructor(id, isMobile, ipAddress, city, country, browserVersion, browserName, deviceType) {
    this.id = id;
    this.isMobile = isMobile;
    this.ipAddress = ipAddress;
    this.city = city;
    this.country = country;
    this.browserVersion = browserVersion;
    this.browserName = browserName;
    this.deviceType = deviceType;
  }
  static fromJSON(data) {
    return new _SessionActivity(
      data.id,
      data.is_mobile,
      data.ip_address,
      data.city,
      data.country,
      data.browser_version,
      data.browser_name,
      data.device_type
    );
  }
};
var Session = class _Session {
  constructor(id, clientId, userId, status, lastActiveAt, expireAt, abandonAt, createdAt, updatedAt, lastActiveOrganizationId, latestActivity, actor = null) {
    this.id = id;
    this.clientId = clientId;
    this.userId = userId;
    this.status = status;
    this.lastActiveAt = lastActiveAt;
    this.expireAt = expireAt;
    this.abandonAt = abandonAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.lastActiveOrganizationId = lastActiveOrganizationId;
    this.latestActivity = latestActivity;
    this.actor = actor;
  }
  static fromJSON(data) {
    return new _Session(
      data.id,
      data.client_id,
      data.user_id,
      data.status,
      data.last_active_at,
      data.expire_at,
      data.abandon_at,
      data.created_at,
      data.updated_at,
      data.last_active_organization_id,
      data.latest_activity && SessionActivity.fromJSON(data.latest_activity),
      data.actor
    );
  }
};

// src/api/resources/Client.ts
var Client = class _Client {
  constructor(id, sessionIds, sessions, signInId, signUpId, lastActiveSessionId, createdAt, updatedAt) {
    this.id = id;
    this.sessionIds = sessionIds;
    this.sessions = sessions;
    this.signInId = signInId;
    this.signUpId = signUpId;
    this.lastActiveSessionId = lastActiveSessionId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _Client(
      data.id,
      data.session_ids,
      data.sessions.map((x) => Session.fromJSON(x)),
      data.sign_in_id,
      data.sign_up_id,
      data.last_active_session_id,
      data.created_at,
      data.updated_at
    );
  }
};

// src/api/resources/CnameTarget.ts
var CnameTarget = class _CnameTarget {
  constructor(host, value, required) {
    this.host = host;
    this.value = value;
    this.required = required;
  }
  static fromJSON(data) {
    return new _CnameTarget(data.host, data.value, data.required);
  }
};

// src/api/resources/Cookies.ts
var Cookies2 = class _Cookies {
  constructor(cookies) {
    this.cookies = cookies;
  }
  static fromJSON(data) {
    return new _Cookies(data.cookies);
  }
};

// src/api/resources/DeletedObject.ts
var DeletedObject = class _DeletedObject {
  constructor(object, id, slug, deleted) {
    this.object = object;
    this.id = id;
    this.slug = slug;
    this.deleted = deleted;
  }
  static fromJSON(data) {
    return new _DeletedObject(data.object, data.id || null, data.slug || null, data.deleted);
  }
};

// src/api/resources/Domain.ts
var Domain = class _Domain {
  constructor(id, name, isSatellite, frontendApiUrl, developmentOrigin, cnameTargets, accountsPortalUrl, proxyUrl) {
    this.id = id;
    this.name = name;
    this.isSatellite = isSatellite;
    this.frontendApiUrl = frontendApiUrl;
    this.developmentOrigin = developmentOrigin;
    this.cnameTargets = cnameTargets;
    this.accountsPortalUrl = accountsPortalUrl;
    this.proxyUrl = proxyUrl;
  }
  static fromJSON(data) {
    return new _Domain(
      data.id,
      data.name,
      data.is_satellite,
      data.frontend_api_url,
      data.development_origin,
      data.cname_targets && data.cname_targets.map((x) => CnameTarget.fromJSON(x)),
      data.accounts_portal_url,
      data.proxy_url
    );
  }
};

// src/api/resources/Email.ts
var Email = class _Email {
  constructor(id, fromEmailName, emailAddressId, toEmailAddress, subject, body, bodyPlain, status, slug, data, deliveredByClerk) {
    this.id = id;
    this.fromEmailName = fromEmailName;
    this.emailAddressId = emailAddressId;
    this.toEmailAddress = toEmailAddress;
    this.subject = subject;
    this.body = body;
    this.bodyPlain = bodyPlain;
    this.status = status;
    this.slug = slug;
    this.data = data;
    this.deliveredByClerk = deliveredByClerk;
  }
  static fromJSON(data) {
    return new _Email(
      data.id,
      data.from_email_name,
      data.email_address_id,
      data.to_email_address,
      data.subject,
      data.body,
      data.body_plain,
      data.status,
      data.slug,
      data.data,
      data.delivered_by_clerk
    );
  }
};

// src/api/resources/IdentificationLink.ts
var IdentificationLink = class _IdentificationLink {
  constructor(id, type) {
    this.id = id;
    this.type = type;
  }
  static fromJSON(data) {
    return new _IdentificationLink(data.id, data.type);
  }
};

// src/api/resources/Verification.ts
var Verification = class _Verification {
  constructor(status, strategy, externalVerificationRedirectURL = null, attempts = null, expireAt = null, nonce = null, message = null) {
    this.status = status;
    this.strategy = strategy;
    this.externalVerificationRedirectURL = externalVerificationRedirectURL;
    this.attempts = attempts;
    this.expireAt = expireAt;
    this.nonce = nonce;
    this.message = message;
  }
  static fromJSON(data) {
    return new _Verification(
      data.status,
      data.strategy,
      data.external_verification_redirect_url ? new URL(data.external_verification_redirect_url) : null,
      data.attempts,
      data.expire_at,
      data.nonce
    );
  }
};

// src/api/resources/EmailAddress.ts
var EmailAddress = class _EmailAddress {
  constructor(id, emailAddress, verification, linkedTo) {
    this.id = id;
    this.emailAddress = emailAddress;
    this.verification = verification;
    this.linkedTo = linkedTo;
  }
  static fromJSON(data) {
    return new _EmailAddress(
      data.id,
      data.email_address,
      data.verification && Verification.fromJSON(data.verification),
      data.linked_to.map((link) => IdentificationLink.fromJSON(link))
    );
  }
};

// src/api/resources/ExternalAccount.ts
var ExternalAccount = class _ExternalAccount {
  constructor(id, provider, identificationId, externalId, approvedScopes, emailAddress, firstName, lastName, imageUrl, username, phoneNumber, publicMetadata = {}, label, verification) {
    this.id = id;
    this.provider = provider;
    this.identificationId = identificationId;
    this.externalId = externalId;
    this.approvedScopes = approvedScopes;
    this.emailAddress = emailAddress;
    this.firstName = firstName;
    this.lastName = lastName;
    this.imageUrl = imageUrl;
    this.username = username;
    this.phoneNumber = phoneNumber;
    this.publicMetadata = publicMetadata;
    this.label = label;
    this.verification = verification;
  }
  static fromJSON(data) {
    return new _ExternalAccount(
      data.id,
      data.provider,
      data.identification_id,
      data.provider_user_id,
      data.approved_scopes,
      data.email_address,
      data.first_name,
      data.last_name,
      data.image_url || "",
      data.username,
      data.phone_number,
      data.public_metadata,
      data.label,
      data.verification && Verification.fromJSON(data.verification)
    );
  }
};

// src/api/resources/Instance.ts
var Instance = class _Instance {
  constructor(id, environmentType, allowedOrigins) {
    this.id = id;
    this.environmentType = environmentType;
    this.allowedOrigins = allowedOrigins;
  }
  static fromJSON(data) {
    return new _Instance(data.id, data.environment_type, data.allowed_origins);
  }
};

// src/api/resources/InstanceRestrictions.ts
var InstanceRestrictions = class _InstanceRestrictions {
  constructor(allowlist, blocklist, blockEmailSubaddresses, blockDisposableEmailDomains, ignoreDotsForGmailAddresses) {
    this.allowlist = allowlist;
    this.blocklist = blocklist;
    this.blockEmailSubaddresses = blockEmailSubaddresses;
    this.blockDisposableEmailDomains = blockDisposableEmailDomains;
    this.ignoreDotsForGmailAddresses = ignoreDotsForGmailAddresses;
  }
  static fromJSON(data) {
    return new _InstanceRestrictions(
      data.allowlist,
      data.blocklist,
      data.block_email_subaddresses,
      data.block_disposable_email_domains,
      data.ignore_dots_for_gmail_addresses
    );
  }
};

// src/api/resources/InstanceSettings.ts
var InstanceSettings = class _InstanceSettings {
  constructor(id, restrictedToAllowlist, fromEmailAddress, progressiveSignUp, enhancedEmailDeliverability) {
    this.id = id;
    this.restrictedToAllowlist = restrictedToAllowlist;
    this.fromEmailAddress = fromEmailAddress;
    this.progressiveSignUp = progressiveSignUp;
    this.enhancedEmailDeliverability = enhancedEmailDeliverability;
  }
  static fromJSON(data) {
    return new _InstanceSettings(
      data.id,
      data.restricted_to_allowlist,
      data.from_email_address,
      data.progressive_sign_up,
      data.enhanced_email_deliverability
    );
  }
};

// src/api/resources/Invitation.ts
var Invitation = class _Invitation {
  constructor(id, emailAddress, publicMetadata, createdAt, updatedAt, status, url, revoked) {
    this.id = id;
    this.emailAddress = emailAddress;
    this.publicMetadata = publicMetadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.status = status;
    this.url = url;
    this.revoked = revoked;
    this._raw = null;
  }
  get raw() {
    return this._raw;
  }
  static fromJSON(data) {
    const res = new _Invitation(
      data.id,
      data.email_address,
      data.public_metadata,
      data.created_at,
      data.updated_at,
      data.status,
      data.url,
      data.revoked
    );
    res._raw = data;
    return res;
  }
};

// src/api/resources/JSON.ts
var ObjectType = {
  AccountlessApplication: "accountless_application",
  ActorToken: "actor_token",
  AllowlistIdentifier: "allowlist_identifier",
  BlocklistIdentifier: "blocklist_identifier",
  Client: "client",
  Cookies: "cookies",
  Domain: "domain",
  Email: "email",
  EmailAddress: "email_address",
  ExternalAccount: "external_account",
  FacebookAccount: "facebook_account",
  GoogleAccount: "google_account",
  Instance: "instance",
  InstanceRestrictions: "instance_restrictions",
  InstanceSettings: "instance_settings",
  Invitation: "invitation",
  JwtTemplate: "jwt_template",
  OauthAccessToken: "oauth_access_token",
  OAuthApplication: "oauth_application",
  Organization: "organization",
  OrganizationDomain: "organization_domain",
  OrganizationInvitation: "organization_invitation",
  OrganizationMembership: "organization_membership",
  OrganizationSettings: "organization_settings",
  PhoneNumber: "phone_number",
  ProxyCheck: "proxy_check",
  RedirectUrl: "redirect_url",
  SamlAccount: "saml_account",
  SamlConnection: "saml_connection",
  Session: "session",
  SignInAttempt: "sign_in_attempt",
  SignInToken: "sign_in_token",
  SignUpAttempt: "sign_up_attempt",
  SmsMessage: "sms_message",
  User: "user",
  WaitlistEntry: "waitlist_entry",
  Web3Wallet: "web3_wallet",
  Token: "token",
  TotalCount: "total_count",
  TestingToken: "testing_token",
  Role: "role",
  Permission: "permission"
};

// src/api/resources/JwtTemplate.ts
var JwtTemplate = class _JwtTemplate {
  constructor(id, name, claims, lifetime, allowedClockSkew, customSigningKey, signingAlgorithm, createdAt, updatedAt) {
    this.id = id;
    this.name = name;
    this.claims = claims;
    this.lifetime = lifetime;
    this.allowedClockSkew = allowedClockSkew;
    this.customSigningKey = customSigningKey;
    this.signingAlgorithm = signingAlgorithm;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _JwtTemplate(
      data.id,
      data.name,
      data.claims,
      data.lifetime,
      data.allowed_clock_skew,
      data.custom_signing_key,
      data.signing_algorithm,
      data.created_at,
      data.updated_at
    );
  }
};

// src/api/resources/OauthAccessToken.ts
var OauthAccessToken = class _OauthAccessToken {
  constructor(externalAccountId, provider, token, publicMetadata = {}, label, scopes, tokenSecret, expiresAt) {
    this.externalAccountId = externalAccountId;
    this.provider = provider;
    this.token = token;
    this.publicMetadata = publicMetadata;
    this.label = label;
    this.scopes = scopes;
    this.tokenSecret = tokenSecret;
    this.expiresAt = expiresAt;
  }
  static fromJSON(data) {
    return new _OauthAccessToken(
      data.external_account_id,
      data.provider,
      data.token,
      data.public_metadata,
      data.label || "",
      data.scopes,
      data.token_secret,
      data.expires_at
    );
  }
};

// src/api/resources/OAuthApplication.ts
var OAuthApplication = class _OAuthApplication {
  constructor(id, instanceId, name, clientId, isPublic, scopes, redirectUris, authorizeUrl, tokenFetchUrl, userInfoUrl, discoveryUrl, tokenIntrospectionUrl, createdAt, updatedAt, clientSecret) {
    this.id = id;
    this.instanceId = instanceId;
    this.name = name;
    this.clientId = clientId;
    this.isPublic = isPublic;
    this.scopes = scopes;
    this.redirectUris = redirectUris;
    this.authorizeUrl = authorizeUrl;
    this.tokenFetchUrl = tokenFetchUrl;
    this.userInfoUrl = userInfoUrl;
    this.discoveryUrl = discoveryUrl;
    this.tokenIntrospectionUrl = tokenIntrospectionUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.clientSecret = clientSecret;
  }
  static fromJSON(data) {
    return new _OAuthApplication(
      data.id,
      data.instance_id,
      data.name,
      data.client_id,
      data.public,
      data.scopes,
      data.redirect_uris,
      data.authorize_url,
      data.token_fetch_url,
      data.user_info_url,
      data.discovery_url,
      data.token_introspection_url,
      data.created_at,
      data.updated_at,
      data.client_secret
    );
  }
};

// src/api/resources/Organization.ts
var Organization = class _Organization {
  constructor(id, name, slug, imageUrl, hasImage, createdAt, updatedAt, publicMetadata = {}, privateMetadata = {}, maxAllowedMemberships, adminDeleteEnabled, membersCount, createdBy) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.imageUrl = imageUrl;
    this.hasImage = hasImage;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.publicMetadata = publicMetadata;
    this.privateMetadata = privateMetadata;
    this.maxAllowedMemberships = maxAllowedMemberships;
    this.adminDeleteEnabled = adminDeleteEnabled;
    this.membersCount = membersCount;
    this.createdBy = createdBy;
    this._raw = null;
  }
  get raw() {
    return this._raw;
  }
  static fromJSON(data) {
    const res = new _Organization(
      data.id,
      data.name,
      data.slug,
      data.image_url || "",
      data.has_image,
      data.created_at,
      data.updated_at,
      data.public_metadata,
      data.private_metadata,
      data.max_allowed_memberships,
      data.admin_delete_enabled,
      data.members_count,
      data.created_by
    );
    res._raw = data;
    return res;
  }
};

// src/api/resources/OrganizationInvitation.ts
var OrganizationInvitation = class _OrganizationInvitation {
  constructor(id, emailAddress, role, roleName, organizationId, createdAt, updatedAt, expiresAt, url, status, publicMetadata = {}, privateMetadata = {}, publicOrganizationData) {
    this.id = id;
    this.emailAddress = emailAddress;
    this.role = role;
    this.roleName = roleName;
    this.organizationId = organizationId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.expiresAt = expiresAt;
    this.url = url;
    this.status = status;
    this.publicMetadata = publicMetadata;
    this.privateMetadata = privateMetadata;
    this.publicOrganizationData = publicOrganizationData;
    this._raw = null;
  }
  get raw() {
    return this._raw;
  }
  static fromJSON(data) {
    const res = new _OrganizationInvitation(
      data.id,
      data.email_address,
      data.role,
      data.role_name,
      data.organization_id,
      data.created_at,
      data.updated_at,
      data.expires_at,
      data.url,
      data.status,
      data.public_metadata,
      data.private_metadata,
      data.public_organization_data
    );
    res._raw = data;
    return res;
  }
};

// src/api/resources/OrganizationMembership.ts
var OrganizationMembership = class _OrganizationMembership {
  constructor(id, role, permissions, publicMetadata = {}, privateMetadata = {}, createdAt, updatedAt, organization, publicUserData) {
    this.id = id;
    this.role = role;
    this.permissions = permissions;
    this.publicMetadata = publicMetadata;
    this.privateMetadata = privateMetadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.organization = organization;
    this.publicUserData = publicUserData;
    this._raw = null;
  }
  get raw() {
    return this._raw;
  }
  static fromJSON(data) {
    const res = new _OrganizationMembership(
      data.id,
      data.role,
      data.permissions,
      data.public_metadata,
      data.private_metadata,
      data.created_at,
      data.updated_at,
      Organization.fromJSON(data.organization),
      OrganizationMembershipPublicUserData.fromJSON(data.public_user_data)
    );
    res._raw = data;
    return res;
  }
};
var OrganizationMembershipPublicUserData = class _OrganizationMembershipPublicUserData {
  constructor(identifier, firstName, lastName, imageUrl, hasImage, userId) {
    this.identifier = identifier;
    this.firstName = firstName;
    this.lastName = lastName;
    this.imageUrl = imageUrl;
    this.hasImage = hasImage;
    this.userId = userId;
  }
  static fromJSON(data) {
    return new _OrganizationMembershipPublicUserData(
      data.identifier,
      data.first_name,
      data.last_name,
      data.image_url,
      data.has_image,
      data.user_id
    );
  }
};

// src/api/resources/OrganizationSettings.ts
var OrganizationSettings = class _OrganizationSettings {
  constructor(enabled, maxAllowedMemberships, maxAllowedRoles, maxAllowedPermissions, creatorRole, adminDeleteEnabled, domainsEnabled, domainsEnrollmentModes, domainsDefaultRole) {
    this.enabled = enabled;
    this.maxAllowedMemberships = maxAllowedMemberships;
    this.maxAllowedRoles = maxAllowedRoles;
    this.maxAllowedPermissions = maxAllowedPermissions;
    this.creatorRole = creatorRole;
    this.adminDeleteEnabled = adminDeleteEnabled;
    this.domainsEnabled = domainsEnabled;
    this.domainsEnrollmentModes = domainsEnrollmentModes;
    this.domainsDefaultRole = domainsDefaultRole;
  }
  static fromJSON(data) {
    return new _OrganizationSettings(
      data.enabled,
      data.max_allowed_memberships,
      data.max_allowed_roles,
      data.max_allowed_permissions,
      data.creator_role,
      data.admin_delete_enabled,
      data.domains_enabled,
      data.domains_enrollment_modes,
      data.domains_default_role
    );
  }
};

// src/api/resources/PhoneNumber.ts
var PhoneNumber = class _PhoneNumber {
  constructor(id, phoneNumber, reservedForSecondFactor, defaultSecondFactor, verification, linkedTo) {
    this.id = id;
    this.phoneNumber = phoneNumber;
    this.reservedForSecondFactor = reservedForSecondFactor;
    this.defaultSecondFactor = defaultSecondFactor;
    this.verification = verification;
    this.linkedTo = linkedTo;
  }
  static fromJSON(data) {
    return new _PhoneNumber(
      data.id,
      data.phone_number,
      data.reserved_for_second_factor,
      data.default_second_factor,
      data.verification && Verification.fromJSON(data.verification),
      data.linked_to.map((link) => IdentificationLink.fromJSON(link))
    );
  }
};

// src/api/resources/ProxyCheck.ts
var ProxyCheck = class _ProxyCheck {
  constructor(id, domainId, lastRunAt, proxyUrl, successful, createdAt, updatedAt) {
    this.id = id;
    this.domainId = domainId;
    this.lastRunAt = lastRunAt;
    this.proxyUrl = proxyUrl;
    this.successful = successful;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _ProxyCheck(
      data.id,
      data.domain_id,
      data.last_run_at,
      data.proxy_url,
      data.successful,
      data.created_at,
      data.updated_at
    );
  }
};

// src/api/resources/RedirectUrl.ts
var RedirectUrl = class _RedirectUrl {
  constructor(id, url, createdAt, updatedAt) {
    this.id = id;
    this.url = url;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _RedirectUrl(data.id, data.url, data.created_at, data.updated_at);
  }
};

// src/api/resources/SignInTokens.ts
var SignInToken = class _SignInToken {
  constructor(id, userId, token, status, url, createdAt, updatedAt) {
    this.id = id;
    this.userId = userId;
    this.token = token;
    this.status = status;
    this.url = url;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _SignInToken(data.id, data.user_id, data.token, data.status, data.url, data.created_at, data.updated_at);
  }
};

// src/api/resources/SignUpAttempt.ts
var SignUpAttemptVerification = class _SignUpAttemptVerification {
  constructor(nextAction, supportedStrategies) {
    this.nextAction = nextAction;
    this.supportedStrategies = supportedStrategies;
  }
  static fromJSON(data) {
    return new _SignUpAttemptVerification(data.next_action, data.supported_strategies);
  }
};
var SignUpAttemptVerifications = class _SignUpAttemptVerifications {
  constructor(emailAddress, phoneNumber, web3Wallet, externalAccount) {
    this.emailAddress = emailAddress;
    this.phoneNumber = phoneNumber;
    this.web3Wallet = web3Wallet;
    this.externalAccount = externalAccount;
  }
  static fromJSON(data) {
    return new _SignUpAttemptVerifications(
      data.email_address && SignUpAttemptVerification.fromJSON(data.email_address),
      data.phone_number && SignUpAttemptVerification.fromJSON(data.phone_number),
      data.web3_wallet && SignUpAttemptVerification.fromJSON(data.web3_wallet),
      data.external_account
    );
  }
};
var SignUpAttempt = class _SignUpAttempt {
  constructor(id, status, requiredFields, optionalFields, missingFields, unverifiedFields, verifications, username, emailAddress, phoneNumber, web3Wallet, passwordEnabled, firstName, lastName, customAction, externalId, createdSessionId, createdUserId, abandonAt, legalAcceptedAt, publicMetadata, unsafeMetadata) {
    this.id = id;
    this.status = status;
    this.requiredFields = requiredFields;
    this.optionalFields = optionalFields;
    this.missingFields = missingFields;
    this.unverifiedFields = unverifiedFields;
    this.verifications = verifications;
    this.username = username;
    this.emailAddress = emailAddress;
    this.phoneNumber = phoneNumber;
    this.web3Wallet = web3Wallet;
    this.passwordEnabled = passwordEnabled;
    this.firstName = firstName;
    this.lastName = lastName;
    this.customAction = customAction;
    this.externalId = externalId;
    this.createdSessionId = createdSessionId;
    this.createdUserId = createdUserId;
    this.abandonAt = abandonAt;
    this.legalAcceptedAt = legalAcceptedAt;
    this.publicMetadata = publicMetadata;
    this.unsafeMetadata = unsafeMetadata;
  }
  static fromJSON(data) {
    return new _SignUpAttempt(
      data.id,
      data.status,
      data.required_fields,
      data.optional_fields,
      data.missing_fields,
      data.unverified_fields,
      data.verifications ? SignUpAttemptVerifications.fromJSON(data.verifications) : null,
      data.username,
      data.email_address,
      data.phone_number,
      data.web3_wallet,
      data.password_enabled,
      data.first_name,
      data.last_name,
      data.custom_action,
      data.external_id,
      data.created_session_id,
      data.created_user_id,
      data.abandon_at,
      data.legal_accepted_at,
      data.public_metadata,
      data.unsafe_metadata
    );
  }
};

// src/api/resources/SMSMessage.ts
var SMSMessage = class _SMSMessage {
  constructor(id, fromPhoneNumber, toPhoneNumber, message, status, phoneNumberId, data) {
    this.id = id;
    this.fromPhoneNumber = fromPhoneNumber;
    this.toPhoneNumber = toPhoneNumber;
    this.message = message;
    this.status = status;
    this.phoneNumberId = phoneNumberId;
    this.data = data;
  }
  static fromJSON(data) {
    return new _SMSMessage(
      data.id,
      data.from_phone_number,
      data.to_phone_number,
      data.message,
      data.status,
      data.phone_number_id,
      data.data
    );
  }
};

// src/api/resources/Token.ts
var Token = class _Token {
  constructor(jwt) {
    this.jwt = jwt;
  }
  static fromJSON(data) {
    return new _Token(data.jwt);
  }
};

// src/api/resources/SamlConnection.ts
var SamlConnection = class _SamlConnection {
  constructor(id, name, domain, organizationId, idpEntityId, idpSsoUrl, idpCertificate, idpMetadataUrl, idpMetadata, acsUrl, spEntityId, spMetadataUrl, active, provider, userCount, syncUserAttributes, allowSubdomains, allowIdpInitiated, createdAt, updatedAt, attributeMapping) {
    this.id = id;
    this.name = name;
    this.domain = domain;
    this.organizationId = organizationId;
    this.idpEntityId = idpEntityId;
    this.idpSsoUrl = idpSsoUrl;
    this.idpCertificate = idpCertificate;
    this.idpMetadataUrl = idpMetadataUrl;
    this.idpMetadata = idpMetadata;
    this.acsUrl = acsUrl;
    this.spEntityId = spEntityId;
    this.spMetadataUrl = spMetadataUrl;
    this.active = active;
    this.provider = provider;
    this.userCount = userCount;
    this.syncUserAttributes = syncUserAttributes;
    this.allowSubdomains = allowSubdomains;
    this.allowIdpInitiated = allowIdpInitiated;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.attributeMapping = attributeMapping;
  }
  static fromJSON(data) {
    return new _SamlConnection(
      data.id,
      data.name,
      data.domain,
      data.organization_id,
      data.idp_entity_id,
      data.idp_sso_url,
      data.idp_certificate,
      data.idp_metadata_url,
      data.idp_metadata,
      data.acs_url,
      data.sp_entity_id,
      data.sp_metadata_url,
      data.active,
      data.provider,
      data.user_count,
      data.sync_user_attributes,
      data.allow_subdomains,
      data.allow_idp_initiated,
      data.created_at,
      data.updated_at,
      data.attribute_mapping && AttributeMapping.fromJSON(data.attribute_mapping)
    );
  }
};
var SamlAccountConnection = class _SamlAccountConnection {
  constructor(id, name, domain, active, provider, syncUserAttributes, allowSubdomains, allowIdpInitiated, createdAt, updatedAt) {
    this.id = id;
    this.name = name;
    this.domain = domain;
    this.active = active;
    this.provider = provider;
    this.syncUserAttributes = syncUserAttributes;
    this.allowSubdomains = allowSubdomains;
    this.allowIdpInitiated = allowIdpInitiated;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
  static fromJSON(data) {
    return new _SamlAccountConnection(
      data.id,
      data.name,
      data.domain,
      data.active,
      data.provider,
      data.sync_user_attributes,
      data.allow_subdomains,
      data.allow_idp_initiated,
      data.created_at,
      data.updated_at
    );
  }
};
var AttributeMapping = class _AttributeMapping {
  constructor(userId, emailAddress, firstName, lastName) {
    this.userId = userId;
    this.emailAddress = emailAddress;
    this.firstName = firstName;
    this.lastName = lastName;
  }
  static fromJSON(data) {
    return new _AttributeMapping(data.user_id, data.email_address, data.first_name, data.last_name);
  }
};

// src/api/resources/SamlAccount.ts
var SamlAccount = class _SamlAccount {
  constructor(id, provider, providerUserId, active, emailAddress, firstName, lastName, verification, samlConnection) {
    this.id = id;
    this.provider = provider;
    this.providerUserId = providerUserId;
    this.active = active;
    this.emailAddress = emailAddress;
    this.firstName = firstName;
    this.lastName = lastName;
    this.verification = verification;
    this.samlConnection = samlConnection;
  }
  static fromJSON(data) {
    return new _SamlAccount(
      data.id,
      data.provider,
      data.provider_user_id,
      data.active,
      data.email_address,
      data.first_name,
      data.last_name,
      data.verification && Verification.fromJSON(data.verification),
      data.saml_connection && SamlAccountConnection.fromJSON(data.saml_connection)
    );
  }
};

// src/api/resources/Web3Wallet.ts
var Web3Wallet = class _Web3Wallet {
  constructor(id, web3Wallet, verification) {
    this.id = id;
    this.web3Wallet = web3Wallet;
    this.verification = verification;
  }
  static fromJSON(data) {
    return new _Web3Wallet(data.id, data.web3_wallet, data.verification && Verification.fromJSON(data.verification));
  }
};

// src/api/resources/User.ts
var User = class _User {
  constructor(id, passwordEnabled, totpEnabled, backupCodeEnabled, twoFactorEnabled, banned, locked, createdAt, updatedAt, imageUrl, hasImage, primaryEmailAddressId, primaryPhoneNumberId, primaryWeb3WalletId, lastSignInAt, externalId, username, firstName, lastName, publicMetadata = {}, privateMetadata = {}, unsafeMetadata = {}, emailAddresses = [], phoneNumbers = [], web3Wallets = [], externalAccounts = [], samlAccounts = [], lastActiveAt, createOrganizationEnabled, createOrganizationsLimit = null, deleteSelfEnabled, legalAcceptedAt) {
    this.id = id;
    this.passwordEnabled = passwordEnabled;
    this.totpEnabled = totpEnabled;
    this.backupCodeEnabled = backupCodeEnabled;
    this.twoFactorEnabled = twoFactorEnabled;
    this.banned = banned;
    this.locked = locked;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.imageUrl = imageUrl;
    this.hasImage = hasImage;
    this.primaryEmailAddressId = primaryEmailAddressId;
    this.primaryPhoneNumberId = primaryPhoneNumberId;
    this.primaryWeb3WalletId = primaryWeb3WalletId;
    this.lastSignInAt = lastSignInAt;
    this.externalId = externalId;
    this.username = username;
    this.firstName = firstName;
    this.lastName = lastName;
    this.publicMetadata = publicMetadata;
    this.privateMetadata = privateMetadata;
    this.unsafeMetadata = unsafeMetadata;
    this.emailAddresses = emailAddresses;
    this.phoneNumbers = phoneNumbers;
    this.web3Wallets = web3Wallets;
    this.externalAccounts = externalAccounts;
    this.samlAccounts = samlAccounts;
    this.lastActiveAt = lastActiveAt;
    this.createOrganizationEnabled = createOrganizationEnabled;
    this.createOrganizationsLimit = createOrganizationsLimit;
    this.deleteSelfEnabled = deleteSelfEnabled;
    this.legalAcceptedAt = legalAcceptedAt;
    this._raw = null;
  }
  get raw() {
    return this._raw;
  }
  static fromJSON(data) {
    const res = new _User(
      data.id,
      data.password_enabled,
      data.totp_enabled,
      data.backup_code_enabled,
      data.two_factor_enabled,
      data.banned,
      data.locked,
      data.created_at,
      data.updated_at,
      data.image_url,
      data.has_image,
      data.primary_email_address_id,
      data.primary_phone_number_id,
      data.primary_web3_wallet_id,
      data.last_sign_in_at,
      data.external_id,
      data.username,
      data.first_name,
      data.last_name,
      data.public_metadata,
      data.private_metadata,
      data.unsafe_metadata,
      (data.email_addresses || []).map((x) => EmailAddress.fromJSON(x)),
      (data.phone_numbers || []).map((x) => PhoneNumber.fromJSON(x)),
      (data.web3_wallets || []).map((x) => Web3Wallet.fromJSON(x)),
      (data.external_accounts || []).map((x) => ExternalAccount.fromJSON(x)),
      (data.saml_accounts || []).map((x) => SamlAccount.fromJSON(x)),
      data.last_active_at,
      data.create_organization_enabled,
      data.create_organizations_limit,
      data.delete_self_enabled,
      data.legal_accepted_at
    );
    res._raw = data;
    return res;
  }
  get primaryEmailAddress() {
    return this.emailAddresses.find(({ id }) => id === this.primaryEmailAddressId) ?? null;
  }
  get primaryPhoneNumber() {
    return this.phoneNumbers.find(({ id }) => id === this.primaryPhoneNumberId) ?? null;
  }
  get primaryWeb3Wallet() {
    return this.web3Wallets.find(({ id }) => id === this.primaryWeb3WalletId) ?? null;
  }
  get fullName() {
    return [this.firstName, this.lastName].join(" ").trim() || null;
  }
};

// src/api/resources/WaitlistEntry.ts
var WaitlistEntry = class _WaitlistEntry {
  constructor(id, emailAddress, status, invitation, createdAt, updatedAt, isLocked) {
    this.id = id;
    this.emailAddress = emailAddress;
    this.status = status;
    this.invitation = invitation;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.isLocked = isLocked;
  }
  static fromJSON(data) {
    return new _WaitlistEntry(
      data.id,
      data.email_address,
      data.status,
      data.invitation && Invitation.fromJSON(data.invitation),
      data.created_at,
      data.updated_at,
      data.is_locked
    );
  }
};

// src/api/resources/Deserializer.ts
function deserialize(payload) {
  let data, totalCount;
  if (Array.isArray(payload)) {
    const data2 = payload.map((item) => jsonToObject(item));
    return { data: data2 };
  } else if (isPaginated(payload)) {
    data = payload.data.map((item) => jsonToObject(item));
    totalCount = payload.total_count;
    return { data, totalCount };
  } else {
    return { data: jsonToObject(payload) };
  }
}
function isPaginated(payload) {
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    return false;
  }
  return Array.isArray(payload.data) && payload.data !== void 0;
}
function getCount(item) {
  return item.total_count;
}
function jsonToObject(item) {
  if (typeof item !== "string" && "object" in item && "deleted" in item) {
    return DeletedObject.fromJSON(item);
  }
  switch (item.object) {
    case ObjectType.AccountlessApplication:
      return AccountlessApplication.fromJSON(item);
    case ObjectType.ActorToken:
      return ActorToken.fromJSON(item);
    case ObjectType.AllowlistIdentifier:
      return AllowlistIdentifier.fromJSON(item);
    case ObjectType.BlocklistIdentifier:
      return BlocklistIdentifier.fromJSON(item);
    case ObjectType.Client:
      return Client.fromJSON(item);
    case ObjectType.Cookies:
      return Cookies2.fromJSON(item);
    case ObjectType.Domain:
      return Domain.fromJSON(item);
    case ObjectType.EmailAddress:
      return EmailAddress.fromJSON(item);
    case ObjectType.Email:
      return Email.fromJSON(item);
    case ObjectType.Instance:
      return Instance.fromJSON(item);
    case ObjectType.InstanceRestrictions:
      return InstanceRestrictions.fromJSON(item);
    case ObjectType.InstanceSettings:
      return InstanceSettings.fromJSON(item);
    case ObjectType.Invitation:
      return Invitation.fromJSON(item);
    case ObjectType.JwtTemplate:
      return JwtTemplate.fromJSON(item);
    case ObjectType.OauthAccessToken:
      return OauthAccessToken.fromJSON(item);
    case ObjectType.OAuthApplication:
      return OAuthApplication.fromJSON(item);
    case ObjectType.Organization:
      return Organization.fromJSON(item);
    case ObjectType.OrganizationInvitation:
      return OrganizationInvitation.fromJSON(item);
    case ObjectType.OrganizationMembership:
      return OrganizationMembership.fromJSON(item);
    case ObjectType.OrganizationSettings:
      return OrganizationSettings.fromJSON(item);
    case ObjectType.PhoneNumber:
      return PhoneNumber.fromJSON(item);
    case ObjectType.ProxyCheck:
      return ProxyCheck.fromJSON(item);
    case ObjectType.RedirectUrl:
      return RedirectUrl.fromJSON(item);
    case ObjectType.SamlConnection:
      return SamlConnection.fromJSON(item);
    case ObjectType.SignInToken:
      return SignInToken.fromJSON(item);
    case ObjectType.SignUpAttempt:
      return SignUpAttempt.fromJSON(item);
    case ObjectType.Session:
      return Session.fromJSON(item);
    case ObjectType.SmsMessage:
      return SMSMessage.fromJSON(item);
    case ObjectType.Token:
      return Token.fromJSON(item);
    case ObjectType.TotalCount:
      return getCount(item);
    case ObjectType.User:
      return User.fromJSON(item);
    case ObjectType.WaitlistEntry:
      return WaitlistEntry.fromJSON(item);
    default:
      return item;
  }
}

// src/api/request.ts
function buildRequest(options) {
  const requestFn = async (requestOptions) => {
    const {
      secretKey,
      requireSecretKey = true,
      apiUrl = API_URL,
      apiVersion = API_VERSION,
      userAgent = USER_AGENT
    } = options;
    const { path, method, queryParams, headerParams, bodyParams, formData } = requestOptions;
    if (requireSecretKey) {
      assertValidSecretKey(secretKey);
    }
    const url = joinPaths(apiUrl, apiVersion, path);
    const finalUrl = new URL(url);
    if (queryParams) {
      const snakecasedQueryParams = (0, import_snakecase_keys.default)({ ...queryParams });
      for (const [key, val] of Object.entries(snakecasedQueryParams)) {
        if (val) {
          [val].flat().forEach((v) => finalUrl.searchParams.append(key, v));
        }
      }
    }
    const headers = {
      "Clerk-API-Version": SUPPORTED_BAPI_VERSION,
      "User-Agent": userAgent,
      ...headerParams
    };
    if (secretKey) {
      headers.Authorization = `Bearer ${secretKey}`;
    }
    let res;
    try {
      if (formData) {
        res = await runtime.fetch(finalUrl.href, {
          method,
          headers,
          body: formData
        });
      } else {
        headers["Content-Type"] = "application/json";
        const buildBody = () => {
          const hasBody = method !== "GET" && bodyParams && Object.keys(bodyParams).length > 0;
          if (!hasBody) {
            return null;
          }
          const formatKeys = (object) => (0, import_snakecase_keys.default)(object, { deep: false });
          return {
            body: JSON.stringify(Array.isArray(bodyParams) ? bodyParams.map(formatKeys) : formatKeys(bodyParams))
          };
        };
        res = await runtime.fetch(finalUrl.href, {
          method,
          headers,
          ...buildBody()
        });
      }
      const isJSONResponse = res?.headers && res.headers?.get(constants.Headers.ContentType) === constants.ContentTypes.Json;
      const responseBody = await (isJSONResponse ? res.json() : res.text());
      if (!res.ok) {
        return {
          data: null,
          errors: parseErrors(responseBody),
          status: res?.status,
          statusText: res?.statusText,
          clerkTraceId: getTraceId(responseBody, res?.headers),
          retryAfter: getRetryAfter(res?.headers)
        };
      }
      return {
        ...deserialize(responseBody),
        errors: null
      };
    } catch (err) {
      if (err instanceof Error) {
        return {
          data: null,
          errors: [
            {
              code: "unexpected_error",
              message: err.message || "Unexpected error"
            }
          ],
          clerkTraceId: getTraceId(err, res?.headers)
        };
      }
      return {
        data: null,
        errors: parseErrors(err),
        status: res?.status,
        statusText: res?.statusText,
        clerkTraceId: getTraceId(err, res?.headers),
        retryAfter: getRetryAfter(res?.headers)
      };
    }
  };
  return withLegacyRequestReturn(requestFn);
}
function getTraceId(data, headers) {
  if (data && typeof data === "object" && "clerk_trace_id" in data && typeof data.clerk_trace_id === "string") {
    return data.clerk_trace_id;
  }
  const cfRay = headers?.get("cf-ray");
  return cfRay || "";
}
function getRetryAfter(headers) {
  const retryAfter = headers?.get("Retry-After");
  if (!retryAfter) return;
  const value = parseInt(retryAfter, 10);
  if (isNaN(value)) return;
  return value;
}
function parseErrors(data) {
  if (!!data && typeof data === "object" && "errors" in data) {
    const errors = data.errors;
    return errors.length > 0 ? errors.map(import_error2.parseError) : [];
  }
  return [];
}
function withLegacyRequestReturn(cb) {
  return async (...args) => {
    const { data, errors, totalCount, status, statusText, clerkTraceId, retryAfter } = await cb(...args);
    if (errors) {
      const error = new import_error2.ClerkAPIResponseError(statusText || "", {
        data: [],
        status,
        clerkTraceId,
        retryAfter
      });
      error.errors = errors;
      throw error;
    }
    if (typeof totalCount !== "undefined") {
      return { data, totalCount };
    }
    return data;
  };
}

// src/api/factory.ts
function createBackendApiClient(options) {
  const request = buildRequest(options);
  return {
    __experimental_accountlessApplications: new AccountlessApplicationAPI(
      buildRequest({ ...options, requireSecretKey: false })
    ),
    actorTokens: new ActorTokenAPI(request),
    allowlistIdentifiers: new AllowlistIdentifierAPI(request),
    betaFeatures: new BetaFeaturesAPI(request),
    blocklistIdentifiers: new BlocklistIdentifierAPI(request),
    clients: new ClientAPI(request),
    domains: new DomainAPI(request),
    emailAddresses: new EmailAddressAPI(request),
    instance: new InstanceAPI(request),
    invitations: new InvitationAPI(request),
    jwks: new JwksAPI(request),
    jwtTemplates: new JwtTemplatesApi(request),
    oauthApplications: new OAuthApplicationsApi(request),
    organizations: new OrganizationAPI(request),
    phoneNumbers: new PhoneNumberAPI(request),
    proxyChecks: new ProxyCheckAPI(request),
    redirectUrls: new RedirectUrlAPI(request),
    samlConnections: new SamlConnectionAPI(request),
    sessions: new SessionAPI(request),
    signInTokens: new SignInTokenAPI(request),
    signUps: new SignUpAPI(request),
    testingTokens: new TestingTokenAPI(request),
    users: new UserAPI(request),
    waitlistEntries: new WaitlistEntryAPI(request),
    webhooks: new WebhookAPI(request)
  };
}

// src/jwt/legacyReturn.ts
function withLegacyReturn(cb) {
  return async (...args) => {
    const { data, errors } = await cb(...args);
    if (errors) {
      throw errors[0];
    }
    return data;
  };
}

// src/util/mergePreDefinedOptions.ts
function mergePreDefinedOptions(preDefinedOptions, options) {
  return Object.keys(preDefinedOptions).reduce(
    (obj, key) => {
      return { ...obj, [key]: options[key] || obj[key] };
    },
    { ...preDefinedOptions }
  );
}

// src/errors.ts
var TokenVerificationErrorCode = {
  InvalidSecretKey: "clerk_key_invalid"
};
var TokenVerificationErrorReason = {
  TokenExpired: "token-expired",
  TokenInvalid: "token-invalid",
  TokenInvalidAlgorithm: "token-invalid-algorithm",
  TokenInvalidAuthorizedParties: "token-invalid-authorized-parties",
  TokenInvalidSignature: "token-invalid-signature",
  TokenNotActiveYet: "token-not-active-yet",
  TokenIatInTheFuture: "token-iat-in-the-future",
  TokenVerificationFailed: "token-verification-failed",
  InvalidSecretKey: "secret-key-invalid",
  LocalJWKMissing: "jwk-local-missing",
  RemoteJWKFailedToLoad: "jwk-remote-failed-to-load",
  RemoteJWKInvalid: "jwk-remote-invalid",
  RemoteJWKMissing: "jwk-remote-missing",
  JWKFailedToResolve: "jwk-failed-to-resolve",
  JWKKidMismatch: "jwk-kid-mismatch"
};
var TokenVerificationErrorAction = {
  ContactSupport: "Contact support@clerk.com",
  EnsureClerkJWT: "Make sure that this is a valid Clerk generate JWT.",
  SetClerkJWTKey: "Set the CLERK_JWT_KEY environment variable.",
  SetClerkSecretKey: "Set the CLERK_SECRET_KEY environment variable.",
  EnsureClockSync: "Make sure your system clock is in sync (e.g. turn off and on automatic time synchronization)."
};
var TokenVerificationError = class _TokenVerificationError extends Error {
  constructor({
    action,
    message,
    reason
  }) {
    super(message);
    Object.setPrototypeOf(this, _TokenVerificationError.prototype);
    this.reason = reason;
    this.message = message;
    this.action = action;
  }
  getFullMessage() {
    return `${[this.message, this.action].filter((m) => m).join(" ")} (reason=${this.reason}, token-carrier=${this.tokenCarrier})`;
  }
};

// src/util/rfc4648.ts
var base64url = {
  parse(string, opts) {
    return parse(string, base64UrlEncoding, opts);
  },
  stringify(data, opts) {
    return stringify(data, base64UrlEncoding, opts);
  }
};
var base64UrlEncoding = {
  chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
  bits: 6
};
function parse(string, encoding, opts = {}) {
  if (!encoding.codes) {
    encoding.codes = {};
    for (let i = 0; i < encoding.chars.length; ++i) {
      encoding.codes[encoding.chars[i]] = i;
    }
  }
  if (!opts.loose && string.length * encoding.bits & 7) {
    throw new SyntaxError("Invalid padding");
  }
  let end = string.length;
  while (string[end - 1] === "=") {
    --end;
    if (!opts.loose && !((string.length - end) * encoding.bits & 7)) {
      throw new SyntaxError("Invalid padding");
    }
  }
  const out = new (opts.out ?? Uint8Array)(end * encoding.bits / 8 | 0);
  let bits = 0;
  let buffer = 0;
  let written = 0;
  for (let i = 0; i < end; ++i) {
    const value = encoding.codes[string[i]];
    if (value === void 0) {
      throw new SyntaxError("Invalid character " + string[i]);
    }
    buffer = buffer << encoding.bits | value;
    bits += encoding.bits;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = 255 & buffer >> bits;
    }
  }
  if (bits >= encoding.bits || 255 & buffer << 8 - bits) {
    throw new SyntaxError("Unexpected end of data");
  }
  return out;
}
function stringify(data, encoding, opts = {}) {
  const { pad = true } = opts;
  const mask = (1 << encoding.bits) - 1;
  let out = "";
  let bits = 0;
  let buffer = 0;
  for (let i = 0; i < data.length; ++i) {
    buffer = buffer << 8 | 255 & data[i];
    bits += 8;
    while (bits > encoding.bits) {
      bits -= encoding.bits;
      out += encoding.chars[mask & buffer >> bits];
    }
  }
  if (bits) {
    out += encoding.chars[mask & buffer << encoding.bits - bits];
  }
  if (pad) {
    while (out.length * encoding.bits & 7) {
      out += "=";
    }
  }
  return out;
}

// src/jwt/algorithms.ts
var algToHash = {
  RS256: "SHA-256",
  RS384: "SHA-384",
  RS512: "SHA-512"
};
var RSA_ALGORITHM_NAME = "RSASSA-PKCS1-v1_5";
var jwksAlgToCryptoAlg = {
  RS256: RSA_ALGORITHM_NAME,
  RS384: RSA_ALGORITHM_NAME,
  RS512: RSA_ALGORITHM_NAME
};
var algs = Object.keys(algToHash);
function getCryptoAlgorithm(algorithmName) {
  const hash = algToHash[algorithmName];
  const name = jwksAlgToCryptoAlg[algorithmName];
  if (!hash || !name) {
    throw new Error(`Unsupported algorithm ${algorithmName}, expected one of ${algs.join(",")}.`);
  }
  return {
    hash: { name: algToHash[algorithmName] },
    name: jwksAlgToCryptoAlg[algorithmName]
  };
}

// src/jwt/assertions.ts
var isArrayString = (s) => {
  return Array.isArray(s) && s.length > 0 && s.every((a) => typeof a === "string");
};
var assertAudienceClaim = (aud, audience) => {
  const audienceList = [audience].flat().filter((a) => !!a);
  const audList = [aud].flat().filter((a) => !!a);
  const shouldVerifyAudience = audienceList.length > 0 && audList.length > 0;
  if (!shouldVerifyAudience) {
    return;
  }
  if (typeof aud === "string") {
    if (!audienceList.includes(aud)) {
      throw new TokenVerificationError({
        action: TokenVerificationErrorAction.EnsureClerkJWT,
        reason: TokenVerificationErrorReason.TokenVerificationFailed,
        message: `Invalid JWT audience claim (aud) ${JSON.stringify(aud)}. Is not included in "${JSON.stringify(
          audienceList
        )}".`
      });
    }
  } else if (isArrayString(aud)) {
    if (!aud.some((a) => audienceList.includes(a))) {
      throw new TokenVerificationError({
        action: TokenVerificationErrorAction.EnsureClerkJWT,
        reason: TokenVerificationErrorReason.TokenVerificationFailed,
        message: `Invalid JWT audience claim array (aud) ${JSON.stringify(aud)}. Is not included in "${JSON.stringify(
          audienceList
        )}".`
      });
    }
  }
};
var assertHeaderType = (typ) => {
  if (typeof typ === "undefined") {
    return;
  }
  if (typ !== "JWT") {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.EnsureClerkJWT,
      reason: TokenVerificationErrorReason.TokenInvalid,
      message: `Invalid JWT type ${JSON.stringify(typ)}. Expected "JWT".`
    });
  }
};
var assertHeaderAlgorithm = (alg) => {
  if (!algs.includes(alg)) {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.EnsureClerkJWT,
      reason: TokenVerificationErrorReason.TokenInvalidAlgorithm,
      message: `Invalid JWT algorithm ${JSON.stringify(alg)}. Supported: ${algs}.`
    });
  }
};
var assertSubClaim = (sub) => {
  if (typeof sub !== "string") {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.EnsureClerkJWT,
      reason: TokenVerificationErrorReason.TokenVerificationFailed,
      message: `Subject claim (sub) is required and must be a string. Received ${JSON.stringify(sub)}.`
    });
  }
};
var assertAuthorizedPartiesClaim = (azp, authorizedParties) => {
  if (!azp || !authorizedParties || authorizedParties.length === 0) {
    return;
  }
  if (!authorizedParties.includes(azp)) {
    throw new TokenVerificationError({
      reason: TokenVerificationErrorReason.TokenInvalidAuthorizedParties,
      message: `Invalid JWT Authorized party claim (azp) ${JSON.stringify(azp)}. Expected "${authorizedParties}".`
    });
  }
};
var assertExpirationClaim = (exp, clockSkewInMs) => {
  if (typeof exp !== "number") {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.EnsureClerkJWT,
      reason: TokenVerificationErrorReason.TokenVerificationFailed,
      message: `Invalid JWT expiry date claim (exp) ${JSON.stringify(exp)}. Expected number.`
    });
  }
  const currentDate = new Date(Date.now());
  const expiryDate = /* @__PURE__ */ new Date(0);
  expiryDate.setUTCSeconds(exp);
  const expired = expiryDate.getTime() <= currentDate.getTime() - clockSkewInMs;
  if (expired) {
    throw new TokenVerificationError({
      reason: TokenVerificationErrorReason.TokenExpired,
      message: `JWT is expired. Expiry date: ${expiryDate.toUTCString()}, Current date: ${currentDate.toUTCString()}.`
    });
  }
};
var assertActivationClaim = (nbf, clockSkewInMs) => {
  if (typeof nbf === "undefined") {
    return;
  }
  if (typeof nbf !== "number") {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.EnsureClerkJWT,
      reason: TokenVerificationErrorReason.TokenVerificationFailed,
      message: `Invalid JWT not before date claim (nbf) ${JSON.stringify(nbf)}. Expected number.`
    });
  }
  const currentDate = new Date(Date.now());
  const notBeforeDate = /* @__PURE__ */ new Date(0);
  notBeforeDate.setUTCSeconds(nbf);
  const early = notBeforeDate.getTime() > currentDate.getTime() + clockSkewInMs;
  if (early) {
    throw new TokenVerificationError({
      reason: TokenVerificationErrorReason.TokenNotActiveYet,
      message: `JWT cannot be used prior to not before date claim (nbf). Not before date: ${notBeforeDate.toUTCString()}; Current date: ${currentDate.toUTCString()};`
    });
  }
};
var assertIssuedAtClaim = (iat, clockSkewInMs) => {
  if (typeof iat === "undefined") {
    return;
  }
  if (typeof iat !== "number") {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.EnsureClerkJWT,
      reason: TokenVerificationErrorReason.TokenVerificationFailed,
      message: `Invalid JWT issued at date claim (iat) ${JSON.stringify(iat)}. Expected number.`
    });
  }
  const currentDate = new Date(Date.now());
  const issuedAtDate = /* @__PURE__ */ new Date(0);
  issuedAtDate.setUTCSeconds(iat);
  const postIssued = issuedAtDate.getTime() > currentDate.getTime() + clockSkewInMs;
  if (postIssued) {
    throw new TokenVerificationError({
      reason: TokenVerificationErrorReason.TokenIatInTheFuture,
      message: `JWT issued at date claim (iat) is in the future. Issued at date: ${issuedAtDate.toUTCString()}; Current date: ${currentDate.toUTCString()};`
    });
  }
};

// src/jwt/cryptoKeys.ts
var import_isomorphicAtob = require("@clerk/shared/isomorphicAtob");
function pemToBuffer(secret) {
  const trimmed = secret.replace(/-----BEGIN.*?-----/g, "").replace(/-----END.*?-----/g, "").replace(/\s/g, "");
  const decoded = (0, import_isomorphicAtob.isomorphicAtob)(trimmed);
  const buffer = new ArrayBuffer(decoded.length);
  const bufView = new Uint8Array(buffer);
  for (let i = 0, strLen = decoded.length; i < strLen; i++) {
    bufView[i] = decoded.charCodeAt(i);
  }
  return bufView;
}
function importKey(key, algorithm, keyUsage) {
  if (typeof key === "object") {
    return runtime.crypto.subtle.importKey("jwk", key, algorithm, false, [keyUsage]);
  }
  const keyData = pemToBuffer(key);
  const format = keyUsage === "sign" ? "pkcs8" : "spki";
  return runtime.crypto.subtle.importKey(format, keyData, algorithm, false, [keyUsage]);
}

// src/jwt/verifyJwt.ts
var DEFAULT_CLOCK_SKEW_IN_MS = 5 * 1e3;
async function hasValidSignature(jwt, key) {
  const { header, signature, raw } = jwt;
  const encoder = new TextEncoder();
  const data = encoder.encode([raw.header, raw.payload].join("."));
  const algorithm = getCryptoAlgorithm(header.alg);
  try {
    const cryptoKey = await importKey(key, algorithm, "verify");
    const verified = await runtime.crypto.subtle.verify(algorithm.name, cryptoKey, signature, data);
    return { data: verified };
  } catch (error) {
    return {
      errors: [
        new TokenVerificationError({
          reason: TokenVerificationErrorReason.TokenInvalidSignature,
          message: error?.message
        })
      ]
    };
  }
}
function decodeJwt(token) {
  const tokenParts = (token || "").toString().split(".");
  if (tokenParts.length !== 3) {
    return {
      errors: [
        new TokenVerificationError({
          reason: TokenVerificationErrorReason.TokenInvalid,
          message: `Invalid JWT form. A JWT consists of three parts separated by dots.`
        })
      ]
    };
  }
  const [rawHeader, rawPayload, rawSignature] = tokenParts;
  const decoder = new TextDecoder();
  const header = JSON.parse(decoder.decode(base64url.parse(rawHeader, { loose: true })));
  const payload = JSON.parse(decoder.decode(base64url.parse(rawPayload, { loose: true })));
  const signature = base64url.parse(rawSignature, { loose: true });
  const data = {
    header,
    payload,
    signature,
    raw: {
      header: rawHeader,
      payload: rawPayload,
      signature: rawSignature,
      text: token
    }
  };
  return { data };
}
async function verifyJwt(token, options) {
  const { audience, authorizedParties, clockSkewInMs, key } = options;
  const clockSkew = clockSkewInMs || DEFAULT_CLOCK_SKEW_IN_MS;
  const { data: decoded, errors } = decodeJwt(token);
  if (errors) {
    return { errors };
  }
  const { header, payload } = decoded;
  try {
    const { typ, alg } = header;
    assertHeaderType(typ);
    assertHeaderAlgorithm(alg);
    const { azp, sub, aud, iat, exp, nbf } = payload;
    assertSubClaim(sub);
    assertAudienceClaim([aud], [audience]);
    assertAuthorizedPartiesClaim(azp, authorizedParties);
    assertExpirationClaim(exp, clockSkew);
    assertActivationClaim(nbf, clockSkew);
    assertIssuedAtClaim(iat, clockSkew);
  } catch (err) {
    return { errors: [err] };
  }
  const { data: signatureValid, errors: signatureErrors } = await hasValidSignature(decoded, key);
  if (signatureErrors) {
    return {
      errors: [
        new TokenVerificationError({
          action: TokenVerificationErrorAction.EnsureClerkJWT,
          reason: TokenVerificationErrorReason.TokenVerificationFailed,
          message: `Error verifying JWT signature. ${signatureErrors[0]}`
        })
      ]
    };
  }
  if (!signatureValid) {
    return {
      errors: [
        new TokenVerificationError({
          reason: TokenVerificationErrorReason.TokenInvalidSignature,
          message: "JWT signature is invalid."
        })
      ]
    };
  }
  return { data: payload };
}

// src/tokens/authenticateContext.ts
var AuthenticateContext = class {
  constructor(cookieSuffix, clerkRequest, options) {
    this.cookieSuffix = cookieSuffix;
    this.clerkRequest = clerkRequest;
    this.initPublishableKeyValues(options);
    this.initHeaderValues();
    this.initCookieValues();
    this.initHandshakeValues();
    Object.assign(this, options);
    this.clerkUrl = this.clerkRequest.clerkUrl;
  }
  /**
   * Retrieves the session token from either the cookie or the header.
   *
   * @returns {string | undefined} The session token if available, otherwise undefined.
   */
  get sessionToken() {
    return this.sessionTokenInCookie || this.sessionTokenInHeader;
  }
  usesSuffixedCookies() {
    const suffixedClientUat = this.getSuffixedCookie(constants.Cookies.ClientUat);
    const clientUat = this.getCookie(constants.Cookies.ClientUat);
    const suffixedSession = this.getSuffixedCookie(constants.Cookies.Session) || "";
    const session = this.getCookie(constants.Cookies.Session) || "";
    if (session && !this.tokenHasIssuer(session)) {
      return false;
    }
    if (session && !this.tokenBelongsToInstance(session)) {
      return true;
    }
    if (!suffixedClientUat && !suffixedSession) {
      return false;
    }
    const { data: sessionData } = decodeJwt(session);
    const sessionIat = sessionData?.payload.iat || 0;
    const { data: suffixedSessionData } = decodeJwt(suffixedSession);
    const suffixedSessionIat = suffixedSessionData?.payload.iat || 0;
    if (suffixedClientUat !== "0" && clientUat !== "0" && sessionIat > suffixedSessionIat) {
      return false;
    }
    if (suffixedClientUat === "0" && clientUat !== "0") {
      return false;
    }
    if (this.instanceType !== "production") {
      const isSuffixedSessionExpired = this.sessionExpired(suffixedSessionData);
      if (suffixedClientUat !== "0" && clientUat === "0" && isSuffixedSessionExpired) {
        return false;
      }
    }
    if (!suffixedClientUat && suffixedSession) {
      return false;
    }
    return true;
  }
  initPublishableKeyValues(options) {
    assertValidPublishableKey(options.publishableKey);
    this.publishableKey = options.publishableKey;
    const pk = (0, import_keys.parsePublishableKey)(this.publishableKey, {
      fatal: true,
      proxyUrl: options.proxyUrl,
      domain: options.domain,
      isSatellite: options.isSatellite
    });
    this.instanceType = pk.instanceType;
    this.frontendApi = pk.frontendApi;
  }
  initHeaderValues() {
    this.sessionTokenInHeader = this.parseAuthorizationHeader(this.getHeader(constants.Headers.Authorization));
    this.origin = this.getHeader(constants.Headers.Origin);
    this.host = this.getHeader(constants.Headers.Host);
    this.forwardedHost = this.getHeader(constants.Headers.ForwardedHost);
    this.forwardedProto = this.getHeader(constants.Headers.CloudFrontForwardedProto) || this.getHeader(constants.Headers.ForwardedProto);
    this.referrer = this.getHeader(constants.Headers.Referrer);
    this.userAgent = this.getHeader(constants.Headers.UserAgent);
    this.secFetchDest = this.getHeader(constants.Headers.SecFetchDest);
    this.accept = this.getHeader(constants.Headers.Accept);
  }
  initCookieValues() {
    this.sessionTokenInCookie = this.getSuffixedOrUnSuffixedCookie(constants.Cookies.Session);
    this.refreshTokenInCookie = this.getSuffixedCookie(constants.Cookies.Refresh);
    this.clientUat = Number.parseInt(this.getSuffixedOrUnSuffixedCookie(constants.Cookies.ClientUat) || "") || 0;
  }
  initHandshakeValues() {
    this.devBrowserToken = this.getQueryParam(constants.QueryParameters.DevBrowser) || this.getSuffixedOrUnSuffixedCookie(constants.Cookies.DevBrowser);
    this.handshakeToken = this.getQueryParam(constants.QueryParameters.Handshake) || this.getCookie(constants.Cookies.Handshake);
    this.handshakeRedirectLoopCounter = Number(this.getCookie(constants.Cookies.RedirectCount)) || 0;
    this.handshakeNonce = this.getQueryParam(constants.QueryParameters.HandshakeNonce) || this.getCookie(constants.Cookies.HandshakeNonce);
  }
  getQueryParam(name) {
    return this.clerkRequest.clerkUrl.searchParams.get(name);
  }
  getHeader(name) {
    return this.clerkRequest.headers.get(name) || void 0;
  }
  getCookie(name) {
    return this.clerkRequest.cookies.get(name) || void 0;
  }
  getSuffixedCookie(name) {
    return this.getCookie((0, import_keys.getSuffixedCookieName)(name, this.cookieSuffix)) || void 0;
  }
  getSuffixedOrUnSuffixedCookie(cookieName) {
    if (this.usesSuffixedCookies()) {
      return this.getSuffixedCookie(cookieName);
    }
    return this.getCookie(cookieName);
  }
  parseAuthorizationHeader(authorizationHeader) {
    if (!authorizationHeader) {
      return void 0;
    }
    const [scheme, token] = authorizationHeader.split(" ", 2);
    if (!token) {
      return scheme;
    }
    if (scheme === "Bearer") {
      return token;
    }
    return void 0;
  }
  tokenHasIssuer(token) {
    const { data, errors } = decodeJwt(token);
    if (errors) {
      return false;
    }
    return !!data.payload.iss;
  }
  tokenBelongsToInstance(token) {
    if (!token) {
      return false;
    }
    const { data, errors } = decodeJwt(token);
    if (errors) {
      return false;
    }
    const tokenIssuer = data.payload.iss.replace(/https?:\/\//gi, "");
    return this.frontendApi === tokenIssuer;
  }
  sessionExpired(jwt) {
    return !!jwt && jwt?.payload.exp <= Date.now() / 1e3 >> 0;
  }
};
var createAuthenticateContext = async (clerkRequest, options) => {
  const cookieSuffix = options.publishableKey ? await (0, import_keys.getCookieSuffix)(options.publishableKey, runtime.crypto.subtle) : "";
  return new AuthenticateContext(cookieSuffix, clerkRequest, options);
};

// src/tokens/authObjects.ts
var import_authorization = require("@clerk/shared/authorization");
var import_jwtPayloadParser = require("@clerk/shared/jwtPayloadParser");
var createDebug = (data) => {
  return () => {
    const res = { ...data };
    res.secretKey = (res.secretKey || "").substring(0, 7);
    res.jwtKey = (res.jwtKey || "").substring(0, 7);
    return { ...res };
  };
};
function signedInAuthObject(authenticateContext, sessionToken, sessionClaims) {
  const { actor, sessionId, sessionStatus, userId, orgId, orgRole, orgSlug, orgPermissions, factorVerificationAge } = (0, import_jwtPayloadParser.__experimental_JWTPayloadToAuthObjectProperties)(sessionClaims);
  const apiClient = createBackendApiClient(authenticateContext);
  const getToken = createGetToken({
    sessionId,
    sessionToken,
    fetcher: async (...args) => (await apiClient.sessions.getToken(...args)).jwt
  });
  return {
    actor,
    sessionClaims,
    sessionId,
    sessionStatus,
    userId,
    orgId,
    orgRole,
    orgSlug,
    orgPermissions,
    factorVerificationAge,
    getToken,
    has: (0, import_authorization.createCheckAuthorization)({
      orgId,
      orgRole,
      orgPermissions,
      userId,
      factorVerificationAge,
      features: sessionClaims.fea || "",
      plans: sessionClaims.pla || ""
    }),
    debug: createDebug({ ...authenticateContext, sessionToken })
  };
}
function signedOutAuthObject(debugData, initialSessionStatus) {
  return {
    sessionClaims: null,
    sessionId: null,
    sessionStatus: initialSessionStatus ?? null,
    userId: null,
    actor: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    orgPermissions: null,
    factorVerificationAge: null,
    getToken: () => Promise.resolve(null),
    has: () => false,
    debug: createDebug(debugData)
  };
}
var createGetToken = (params) => {
  const { fetcher, sessionToken, sessionId } = params || {};
  return async (options = {}) => {
    if (!sessionId) {
      return null;
    }
    if (options.template) {
      return fetcher(sessionId, options.template);
    }
    return sessionToken;
  };
};

// src/tokens/authStatus.ts
var AuthStatus = {
  SignedIn: "signed-in",
  SignedOut: "signed-out",
  Handshake: "handshake"
};
var AuthErrorReason = {
  ClientUATWithoutSessionToken: "client-uat-but-no-session-token",
  DevBrowserMissing: "dev-browser-missing",
  DevBrowserSync: "dev-browser-sync",
  PrimaryRespondsToSyncing: "primary-responds-to-syncing",
  SatelliteCookieNeedsSyncing: "satellite-needs-syncing",
  SessionTokenAndUATMissing: "session-token-and-uat-missing",
  SessionTokenMissing: "session-token-missing",
  SessionTokenExpired: "session-token-expired",
  SessionTokenIATBeforeClientUAT: "session-token-iat-before-client-uat",
  SessionTokenNBF: "session-token-nbf",
  SessionTokenIatInTheFuture: "session-token-iat-in-the-future",
  SessionTokenWithoutClientUAT: "session-token-but-no-client-uat",
  ActiveOrganizationMismatch: "active-organization-mismatch",
  UnexpectedError: "unexpected-error"
};
function signedIn(authenticateContext, sessionClaims, headers = new Headers(), token) {
  const authObject = signedInAuthObject(authenticateContext, token, sessionClaims);
  return {
    status: AuthStatus.SignedIn,
    reason: null,
    message: null,
    proxyUrl: authenticateContext.proxyUrl || "",
    publishableKey: authenticateContext.publishableKey || "",
    isSatellite: authenticateContext.isSatellite || false,
    domain: authenticateContext.domain || "",
    signInUrl: authenticateContext.signInUrl || "",
    signUpUrl: authenticateContext.signUpUrl || "",
    afterSignInUrl: authenticateContext.afterSignInUrl || "",
    afterSignUpUrl: authenticateContext.afterSignUpUrl || "",
    isSignedIn: true,
    toAuth: ({ treatPendingAsSignedOut = true } = {}) => {
      if (treatPendingAsSignedOut && authObject.sessionStatus === "pending") {
        return signedOutAuthObject(void 0, authObject.sessionStatus);
      }
      return authObject;
    },
    headers,
    token
  };
}
function signedOut(authenticateContext, reason, message = "", headers = new Headers()) {
  return withDebugHeaders({
    status: AuthStatus.SignedOut,
    reason,
    message,
    proxyUrl: authenticateContext.proxyUrl || "",
    publishableKey: authenticateContext.publishableKey || "",
    isSatellite: authenticateContext.isSatellite || false,
    domain: authenticateContext.domain || "",
    signInUrl: authenticateContext.signInUrl || "",
    signUpUrl: authenticateContext.signUpUrl || "",
    afterSignInUrl: authenticateContext.afterSignInUrl || "",
    afterSignUpUrl: authenticateContext.afterSignUpUrl || "",
    isSignedIn: false,
    headers,
    toAuth: () => signedOutAuthObject({ ...authenticateContext, status: AuthStatus.SignedOut, reason, message }),
    token: null
  });
}
function handshake(authenticateContext, reason, message = "", headers) {
  return withDebugHeaders({
    status: AuthStatus.Handshake,
    reason,
    message,
    publishableKey: authenticateContext.publishableKey || "",
    isSatellite: authenticateContext.isSatellite || false,
    domain: authenticateContext.domain || "",
    proxyUrl: authenticateContext.proxyUrl || "",
    signInUrl: authenticateContext.signInUrl || "",
    signUpUrl: authenticateContext.signUpUrl || "",
    afterSignInUrl: authenticateContext.afterSignInUrl || "",
    afterSignUpUrl: authenticateContext.afterSignUpUrl || "",
    isSignedIn: false,
    headers,
    toAuth: () => null,
    token: null
  });
}
var withDebugHeaders = (requestState) => {
  const headers = new Headers(requestState.headers || {});
  if (requestState.message) {
    try {
      headers.set(constants.Headers.AuthMessage, requestState.message);
    } catch {
    }
  }
  if (requestState.reason) {
    try {
      headers.set(constants.Headers.AuthReason, requestState.reason);
    } catch {
    }
  }
  if (requestState.status) {
    try {
      headers.set(constants.Headers.AuthStatus, requestState.status);
    } catch {
    }
  }
  requestState.headers = headers;
  return requestState;
};

// src/tokens/clerkRequest.ts
var import_cookie = require("cookie");

// src/tokens/clerkUrl.ts
var ClerkUrl = class extends URL {
  isCrossOrigin(other) {
    return this.origin !== new URL(other.toString()).origin;
  }
};
var createClerkUrl = (...args) => {
  return new ClerkUrl(...args);
};

// src/tokens/clerkRequest.ts
var ClerkRequest = class extends Request {
  constructor(input, init) {
    const url = typeof input !== "string" && "url" in input ? input.url : String(input);
    super(url, init || typeof input === "string" ? void 0 : input);
    this.clerkUrl = this.deriveUrlFromHeaders(this);
    this.cookies = this.parseCookies(this);
  }
  toJSON() {
    return {
      url: this.clerkUrl.href,
      method: this.method,
      headers: JSON.stringify(Object.fromEntries(this.headers)),
      clerkUrl: this.clerkUrl.toString(),
      cookies: JSON.stringify(Object.fromEntries(this.cookies))
    };
  }
  /**
   * Used to fix request.url using the x-forwarded-* headers
   * TODO add detailed description of the issues this solves
   */
  deriveUrlFromHeaders(req) {
    const initialUrl = new URL(req.url);
    const forwardedProto = req.headers.get(constants.Headers.ForwardedProto);
    const forwardedHost = req.headers.get(constants.Headers.ForwardedHost);
    const host = req.headers.get(constants.Headers.Host);
    const protocol = initialUrl.protocol;
    const resolvedHost = this.getFirstValueFromHeader(forwardedHost) ?? host;
    const resolvedProtocol = this.getFirstValueFromHeader(forwardedProto) ?? protocol?.replace(/[:/]/, "");
    const origin = resolvedHost && resolvedProtocol ? `${resolvedProtocol}://${resolvedHost}` : initialUrl.origin;
    if (origin === initialUrl.origin) {
      return createClerkUrl(initialUrl);
    }
    return createClerkUrl(initialUrl.pathname + initialUrl.search, origin);
  }
  getFirstValueFromHeader(value) {
    return value?.split(",")[0];
  }
  parseCookies(req) {
    const cookiesRecord = (0, import_cookie.parse)(this.decodeCookieValue(req.headers.get("cookie") || ""));
    return new Map(Object.entries(cookiesRecord));
  }
  decodeCookieValue(str) {
    return str ? str.replace(/(%[0-9A-Z]{2})+/g, decodeURIComponent) : str;
  }
};
var createClerkRequest = (...args) => {
  return args[0] instanceof ClerkRequest ? args[0] : new ClerkRequest(...args);
};

// src/tokens/cookie.ts
var getCookieName = (cookieDirective) => {
  return cookieDirective.split(";")[0]?.split("=")[0];
};
var getCookieValue = (cookieDirective) => {
  return cookieDirective.split(";")[0]?.split("=")[1];
};

// src/tokens/keys.ts
var cache = {};
var lastUpdatedAt = 0;
function getFromCache(kid) {
  return cache[kid];
}
function getCacheValues() {
  return Object.values(cache);
}
function setInCache(jwk, shouldExpire = true) {
  cache[jwk.kid] = jwk;
  lastUpdatedAt = shouldExpire ? Date.now() : -1;
}
var LocalJwkKid = "local";
var PEM_HEADER = "-----BEGIN PUBLIC KEY-----";
var PEM_TRAILER = "-----END PUBLIC KEY-----";
var RSA_PREFIX = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA";
var RSA_SUFFIX = "IDAQAB";
function loadClerkJWKFromLocal(localKey) {
  if (!getFromCache(LocalJwkKid)) {
    if (!localKey) {
      throw new TokenVerificationError({
        action: TokenVerificationErrorAction.SetClerkJWTKey,
        message: "Missing local JWK.",
        reason: TokenVerificationErrorReason.LocalJWKMissing
      });
    }
    const modulus = localKey.replace(/\r\n|\n|\r/g, "").replace(PEM_HEADER, "").replace(PEM_TRAILER, "").replace(RSA_PREFIX, "").replace(RSA_SUFFIX, "").replace(/\+/g, "-").replace(/\//g, "_");
    setInCache(
      {
        kid: "local",
        kty: "RSA",
        alg: "RS256",
        n: modulus,
        e: "AQAB"
      },
      false
      // local key never expires in cache
    );
  }
  return getFromCache(LocalJwkKid);
}
async function loadClerkJWKFromRemote({
  secretKey,
  apiUrl = API_URL,
  apiVersion = API_VERSION,
  kid,
  skipJwksCache
}) {
  if (skipJwksCache || cacheHasExpired() || !getFromCache(kid)) {
    if (!secretKey) {
      throw new TokenVerificationError({
        action: TokenVerificationErrorAction.ContactSupport,
        message: "Failed to load JWKS from Clerk Backend or Frontend API.",
        reason: TokenVerificationErrorReason.RemoteJWKFailedToLoad
      });
    }
    const fetcher = () => fetchJWKSFromBAPI(apiUrl, secretKey, apiVersion);
    const { keys } = await (0, import_retry.retry)(fetcher);
    if (!keys || !keys.length) {
      throw new TokenVerificationError({
        action: TokenVerificationErrorAction.ContactSupport,
        message: "The JWKS endpoint did not contain any signing keys. Contact support@clerk.com.",
        reason: TokenVerificationErrorReason.RemoteJWKFailedToLoad
      });
    }
    keys.forEach((key) => setInCache(key));
  }
  const jwk = getFromCache(kid);
  if (!jwk) {
    const cacheValues = getCacheValues();
    const jwkKeys = cacheValues.map((jwk2) => jwk2.kid).sort().join(", ");
    throw new TokenVerificationError({
      action: `Go to your Dashboard and validate your secret and public keys are correct. ${TokenVerificationErrorAction.ContactSupport} if the issue persists.`,
      message: `Unable to find a signing key in JWKS that matches the kid='${kid}' of the provided session token. Please make sure that the __session cookie or the HTTP authorization header contain a Clerk-generated session JWT. The following kid is available: ${jwkKeys}`,
      reason: TokenVerificationErrorReason.JWKKidMismatch
    });
  }
  return jwk;
}
async function fetchJWKSFromBAPI(apiUrl, key, apiVersion) {
  if (!key) {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.SetClerkSecretKey,
      message: "Missing Clerk Secret Key or API Key. Go to https://dashboard.clerk.com and get your key for your instance.",
      reason: TokenVerificationErrorReason.RemoteJWKFailedToLoad
    });
  }
  const url = new URL(apiUrl);
  url.pathname = joinPaths(url.pathname, apiVersion, "/jwks");
  const response = await runtime.fetch(url.href, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Clerk-API-Version": SUPPORTED_BAPI_VERSION,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    }
  });
  if (!response.ok) {
    const json = await response.json();
    const invalidSecretKeyError = getErrorObjectByCode(json?.errors, TokenVerificationErrorCode.InvalidSecretKey);
    if (invalidSecretKeyError) {
      const reason = TokenVerificationErrorReason.InvalidSecretKey;
      throw new TokenVerificationError({
        action: TokenVerificationErrorAction.ContactSupport,
        message: invalidSecretKeyError.message,
        reason
      });
    }
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.ContactSupport,
      message: `Error loading Clerk JWKS from ${url.href} with code=${response.status}`,
      reason: TokenVerificationErrorReason.RemoteJWKFailedToLoad
    });
  }
  return response.json();
}
function cacheHasExpired() {
  if (lastUpdatedAt === -1) {
    return false;
  }
  const isExpired = Date.now() - lastUpdatedAt >= MAX_CACHE_LAST_UPDATED_AT_SECONDS * 1e3;
  if (isExpired) {
    cache = {};
  }
  return isExpired;
}
var getErrorObjectByCode = (errors, code) => {
  if (!errors) {
    return null;
  }
  return errors.find((err) => err.code === code);
};

// src/tokens/verify.ts
async function verifyToken(token, options) {
  const { data: decodedResult, errors } = decodeJwt(token);
  if (errors) {
    return { errors };
  }
  const { header } = decodedResult;
  const { kid } = header;
  try {
    let key;
    if (options.jwtKey) {
      key = loadClerkJWKFromLocal(options.jwtKey);
    } else if (options.secretKey) {
      key = await loadClerkJWKFromRemote({ ...options, kid });
    } else {
      return {
        errors: [
          new TokenVerificationError({
            action: TokenVerificationErrorAction.SetClerkJWTKey,
            message: "Failed to resolve JWK during verification.",
            reason: TokenVerificationErrorReason.JWKFailedToResolve
          })
        ]
      };
    }
    return await verifyJwt(token, { ...options, key });
  } catch (error) {
    return { errors: [error] };
  }
}

// src/tokens/handshake.ts
async function verifyHandshakeJwt(token, { key }) {
  const { data: decoded, errors } = decodeJwt(token);
  if (errors) {
    throw errors[0];
  }
  const { header, payload } = decoded;
  const { typ, alg } = header;
  assertHeaderType(typ);
  assertHeaderAlgorithm(alg);
  const { data: signatureValid, errors: signatureErrors } = await hasValidSignature(decoded, key);
  if (signatureErrors) {
    throw new TokenVerificationError({
      reason: TokenVerificationErrorReason.TokenVerificationFailed,
      message: `Error verifying handshake token. ${signatureErrors[0]}`
    });
  }
  if (!signatureValid) {
    throw new TokenVerificationError({
      reason: TokenVerificationErrorReason.TokenInvalidSignature,
      message: "Handshake signature is invalid."
    });
  }
  return payload;
}
async function verifyHandshakeToken(token, options) {
  const { secretKey, apiUrl, apiVersion, jwksCacheTtlInMs, jwtKey, skipJwksCache } = options;
  const { data, errors } = decodeJwt(token);
  if (errors) {
    throw errors[0];
  }
  const { kid } = data.header;
  let key;
  if (jwtKey) {
    key = loadClerkJWKFromLocal(jwtKey);
  } else if (secretKey) {
    key = await loadClerkJWKFromRemote({ secretKey, apiUrl, apiVersion, kid, jwksCacheTtlInMs, skipJwksCache });
  } else {
    throw new TokenVerificationError({
      action: TokenVerificationErrorAction.SetClerkJWTKey,
      message: "Failed to resolve JWK during handshake verification.",
      reason: TokenVerificationErrorReason.JWKFailedToResolve
    });
  }
  return await verifyHandshakeJwt(token, {
    key
  });
}
var HandshakeService = class {
  constructor(authenticateContext, options, organizationMatcher) {
    this.authenticateContext = authenticateContext;
    this.options = options;
    this.organizationMatcher = organizationMatcher;
  }
  /**
   * Determines if a request is eligible for handshake based on its headers
   *
   * Currently, a request is only eligible for a handshake if we can say it's *probably* a request for a document, not a fetch or some other exotic request.
   * This heuristic should give us a reliable enough signal for browsers that support `Sec-Fetch-Dest` and for those that don't.
   *
   * @returns boolean indicating if the request is eligible for handshake
   */
  isRequestEligibleForHandshake() {
    const { accept, secFetchDest } = this.authenticateContext;
    if (secFetchDest === "document" || secFetchDest === "iframe") {
      return true;
    }
    if (!secFetchDest && accept?.startsWith("text/html")) {
      return true;
    }
    return false;
  }
  /**
   * Builds the redirect headers for a handshake request
   * @param reason - The reason for the handshake (e.g. 'session-token-expired')
   * @returns Headers object containing the Location header for redirect
   * @throws Error if clerkUrl is missing in authenticateContext
   */
  buildRedirectToHandshake(reason) {
    if (!this.authenticateContext?.clerkUrl) {
      throw new Error("Missing clerkUrl in authenticateContext");
    }
    const redirectUrl = this.removeDevBrowserFromURL(this.authenticateContext.clerkUrl);
    const frontendApiNoProtocol = this.authenticateContext.frontendApi.replace(/http(s)?:\/\//, "");
    const url = new URL(`https://${frontendApiNoProtocol}/v1/client/handshake`);
    url.searchParams.append("redirect_url", redirectUrl?.href || "");
    url.searchParams.append("__clerk_api_version", SUPPORTED_BAPI_VERSION);
    url.searchParams.append(
      constants.QueryParameters.SuffixedCookies,
      this.authenticateContext.usesSuffixedCookies().toString()
    );
    url.searchParams.append(constants.QueryParameters.HandshakeReason, reason);
    if (this.authenticateContext.instanceType === "development" && this.authenticateContext.devBrowserToken) {
      url.searchParams.append(constants.QueryParameters.DevBrowser, this.authenticateContext.devBrowserToken);
    }
    const toActivate = this.getOrganizationSyncTarget(this.authenticateContext.clerkUrl, this.organizationMatcher);
    if (toActivate) {
      const params = this.getOrganizationSyncQueryParams(toActivate);
      params.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }
    return new Headers({ [constants.Headers.Location]: url.href });
  }
  /**
   * Gets cookies from either a handshake nonce or a handshake token
   * @returns Promise resolving to string array of cookie directives
   */
  async getCookiesFromHandshake() {
    const cookiesToSet = [];
    if (this.authenticateContext.handshakeNonce) {
      try {
        const handshakePayload = await this.authenticateContext.apiClient?.clients.getHandshakePayload({
          nonce: this.authenticateContext.handshakeNonce
        });
        if (handshakePayload) {
          cookiesToSet.push(...handshakePayload.directives);
        }
      } catch (error) {
        console.error("Clerk: HandshakeService: error getting handshake payload:", error);
      }
    } else if (this.authenticateContext.handshakeToken) {
      const handshakePayload = await verifyHandshakeToken(
        this.authenticateContext.handshakeToken,
        this.authenticateContext
      );
      if (handshakePayload && Array.isArray(handshakePayload.handshake)) {
        cookiesToSet.push(...handshakePayload.handshake);
      }
    }
    return cookiesToSet;
  }
  /**
   * Resolves a handshake request by verifying the handshake token and setting appropriate cookies
   * @returns Promise resolving to either a SignedInState or SignedOutState
   * @throws Error if handshake verification fails or if there are issues with the session token
   */
  async resolveHandshake() {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "null",
      "Access-Control-Allow-Credentials": "true"
    });
    const cookiesToSet = await this.getCookiesFromHandshake();
    let sessionToken = "";
    cookiesToSet.forEach((x) => {
      headers.append("Set-Cookie", x);
      if (getCookieName(x).startsWith(constants.Cookies.Session)) {
        sessionToken = getCookieValue(x);
      }
    });
    if (this.authenticateContext.instanceType === "development") {
      const newUrl = new URL(this.authenticateContext.clerkUrl);
      newUrl.searchParams.delete(constants.QueryParameters.Handshake);
      newUrl.searchParams.delete(constants.QueryParameters.HandshakeHelp);
      headers.append(constants.Headers.Location, newUrl.toString());
      headers.set(constants.Headers.CacheControl, "no-store");
    }
    if (sessionToken === "") {
      return signedOut(this.authenticateContext, AuthErrorReason.SessionTokenMissing, "", headers);
    }
    const { data, errors: [error] = [] } = await verifyToken(sessionToken, this.authenticateContext);
    if (data) {
      return signedIn(this.authenticateContext, data, headers, sessionToken);
    }
    if (this.authenticateContext.instanceType === "development" && (error?.reason === TokenVerificationErrorReason.TokenExpired || error?.reason === TokenVerificationErrorReason.TokenNotActiveYet || error?.reason === TokenVerificationErrorReason.TokenIatInTheFuture)) {
      const developmentError = new TokenVerificationError({
        action: error.action,
        message: error.message,
        reason: error.reason
      });
      developmentError.tokenCarrier = "cookie";
      console.error(
        `Clerk: Clock skew detected. This usually means that your system clock is inaccurate. Clerk will attempt to account for the clock skew in development.

To resolve this issue, make sure your system's clock is set to the correct time (e.g. turn off and on automatic time synchronization).

---

${developmentError.getFullMessage()}`
      );
      const { data: retryResult, errors: [retryError] = [] } = await verifyToken(sessionToken, {
        ...this.authenticateContext,
        clockSkewInMs: 864e5
      });
      if (retryResult) {
        return signedIn(this.authenticateContext, retryResult, headers, sessionToken);
      }
      throw new Error(retryError?.message || "Clerk: Handshake retry failed.");
    }
    throw new Error(error?.message || "Clerk: Handshake failed.");
  }
  /**
   * Handles handshake token verification errors in development mode
   * @param error - The TokenVerificationError that occurred
   * @throws Error with a descriptive message about the verification failure
   */
  handleTokenVerificationErrorInDevelopment(error) {
    if (error.reason === TokenVerificationErrorReason.TokenInvalidSignature) {
      const msg = `Clerk: Handshake token verification failed due to an invalid signature. If you have switched Clerk keys locally, clear your cookies and try again.`;
      throw new Error(msg);
    }
    throw new Error(`Clerk: Handshake token verification failed: ${error.getFullMessage()}.`);
  }
  /**
   * Checks if a redirect loop is detected and sets headers to track redirect count
   * @param headers - The Headers object to modify
   * @returns boolean indicating if a redirect loop was detected (true) or if the request can proceed (false)
   */
  checkAndTrackRedirectLoop(headers) {
    if (this.authenticateContext.handshakeRedirectLoopCounter === 3) {
      return true;
    }
    const newCounterValue = this.authenticateContext.handshakeRedirectLoopCounter + 1;
    const cookieName = constants.Cookies.RedirectCount;
    headers.append("Set-Cookie", `${cookieName}=${newCounterValue}; SameSite=Lax; HttpOnly; Max-Age=3`);
    return false;
  }
  removeDevBrowserFromURL(url) {
    const updatedURL = new URL(url);
    updatedURL.searchParams.delete(constants.QueryParameters.DevBrowser);
    updatedURL.searchParams.delete(constants.QueryParameters.LegacyDevBrowser);
    return updatedURL;
  }
  getOrganizationSyncTarget(url, matchers) {
    return matchers.findTarget(url);
  }
  getOrganizationSyncQueryParams(toActivate) {
    const ret = /* @__PURE__ */ new Map();
    if (toActivate.type === "personalAccount") {
      ret.set("organization_id", "");
    }
    if (toActivate.type === "organization") {
      if (toActivate.organizationId) {
        ret.set("organization_id", toActivate.organizationId);
      }
      if (toActivate.organizationSlug) {
        ret.set("organization_id", toActivate.organizationSlug);
      }
    }
    return ret;
  }
};

// src/tokens/organizationMatcher.ts
var import_pathToRegexp = require("@clerk/shared/pathToRegexp");
var OrganizationMatcher = class {
  constructor(options) {
    this.organizationPattern = this.createMatcher(options?.organizationPatterns);
    this.personalAccountPattern = this.createMatcher(options?.personalAccountPatterns);
  }
  createMatcher(pattern) {
    if (!pattern) return null;
    try {
      return (0, import_pathToRegexp.match)(pattern);
    } catch (e) {
      throw new Error(`Invalid pattern "${pattern}": ${e}`);
    }
  }
  findTarget(url) {
    const orgTarget = this.findOrganizationTarget(url);
    if (orgTarget) return orgTarget;
    return this.findPersonalAccountTarget(url);
  }
  findOrganizationTarget(url) {
    if (!this.organizationPattern) return null;
    try {
      const result = this.organizationPattern(url.pathname);
      if (!result || !("params" in result)) return null;
      const params = result.params;
      if (params.id) return { type: "organization", organizationId: params.id };
      if (params.slug) return { type: "organization", organizationSlug: params.slug };
      return null;
    } catch (e) {
      console.error("Failed to match organization pattern:", e);
      return null;
    }
  }
  findPersonalAccountTarget(url) {
    if (!this.personalAccountPattern) return null;
    try {
      const result = this.personalAccountPattern(url.pathname);
      return result ? { type: "personalAccount" } : null;
    } catch (e) {
      console.error("Failed to match personal account pattern:", e);
      return null;
    }
  }
};

// src/tokens/request.ts
var RefreshTokenErrorReason = {
  NonEligibleNoCookie: "non-eligible-no-refresh-cookie",
  NonEligibleNonGet: "non-eligible-non-get",
  InvalidSessionToken: "invalid-session-token",
  MissingApiClient: "missing-api-client",
  MissingSessionToken: "missing-session-token",
  MissingRefreshToken: "missing-refresh-token",
  ExpiredSessionTokenDecodeFailed: "expired-session-token-decode-failed",
  ExpiredSessionTokenMissingSidClaim: "expired-session-token-missing-sid-claim",
  FetchError: "fetch-error",
  UnexpectedSDKError: "unexpected-sdk-error",
  UnexpectedBAPIError: "unexpected-bapi-error"
};
function assertSignInUrlExists(signInUrl, key) {
  if (!signInUrl && (0, import_keys.isDevelopmentFromSecretKey)(key)) {
    throw new Error(`Missing signInUrl. Pass a signInUrl for dev instances if an app is satellite`);
  }
}
function assertProxyUrlOrDomain(proxyUrlOrDomain) {
  if (!proxyUrlOrDomain) {
    throw new Error(`Missing domain and proxyUrl. A satellite application needs to specify a domain or a proxyUrl`);
  }
}
function assertSignInUrlFormatAndOrigin(_signInUrl, origin) {
  let signInUrl;
  try {
    signInUrl = new URL(_signInUrl);
  } catch {
    throw new Error(`The signInUrl needs to have a absolute url format.`);
  }
  if (signInUrl.origin === origin) {
    throw new Error(`The signInUrl needs to be on a different origin than your satellite application.`);
  }
}
function isRequestEligibleForRefresh(err, authenticateContext, request) {
  return err.reason === TokenVerificationErrorReason.TokenExpired && !!authenticateContext.refreshTokenInCookie && request.method === "GET";
}
async function authenticateRequest(request, options) {
  const authenticateContext = await createAuthenticateContext(createClerkRequest(request), options);
  assertValidSecretKey(authenticateContext.secretKey);
  if (authenticateContext.isSatellite) {
    assertSignInUrlExists(authenticateContext.signInUrl, authenticateContext.secretKey);
    if (authenticateContext.signInUrl && authenticateContext.origin) {
      assertSignInUrlFormatAndOrigin(authenticateContext.signInUrl, authenticateContext.origin);
    }
    assertProxyUrlOrDomain(authenticateContext.proxyUrl || authenticateContext.domain);
  }
  const organizationMatcher = new OrganizationMatcher(options.organizationSyncOptions);
  const handshakeService = new HandshakeService(
    authenticateContext,
    { organizationSyncOptions: options.organizationSyncOptions },
    organizationMatcher
  );
  async function refreshToken(authenticateContext2) {
    if (!options.apiClient) {
      return {
        data: null,
        error: {
          message: "An apiClient is needed to perform token refresh.",
          cause: { reason: RefreshTokenErrorReason.MissingApiClient }
        }
      };
    }
    const { sessionToken: expiredSessionToken, refreshTokenInCookie: refreshToken2 } = authenticateContext2;
    if (!expiredSessionToken) {
      return {
        data: null,
        error: {
          message: "Session token must be provided.",
          cause: { reason: RefreshTokenErrorReason.MissingSessionToken }
        }
      };
    }
    if (!refreshToken2) {
      return {
        data: null,
        error: {
          message: "Refresh token must be provided.",
          cause: { reason: RefreshTokenErrorReason.MissingRefreshToken }
        }
      };
    }
    const { data: decodeResult, errors: decodedErrors } = decodeJwt(expiredSessionToken);
    if (!decodeResult || decodedErrors) {
      return {
        data: null,
        error: {
          message: "Unable to decode the expired session token.",
          cause: { reason: RefreshTokenErrorReason.ExpiredSessionTokenDecodeFailed, errors: decodedErrors }
        }
      };
    }
    if (!decodeResult?.payload?.sid) {
      return {
        data: null,
        error: {
          message: "Expired session token is missing the `sid` claim.",
          cause: { reason: RefreshTokenErrorReason.ExpiredSessionTokenMissingSidClaim }
        }
      };
    }
    try {
      const response = await options.apiClient.sessions.refreshSession(decodeResult.payload.sid, {
        format: "cookie",
        suffixed_cookies: authenticateContext2.usesSuffixedCookies(),
        expired_token: expiredSessionToken || "",
        refresh_token: refreshToken2 || "",
        request_origin: authenticateContext2.clerkUrl.origin,
        // The refresh endpoint expects headers as Record<string, string[]>, so we need to transform it.
        request_headers: Object.fromEntries(Array.from(request.headers.entries()).map(([k, v]) => [k, [v]]))
      });
      return { data: response.cookies, error: null };
    } catch (err) {
      if (err?.errors?.length) {
        if (err.errors[0].code === "unexpected_error") {
          return {
            data: null,
            error: {
              message: `Fetch unexpected error`,
              cause: { reason: RefreshTokenErrorReason.FetchError, errors: err.errors }
            }
          };
        }
        return {
          data: null,
          error: {
            message: err.errors[0].code,
            cause: { reason: err.errors[0].code, errors: err.errors }
          }
        };
      } else {
        return {
          data: null,
          error: {
            message: `Unexpected Server/BAPI error`,
            cause: { reason: RefreshTokenErrorReason.UnexpectedBAPIError, errors: [err] }
          }
        };
      }
    }
  }
  async function attemptRefresh(authenticateContext2) {
    const { data: cookiesToSet, error } = await refreshToken(authenticateContext2);
    if (!cookiesToSet || cookiesToSet.length === 0) {
      return { data: null, error };
    }
    const headers = new Headers();
    let sessionToken = "";
    cookiesToSet.forEach((x) => {
      headers.append("Set-Cookie", x);
      if (getCookieName(x).startsWith(constants.Cookies.Session)) {
        sessionToken = getCookieValue(x);
      }
    });
    const { data: jwtPayload, errors } = await verifyToken(sessionToken, authenticateContext2);
    if (errors) {
      return {
        data: null,
        error: {
          message: `Clerk: unable to verify refreshed session token.`,
          cause: { reason: RefreshTokenErrorReason.InvalidSessionToken, errors }
        }
      };
    }
    return { data: { jwtPayload, sessionToken, headers }, error: null };
  }
  function handleMaybeHandshakeStatus(authenticateContext2, reason, message, headers) {
    if (!handshakeService.isRequestEligibleForHandshake()) {
      return signedOut(authenticateContext2, reason, message);
    }
    const handshakeHeaders = headers ?? handshakeService.buildRedirectToHandshake(reason);
    if (handshakeHeaders.get(constants.Headers.Location)) {
      handshakeHeaders.set(constants.Headers.CacheControl, "no-store");
    }
    const isRedirectLoop = handshakeService.checkAndTrackRedirectLoop(handshakeHeaders);
    if (isRedirectLoop) {
      const msg = `Clerk: Refreshing the session token resulted in an infinite redirect loop. This usually means that your Clerk instance keys do not match - make sure to copy the correct publishable and secret keys from the Clerk dashboard.`;
      console.log(msg);
      return signedOut(authenticateContext2, reason, message);
    }
    return handshake(authenticateContext2, reason, message, handshakeHeaders);
  }
  function handleMaybeOrganizationSyncHandshake(authenticateContext2, auth) {
    const organizationSyncTarget = organizationMatcher.findTarget(authenticateContext2.clerkUrl);
    if (!organizationSyncTarget) {
      return null;
    }
    let mustActivate = false;
    if (organizationSyncTarget.type === "organization") {
      if (organizationSyncTarget.organizationSlug && organizationSyncTarget.organizationSlug !== auth.orgSlug) {
        mustActivate = true;
      }
      if (organizationSyncTarget.organizationId && organizationSyncTarget.organizationId !== auth.orgId) {
        mustActivate = true;
      }
    }
    if (organizationSyncTarget.type === "personalAccount" && auth.orgId) {
      mustActivate = true;
    }
    if (!mustActivate) {
      return null;
    }
    if (authenticateContext2.handshakeRedirectLoopCounter > 0) {
      console.warn(
        "Clerk: Organization activation handshake loop detected. This is likely due to an invalid organization ID or slug. Skipping organization activation."
      );
      return null;
    }
    const handshakeState = handleMaybeHandshakeStatus(
      authenticateContext2,
      AuthErrorReason.ActiveOrganizationMismatch,
      ""
    );
    if (handshakeState.status !== "handshake") {
      return null;
    }
    return handshakeState;
  }
  async function authenticateRequestWithTokenInHeader() {
    const { sessionTokenInHeader } = authenticateContext;
    try {
      const { data, errors } = await verifyToken(sessionTokenInHeader, authenticateContext);
      if (errors) {
        throw errors[0];
      }
      return signedIn(authenticateContext, data, void 0, sessionTokenInHeader);
    } catch (err) {
      return handleError(err, "header");
    }
  }
  async function authenticateRequestWithTokenInCookie() {
    const hasActiveClient = authenticateContext.clientUat;
    const hasSessionToken = !!authenticateContext.sessionTokenInCookie;
    const hasDevBrowserToken = !!authenticateContext.devBrowserToken;
    if (authenticateContext.handshakeNonce || authenticateContext.handshakeToken) {
      try {
        return await handshakeService.resolveHandshake();
      } catch (error) {
        if (error instanceof TokenVerificationError && authenticateContext.instanceType === "development") {
          handshakeService.handleTokenVerificationErrorInDevelopment(error);
        } else {
          console.error("Clerk: unable to resolve handshake:", error);
        }
      }
    }
    if (authenticateContext.instanceType === "development" && authenticateContext.clerkUrl.searchParams.has(constants.QueryParameters.DevBrowser)) {
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.DevBrowserSync, "");
    }
    const isRequestEligibleForMultiDomainSync = authenticateContext.isSatellite && authenticateContext.secFetchDest === "document";
    if (authenticateContext.instanceType === "production" && isRequestEligibleForMultiDomainSync) {
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.SatelliteCookieNeedsSyncing, "");
    }
    if (authenticateContext.instanceType === "development" && isRequestEligibleForMultiDomainSync && !authenticateContext.clerkUrl.searchParams.has(constants.QueryParameters.ClerkSynced)) {
      const redirectURL = new URL(authenticateContext.signInUrl);
      redirectURL.searchParams.append(
        constants.QueryParameters.ClerkRedirectUrl,
        authenticateContext.clerkUrl.toString()
      );
      const headers = new Headers({ [constants.Headers.Location]: redirectURL.toString() });
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.SatelliteCookieNeedsSyncing, "", headers);
    }
    const redirectUrl = new URL(authenticateContext.clerkUrl).searchParams.get(
      constants.QueryParameters.ClerkRedirectUrl
    );
    if (authenticateContext.instanceType === "development" && !authenticateContext.isSatellite && redirectUrl) {
      const redirectBackToSatelliteUrl = new URL(redirectUrl);
      if (authenticateContext.devBrowserToken) {
        redirectBackToSatelliteUrl.searchParams.append(
          constants.QueryParameters.DevBrowser,
          authenticateContext.devBrowserToken
        );
      }
      redirectBackToSatelliteUrl.searchParams.append(constants.QueryParameters.ClerkSynced, "true");
      const headers = new Headers({ [constants.Headers.Location]: redirectBackToSatelliteUrl.toString() });
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.PrimaryRespondsToSyncing, "", headers);
    }
    if (authenticateContext.instanceType === "development" && !hasDevBrowserToken) {
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.DevBrowserMissing, "");
    }
    if (!hasActiveClient && !hasSessionToken) {
      return signedOut(authenticateContext, AuthErrorReason.SessionTokenAndUATMissing, "");
    }
    if (!hasActiveClient && hasSessionToken) {
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.SessionTokenWithoutClientUAT, "");
    }
    if (hasActiveClient && !hasSessionToken) {
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.ClientUATWithoutSessionToken, "");
    }
    const { data: decodeResult, errors: decodedErrors } = decodeJwt(authenticateContext.sessionTokenInCookie);
    if (decodedErrors) {
      return handleError(decodedErrors[0], "cookie");
    }
    if (decodeResult.payload.iat < authenticateContext.clientUat) {
      return handleMaybeHandshakeStatus(authenticateContext, AuthErrorReason.SessionTokenIATBeforeClientUAT, "");
    }
    try {
      const { data, errors } = await verifyToken(authenticateContext.sessionTokenInCookie, authenticateContext);
      if (errors) {
        throw errors[0];
      }
      const signedInRequestState = signedIn(
        authenticateContext,
        data,
        void 0,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        authenticateContext.sessionTokenInCookie
      );
      const authObject = signedInRequestState.toAuth();
      if (authObject.userId) {
        const handshakeRequestState = handleMaybeOrganizationSyncHandshake(authenticateContext, authObject);
        if (handshakeRequestState) {
          return handshakeRequestState;
        }
      }
      return signedInRequestState;
    } catch (err) {
      return handleError(err, "cookie");
    }
    return signedOut(authenticateContext, AuthErrorReason.UnexpectedError);
  }
  async function handleError(err, tokenCarrier) {
    if (!(err instanceof TokenVerificationError)) {
      return signedOut(authenticateContext, AuthErrorReason.UnexpectedError);
    }
    let refreshError;
    if (isRequestEligibleForRefresh(err, authenticateContext, request)) {
      const { data, error } = await attemptRefresh(authenticateContext);
      if (data) {
        return signedIn(authenticateContext, data.jwtPayload, data.headers, data.sessionToken);
      }
      if (error?.cause?.reason) {
        refreshError = error.cause.reason;
      } else {
        refreshError = RefreshTokenErrorReason.UnexpectedSDKError;
      }
    } else {
      if (request.method !== "GET") {
        refreshError = RefreshTokenErrorReason.NonEligibleNonGet;
      } else if (!authenticateContext.refreshTokenInCookie) {
        refreshError = RefreshTokenErrorReason.NonEligibleNoCookie;
      } else {
        refreshError = null;
      }
    }
    err.tokenCarrier = tokenCarrier;
    const reasonToHandshake = [
      TokenVerificationErrorReason.TokenExpired,
      TokenVerificationErrorReason.TokenNotActiveYet,
      TokenVerificationErrorReason.TokenIatInTheFuture
    ].includes(err.reason);
    if (reasonToHandshake) {
      return handleMaybeHandshakeStatus(
        authenticateContext,
        convertTokenVerificationErrorReasonToAuthErrorReason({ tokenError: err.reason, refreshError }),
        err.getFullMessage()
      );
    }
    return signedOut(authenticateContext, err.reason, err.getFullMessage());
  }
  if (authenticateContext.sessionTokenInHeader) {
    return authenticateRequestWithTokenInHeader();
  }
  return authenticateRequestWithTokenInCookie();
}
var debugRequestState = (params) => {
  const { isSignedIn, proxyUrl, reason, message, publishableKey, isSatellite, domain } = params;
  return { isSignedIn, proxyUrl, reason, message, publishableKey, isSatellite, domain };
};
var convertTokenVerificationErrorReasonToAuthErrorReason = ({
  tokenError,
  refreshError
}) => {
  switch (tokenError) {
    case TokenVerificationErrorReason.TokenExpired:
      return `${AuthErrorReason.SessionTokenExpired}-refresh-${refreshError}`;
    case TokenVerificationErrorReason.TokenNotActiveYet:
      return AuthErrorReason.SessionTokenNBF;
    case TokenVerificationErrorReason.TokenIatInTheFuture:
      return AuthErrorReason.SessionTokenIatInTheFuture;
    default:
      return AuthErrorReason.UnexpectedError;
  }
};

// src/tokens/factory.ts
var defaultOptions = {
  secretKey: "",
  jwtKey: "",
  apiUrl: void 0,
  apiVersion: void 0,
  proxyUrl: "",
  publishableKey: "",
  isSatellite: false,
  domain: "",
  audience: ""
};
function createAuthenticateRequest(params) {
  const buildTimeOptions = mergePreDefinedOptions(defaultOptions, params.options);
  const apiClient = params.apiClient;
  const authenticateRequest2 = (request, options = {}) => {
    const { apiUrl, apiVersion } = buildTimeOptions;
    const runTimeOptions = mergePreDefinedOptions(buildTimeOptions, options);
    return authenticateRequest(request, {
      ...options,
      ...runTimeOptions,
      // We should add all the omitted props from options here (eg apiUrl / apiVersion)
      // to avoid runtime options override them.
      apiUrl,
      apiVersion,
      apiClient
    });
  };
  return {
    authenticateRequest: authenticateRequest2,
    debugRequestState
  };
}

// src/index.ts
var verifyToken2 = withLegacyReturn(verifyToken);
function createClerkClient(options) {
  const opts = { ...options };
  const apiClient = createBackendApiClient(opts);
  const requestState = createAuthenticateRequest({ options: opts, apiClient });
  const telemetry = new import_telemetry.TelemetryCollector({
    ...options.telemetry,
    publishableKey: opts.publishableKey,
    secretKey: opts.secretKey,
    samplingRate: 0.1,
    ...opts.sdkMetadata ? { sdk: opts.sdkMetadata.name, sdkVersion: opts.sdkMetadata.version } : {}
  });
  return {
    ...apiClient,
    ...requestState,
    telemetry
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createClerkClient,
  verifyToken
});
//# sourceMappingURL=index.js.map