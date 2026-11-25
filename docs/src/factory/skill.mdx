---
title: Agent skill
description: Install the Mastra Factory skill so an AI coding agent can inspect your Factory and make approved changes from the terminal.
---

# Agent skill

The Factory skill gives an AI coding agent the commands to operate a running Factory through the `mastra` CLI. Install it to review work and inspect sessions from your terminal instead of the web UI, and to delegate the changes you authorize. The skill is published in the [`mastra-ai/skills`](https://github.com/mastra-ai/skills/tree/main/skills/mastra-factory) repository.

## Install the skill

Add the skill to your coding agent:

```bash npm2yarn
npx skills add mastra-ai/skills --skill mastra-factory
```

During installation, select the target agent and the install scope: the current project or a global install.

To check the skill loaded, start a new agent session and ask which Factory projects it can see. The agent uses the skill's project listing. If it asks how to reach Factory instead, the skill isn't loaded in that session.

## Connect to your Factory

The agent connects before it inspects. It first checks for a compatible `mastra` CLI, and falls back to a temporary `npm exec` invocation when the CLI isn't installed.

Next it asks for your Factory Server URL. Use the deployment origin, the address where you open the web UI. Don't use a board page, a platform dashboard URL, or a URL that ends in `/api`. A local or self-hosted server uses the same form.

For a Factory hosted on Mastra platform, the agent checks the current login with `mastra auth whoami` and offers `mastra auth login` when you're logged out. That saved login is shared across directories and reused for recognized `*.factory.mastra.cloud` hosts. Self-hosted deployments use their own authentication, and the CLI doesn't send saved platform credentials to arbitrary hosts.

The agent then lists the projects it can see:

```bash
mastra api --url "$FACTORY_URL" factory project list '{"page":0,"perPage":10}'
```

When more than one project is plausible, the agent reports the choices for you to select.

## Ask for status and inspection

Requests for status, a queue review, or a recommendation don't change Factory state. The agent selects the project you named, inspects work items, metrics, thresholds, decisions, attention, and health findings, then correlates stages, revisions, sessions, and findings into one report.

The report covers active and queued work, blocked or unhealthy items, running sessions, pending decisions, and items that need your attention, and it ends with one recommended next action. The agent describes that action but doesn't perform it unless you ask.

Example requests:

- "Summarize the queue for project X."
- "Inspect work item X and its session, and tell me what's blocking it."
- "Report metrics and any health findings for the last seven days."
- "Which work items are waiting on a decision from me?"

## Delegate changes

The agent changes Factory state only when your request authorizes it. Authorization takes two forms: a request that specifies the action, or a standing delegation that sets scope and boundaries.

A named request points at one target, for example "move work item X to triage." A standing delegation covers an action class for a session or an objective, for example "keep project X triaged this session. Don't delete work items or start runs." Inside a granted scope, the agent acts without asking for confirmation each time, and it stops at the boundary or stop condition you set.

Some actions are high-impact and must appear explicitly in the scope, even inside a broad delegation:

- Deleting projects or work items.
- Bulk attention actions, such as marking many items read or archiving them.
- Starting runs for a work item.
- Changing automation settings, such as auto-run or plan auto-approval.

| Task | Example request |
| - | - |
| Queue upkeep | Move stale intake items to triage in project X |
| Decisions | Retry the failed decision for work item X |
| Attention | Show unread attention items |
| Start work | Start work item X in its linked session |

Stage changes use the work item's current revision, so a change that conflicts with a newer update fails instead of overwriting it. Starting a run also needs an existing Factory session connected to the project. When no such session exists, the agent reports the block instead of improvising a session or ID.

## Safety boundaries

The skill keeps the agent read-only until you delegate an action. It doesn't read `.env` files, tokens, or saved login contents, and it doesn't invent project IDs, stages, revisions, or sessions. The agent can propose a move, but the approval is still yours.
