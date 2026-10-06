// Instance description from Shipyard src/mastra/index.ts (inspected 2026-09-08), corrected for
// Knowledge v2.1: privacy comes from explicit grants and there are no automatic capture companions.
// Kept as input, not as a hand-authored structure plan.
export const shipyardDescription = `
Mastra's org-wide knowledge store. Audience: the Mastra team (the
"team:mastra" scope — every teammate and team agent principal) and its
agents; public scopes are additionally readable by anyone.

A "mastra" root scope holds durable knowledge about Mastra the product
and company. It is public-readonly and contains:
- "features": one scope per product capability, nested subfeatures as
  child scopes. Current truth about what each feature is and how it
  works. Public-readonly. Records here must cite provenance (PRs,
  issues, meetings) via wikilinks.
- "areas": org, product-surface, market, and team context. Readable
  and writable by team:mastra only.

Private companions qualify public subjects:
- An ":internal" companion (for example, "feature:memory:internal")
  sits directly beneath its public subject and holds anything private
  about it. It is private only because it declares team-only grants
  that stop public readonly inheritance; the name itself confers no
  privacy. Publishing later is a governed promotion.

A "repo:mastra" root scope holds artifacts of the public OSS repo,
public-readonly, with children:
- "issues": one node per GitHub issue. These nodes are maintained by
  the GitHub importer — treat them as read-only source material.
- "prs": one node per pull request, same shape ("pr:<number>").
Your work on an issue or PR goes in its work scope ("issue:<number>" /
"pr:<number>"): findings, decisions, state — wikilink the imported
node and any features it concerns. When a PR or issue concerns a
feature, member its work scope under that feature's scope.

Placement defaults: knowledge about the issue or PR you are working on
goes to its work scope. Session capture writes through ordinary
Knowledge tools under the session's own authority; session-local
observations not worth sharing go to the private thread scope.
Durable feature knowledge is suggested on the feature scope; only
the merged-PR import agent and governed promotions write the feature
tree directly. When unsure whether
something is public-safe, use the ":internal" companion.
`.trim();
