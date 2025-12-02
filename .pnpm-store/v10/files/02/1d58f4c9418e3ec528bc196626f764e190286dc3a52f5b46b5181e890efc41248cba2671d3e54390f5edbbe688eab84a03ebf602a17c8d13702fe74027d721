import {
  AuthStatus,
  constants,
  createAuthenticateRequest,
  createBackendApiClient,
  createClerkRequest,
  debugRequestState,
  makeAuthObjectSerializable,
  signedInAuthObject,
  signedOutAuthObject
} from "./chunk-MQOIIRZU.mjs";
import {
  errorThrower,
  parsePublishableKey
} from "./chunk-LWOXHF4E.mjs";
import "./chunk-2Z4IRG2E.mjs";
import "./chunk-5JS2VYLU.mjs";

// src/createRedirect.ts
import { buildAccountsBaseUrl } from "@clerk/shared/buildAccountsBaseUrl";
var buildUrl = (_baseUrl, _targetUrl, _returnBackUrl, _devBrowserToken) => {
  if (_baseUrl === "") {
    return legacyBuildUrl(_targetUrl.toString(), _returnBackUrl?.toString());
  }
  const baseUrl = new URL(_baseUrl);
  const returnBackUrl = _returnBackUrl ? new URL(_returnBackUrl, baseUrl) : void 0;
  const res = new URL(_targetUrl, baseUrl);
  if (returnBackUrl) {
    res.searchParams.set("redirect_url", returnBackUrl.toString());
  }
  if (_devBrowserToken && baseUrl.hostname !== res.hostname) {
    res.searchParams.set(constants.QueryParameters.DevBrowser, _devBrowserToken);
  }
  return res.toString();
};
var legacyBuildUrl = (targetUrl, redirectUrl) => {
  let url;
  if (!targetUrl.startsWith("http")) {
    if (!redirectUrl || !redirectUrl.startsWith("http")) {
      throw new Error("destination url or return back url should be an absolute path url!");
    }
    const baseURL = new URL(redirectUrl);
    url = new URL(targetUrl, baseURL.origin);
  } else {
    url = new URL(targetUrl);
  }
  if (redirectUrl) {
    url.searchParams.set("redirect_url", redirectUrl);
  }
  return url.toString();
};
var createRedirect = (params) => {
  const { publishableKey, redirectAdapter, signInUrl, signUpUrl, baseUrl, sessionStatus } = params;
  const parsedPublishableKey = parsePublishableKey(publishableKey);
  const frontendApi = parsedPublishableKey?.frontendApi;
  const isDevelopment = parsedPublishableKey?.instanceType === "development";
  const accountsBaseUrl = buildAccountsBaseUrl(frontendApi);
  const hasPendingStatus = sessionStatus === "pending";
  const redirectToTasks = (url, { returnBackUrl }) => {
    return redirectAdapter(
      buildUrl(baseUrl, `${url}/tasks`, returnBackUrl, isDevelopment ? params.devBrowserToken : null)
    );
  };
  const redirectToSignUp = ({ returnBackUrl } = {}) => {
    if (!signUpUrl && !accountsBaseUrl) {
      errorThrower.throwMissingPublishableKeyError();
    }
    const accountsSignUpUrl = `${accountsBaseUrl}/sign-up`;
    function buildSignUpUrl(signIn) {
      if (!signIn) {
        return;
      }
      const url = new URL(signIn, baseUrl);
      url.pathname = `${url.pathname}/create`;
      return url.toString();
    }
    const targetUrl = signUpUrl || buildSignUpUrl(signInUrl) || accountsSignUpUrl;
    if (hasPendingStatus) {
      return redirectToTasks(targetUrl, { returnBackUrl });
    }
    return redirectAdapter(buildUrl(baseUrl, targetUrl, returnBackUrl, isDevelopment ? params.devBrowserToken : null));
  };
  const redirectToSignIn = ({ returnBackUrl } = {}) => {
    if (!signInUrl && !accountsBaseUrl) {
      errorThrower.throwMissingPublishableKeyError();
    }
    const accountsSignInUrl = `${accountsBaseUrl}/sign-in`;
    const targetUrl = signInUrl || accountsSignInUrl;
    if (hasPendingStatus) {
      return redirectToTasks(targetUrl, { returnBackUrl });
    }
    return redirectAdapter(buildUrl(baseUrl, targetUrl, returnBackUrl, isDevelopment ? params.devBrowserToken : null));
  };
  return { redirectToSignUp, redirectToSignIn };
};

// src/util/decorateObjectWithResources.ts
var decorateObjectWithResources = async (obj, authObj, opts) => {
  const { loadSession, loadUser, loadOrganization } = opts || {};
  const { userId, sessionId, orgId } = authObj;
  const { sessions, users, organizations } = createBackendApiClient({ ...opts });
  const [sessionResp, userResp, organizationResp] = await Promise.all([
    loadSession && sessionId ? sessions.getSession(sessionId) : Promise.resolve(void 0),
    loadUser && userId ? users.getUser(userId) : Promise.resolve(void 0),
    loadOrganization && orgId ? organizations.getOrganization({ organizationId: orgId }) : Promise.resolve(void 0)
  ]);
  const resources = stripPrivateDataFromObject({
    session: sessionResp,
    user: userResp,
    organization: organizationResp
  });
  return Object.assign(obj, resources);
};
function stripPrivateDataFromObject(authObject) {
  const user = authObject.user ? { ...authObject.user } : authObject.user;
  const organization = authObject.organization ? { ...authObject.organization } : authObject.organization;
  prunePrivateMetadata(user);
  prunePrivateMetadata(organization);
  return { ...authObject, user, organization };
}
function prunePrivateMetadata(resource) {
  if (resource) {
    if ("privateMetadata" in resource) {
      delete resource["privateMetadata"];
    }
    if ("private_metadata" in resource) {
      delete resource["private_metadata"];
    }
  }
  return resource;
}

// src/internal.ts
import { reverificationError, reverificationErrorResponse } from "@clerk/shared/authorization-errors";
export {
  AuthStatus,
  constants,
  createAuthenticateRequest,
  createClerkRequest,
  createRedirect,
  debugRequestState,
  decorateObjectWithResources,
  makeAuthObjectSerializable,
  reverificationError,
  reverificationErrorResponse,
  signedInAuthObject,
  signedOutAuthObject,
  stripPrivateDataFromObject
};
//# sourceMappingURL=internal.mjs.map