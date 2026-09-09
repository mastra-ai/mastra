# Personas — Mastra Software Factory

## Maintainer / repo owner
Owns a repository or Linear project connected to Factory. Configures integrations (GitHub App, Linear, Slack), decides whether auto-run and auto-approve-plans are on, defines custom boards for their own workflows (e.g. a release board), and is the human whose transitions carry approval weight (`isHumanTransition`). Reads the Documents page to keep `docs/factory/*.md` accurate, since agents read it as ground truth.

## Contributor / triager
Works cards day to day: reviews what the triage seat produced, approves or rejects a plan, moves a card between phases, and answers a parked review. Interacts through the Factory UI board view and through comments on the underlying GitHub issue/PR or Linear issue (which sync back into the work item's feed).

## External issue/PR author
Opens an issue or PR against a connected repository without being a project maintainer. Their items are marked `externallyAuthored`/`authorTrusted` from GitHub's answer, which gates whether an agent may act on the item unattended. Never interacts with Factory directly — only through GitHub/Linear.

## Agent (seated by role)
Not a human, but a first-class actor: `triage`, `plan`, `work`, and `review` are the four roles (`FACTORY_ROLE_STAGES`), each bound to one working phase. An agent run is identified by an `agent:*` actor id; its tool calls and results are what board `onEnter` rules and tool-result rules react to. Agents read the factory documents catalog, the work item's `sourceRef`, and skill prompts (`factory-triage`, `factory-plan`, `factory-review`, `factory-rereview`, `factory-complete-issue`) to act.

## Platform operator
Runs the Factory deployment itself (the `mastracode/web` host, or any host embedding `@mastra/factory`). Sets `MastraFactoryConfig` — storage backend, auth provider, sandbox config, `configVersion`, installed integrations and boards — and is responsible for `stateSecret`/`secretEncryption` being present in any deployment where auth is enabled. Reads the runbook and security-compliance docs.

## Integration author
A developer (internal or third-party) building a new `FactoryIntegration` (beyond the built-in GitHub, Linear, Slack, WorkOS) — implements the shared `FactoryIntegration` contract so its routes, tools, and diagnostics register into the system without factory code changes.
