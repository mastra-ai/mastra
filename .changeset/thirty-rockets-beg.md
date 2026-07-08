---
'@mastra/editor': patch
---

Fixed multi-tenant tool connections for Composio-backed agents.

**Multi-tenant credential auto-resolve**

Agents that use a `caller-supplied` connection scope now let Composio pick the connected account within each tenant's user bucket, instead of pinning one shared account for every caller. This removes the need to track per-tenant account IDs yourself when building multi-tenant SaaS on top of the Agent Builder.

**Fixed account authorization**

Connecting a new account now uses Composio's supported managed-OAuth link flow, replacing a deprecated endpoint that stopped working for managed OAuth. Connections that collect custom fields (such as a Confluence subdomain) continue to work unchanged.
