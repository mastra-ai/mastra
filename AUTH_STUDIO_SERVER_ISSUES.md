# Auth Issues: Server/Studio Split

This document tracks GitHub issues related to authentication in the context of the server/studio split architecture.

**Source:** `gh issue list --repo mastra-ai/mastra --label Authentication --state all`

## Summary

- **Total issues with Authentication label:** 33
- **Currently open:** 7
- **Closed:** 26

The dual auth system (PR #17722, merged June 10, 2026) addresses some of these issues by enabling separate auth providers for Studio (internal team) vs API (external customers). However, several gaps remain.

---

## All Authentication-Labeled Issues (from GitHub)

### Open Issues (7)

| # | Title | Impact | Summary |
|---|-------|--------|---------|
| [#17705](https://github.com/mastra-ai/mastra/issues/17705) | CompositeAuth does not proxy signIn from credentials sub-providers | high | CompositeAuth breaks credential sign-in |
| [#17216](https://github.com/mastra-ai/mastra/issues/17216) | [Auth/FGA] Trusted system-actor signal for cron / background workflows | high | Cron/background jobs need system-actor bypass for FGA |
| [#16232](https://github.com/mastra-ai/mastra/issues/16232) | Bundled Studio routes bypass server.auth, including /refresh-events SSE | high | SSE routes bypass auth entirely |
| [#16018](https://github.com/mastra-ai/mastra/issues/16018) | Channel adapter should support per-request agent override for multi-agent RBAC | high | Channels need per-request RBAC |
| [#14619](https://github.com/mastra-ai/mastra/issues/14619) | buildCapabilities() gates SSO/session/user behind EE license | high | SSO/session incorrectly gated behind EE (should only be RBAC/ACL) |

### Recently Closed Issues (relevant to dual auth)

| # | Title | Impact | Summary |
|---|-------|--------|---------|
| [#17420](https://github.com/mastra-ai/mastra/issues/17420) | [INTEGRATION] Kinde — auth provider | high | Kinde auth provider integration |
| [#16460](https://github.com/mastra-ai/mastra/issues/16460) | Playground login ignores --server-api-prefix | high | Login always POSTs to /api/auth, ignoring prefix |
| [#15470](https://github.com/mastra-ai/mastra/issues/15470) | Can't access Studio when using Clerk as auth provider | medium | Clerk auth breaks Studio access |
| [#15270](https://github.com/mastra-ai/mastra/issues/15270) | Agent identity auth provider: @mastra/auth-agentlair | high | Agent identity auth provider |
| [#14350](https://github.com/mastra-ai/mastra/issues/14350) | [DOCS] How to use Studio with authentication? | medium | Documentation for Studio + auth |
| [#14293](https://github.com/mastra-ai/mastra/issues/14293) | JWT Auth Flow | medium | JWT auth flow issues |
| [#14089](https://github.com/mastra-ai/mastra/issues/14089) | [FEATURE] Fine-Grained Authorization (FGA) support | high | WorkOS FGA integration |
| [#13951](https://github.com/mastra-ai/mastra/issues/13951) | MastraAuthBetterAuth: authorizeUser fails with Better Auth org plugin | high | Better Auth + orgs = 403 |
| [#13926](https://github.com/mastra-ai/mastra/issues/13926) | Add mapUserToResourceId callback for automatic resource ID scoping | high | Auto resource scoping |
| [#13794](https://github.com/mastra-ai/mastra/issues/13794) | How to disable studio auth locally? | high | "Authentication Required" with no way to disable |
| [#13639](https://github.com/mastra-ai/mastra/issues/13639) | Unable to get the better-auth integration to work | medium | Better Auth integration broken |
| [#13083](https://github.com/mastra-ai/mastra/issues/13083) | Bypassing routes works locally but not in production | high | Route bypass inconsistent |
| [#12371](https://github.com/mastra-ai/mastra/issues/12371) | Mastra Studio Local - Add API / Auth headers with server adapters | medium | Add headers when using adapters |
| [#12286](https://github.com/mastra-ai/mastra/issues/12286) | registerApiRoute authentication doesn't work | high | Custom route auth broken |
| [#12218](https://github.com/mastra-ai/mastra/issues/12218) | Need help with migration to v1 (AUTH) | medium | Auth migration issues |
| [#12158](https://github.com/mastra-ai/mastra/issues/12158) | Thread authorization | high | Thread-level authorization |
| [#12106](https://github.com/mastra-ai/mastra/issues/12106) | Custom API Routes not validating requiresAuth with path params | high | Path params break requiresAuth matching |
| [#11407](https://github.com/mastra-ai/mastra/issues/11407) | Auth endpoints failing | high | "Invalid or expired token" on fresh API keys |
| [#11194](https://github.com/mastra-ai/mastra/issues/11194) | Authentication required | - | Auth required error |
| [#10214](https://github.com/mastra-ai/mastra/issues/10214) | resourceId and threadId for chatRoute should contain auth info | high | Auth info not in resourceId/threadId |
| [#9939](https://github.com/mastra-ai/mastra/issues/9939) | Mastra Auth with Clerk doesn't work without Organization enabled | high | Clerk requires orgs enabled |
| [#9163](https://github.com/mastra-ai/mastra/issues/9163) | experimental_auth user identity | - | User identity issues |
| [#9162](https://github.com/mastra-ai/mastra/issues/9162) | organization_not_enabled_in_instance using Clerk | - | Clerk org not enabled |
| [#8488](https://github.com/mastra-ai/mastra/issues/8488) | auth, middleware and input/output processors difference | - | Confusion about auth vs middleware |
| [#7674](https://github.com/mastra-ai/mastra/issues/7674) | Apply MastraJwtAuth against all API routes, including custom ones | high | JWT auth on custom routes |
| [#7480](https://github.com/mastra-ai/mastra/issues/7480) | Authorization, RBAC | high | RBAC questions |

---

## Themes

### Theme 1: Studio Can't Authenticate Against Custom-Auth'd Server
Issues: #16460, #15470, #14350, #13794, #12371, #11407

**Addressed by #17722:** Partially. Dual auth allows separate Studio auth provider, but path prefix issues remain.

### Theme 2: License Gating Blocks Auth Features Users Expect
Issues: #14619

**Addressed by #17722:** No. This is a separate issue about SSO/session being incorrectly gated behind EE license.

### Theme 3: requiresAuth Enforcement Bugs
Issues: #12286, #12106, #7674

**Addressed by #17722:** No. These are middleware enforcement bugs unrelated to dual auth.

### Theme 4: Context Not Propagated to Handlers
Issues: #12158, #10214

**Addressed by #17722:** Partially. Dual auth adds auth mode to request context, but thread/resource scoping remains incomplete.

### Theme 5: SSE/Streaming Routes Bypass Auth
Issues: #16232

**Addressed by #17722:** No. SSE routes like /refresh-events still bypass server.auth.

### Theme 6: FGA / Fine-Grained Authorization
Issues: #17216, #14089, #13926

**Addressed by #17722:** Dual auth supports FGA routing, but system-actor bypass for cron/background jobs not addressed.

### Theme 7: Provider-Specific Issues
Issues: #17420 (Kinde), #15470 (Clerk), #13951 (Better Auth), #13639 (Better Auth), #9939 (Clerk), #9162 (Clerk)

**Addressed by #17722:** No. These are provider-specific integration issues.

---

## Related PRs

| PR | Title | Status | Description |
|----|-------|--------|-------------|
| [#17722](https://github.com/mastra-ai/mastra/pull/17722) | feat(auth): add dual auth system for Studio vs API | ✅ Merged | Enables separate auth providers for Studio (team) vs API (customers) |
| [#17142](https://github.com/mastra-ai/mastra/pull/17142) | refactor(auth): extract shared auth internals | Open | Extracts auth to `@internal/auth` package (Ward's refactor) |
| [#17079](https://github.com/mastra-ai/mastra/pull/17079) | feat(fga): add resource type discovery | Open | FGA resource type discovery |
| [#17080](https://github.com/mastra-ai/mastra/pull/17080) | feat(fga): add ownership pattern | Open | Auto-assign owner role on resource creation |
| [#17106](https://github.com/mastra-ai/mastra/pull/17106) | feat(fga): add FGA ownership and sharing | Open | Share dialog for FGA-protected resources |

---

## Assessment: What Does #17722 Actually Address?

**Directly addressed:** ~5-7 issues
- Studio can use separate auth provider (helps #15470, #13794, #14350)
- API can use separate auth provider (helps #12371, #11407)
- Auth mode routing based on x-mastra-client-type header

**NOT addressed:** ~26 issues
- requiresAuth enforcement bugs (#12286, #12106, #7674)
- SSE routes bypassing auth (#16232)
- EE license gating (#14619)
- Provider-specific issues (Clerk, Better Auth, Kinde)
- Context propagation to handlers (#12158, #10214)
- FGA system-actor bypass (#17216)
- CompositeAuth credential proxying (#17705)

**Honest assessment: PR #17722 addresses roughly 15-20% of open auth issues.**
