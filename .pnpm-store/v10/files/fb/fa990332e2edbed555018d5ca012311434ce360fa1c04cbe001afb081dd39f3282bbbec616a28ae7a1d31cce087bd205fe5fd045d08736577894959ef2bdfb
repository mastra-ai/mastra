// src/deriveState.ts
var deriveState = (clerkOperational, state, initialState) => {
  if (!clerkOperational && initialState) {
    return deriveFromSsrInitialState(initialState);
  }
  return deriveFromClientSideState(state);
};
var deriveFromSsrInitialState = (initialState) => {
  const userId = initialState.userId;
  const user = initialState.user;
  const sessionId = initialState.sessionId;
  const sessionStatus = initialState.sessionStatus;
  const sessionClaims = initialState.sessionClaims;
  const session = initialState.session;
  const organization = initialState.organization;
  const orgId = initialState.orgId;
  const orgRole = initialState.orgRole;
  const orgPermissions = initialState.orgPermissions;
  const orgSlug = initialState.orgSlug;
  const actor = initialState.actor;
  const factorVerificationAge = initialState.factorVerificationAge;
  return {
    userId,
    user,
    sessionId,
    session,
    sessionStatus,
    sessionClaims,
    organization,
    orgId,
    orgRole,
    orgPermissions,
    orgSlug,
    actor,
    factorVerificationAge
  };
};
var deriveFromClientSideState = (state) => {
  const userId = state.user ? state.user.id : state.user;
  const user = state.user;
  const sessionId = state.session ? state.session.id : state.session;
  const session = state.session;
  const sessionStatus = state.session?.status;
  const sessionClaims = state.session ? state.session.lastActiveToken?.jwt?.claims : null;
  const factorVerificationAge = state.session ? state.session.factorVerificationAge : null;
  const actor = session?.actor;
  const organization = state.organization;
  const orgId = state.organization ? state.organization.id : state.organization;
  const orgSlug = organization?.slug;
  const membership = organization ? user?.organizationMemberships?.find((om) => om.organization.id === orgId) : organization;
  const orgPermissions = membership ? membership.permissions : membership;
  const orgRole = membership ? membership.role : membership;
  return {
    userId,
    user,
    sessionId,
    session,
    sessionStatus,
    sessionClaims,
    organization,
    orgId,
    orgRole,
    orgSlug,
    orgPermissions,
    actor,
    factorVerificationAge
  };
};

export {
  deriveState
};
//# sourceMappingURL=chunk-ZIXJBK4O.mjs.map