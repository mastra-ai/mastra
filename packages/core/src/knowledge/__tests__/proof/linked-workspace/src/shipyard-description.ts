// Full instance description from Shipyard src/mastra/index.ts, inspected 2026-09-08.
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

Two kinds of companion scopes qualify content, and the name is the
badge:
- ":internal" = private. Anything private about a public subject
  belongs in that scope's ":internal" companion (for example,
  "feature:memory:internal"), never in the public scope. Publishing
  later is a governed promotion.
- ":uncurated" = provisional. Session capture lands in the
  ":uncurated" companion of its suggested scope automatically. Treat
  uncurated content you read as live-ish and unreviewed; deliberate
  knowledge should be written to the proper scope explicitly, not left
  to capture.

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
goes to its work scope. Session-local observations not worth sharing go
to the private thread scope. Durable feature knowledge is suggested on
the feature scope; only the merged-PR import agent and governed
promotions write the feature tree directly. When unsure whether
something is public-safe, use the ":internal" companion.
`.trim();
