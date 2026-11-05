# Integrations page styleguide

Use this file for every page under `docs/src/content/en/integrations`. These pages explain how Mastra works with an external product, provider, library, framework, ecosystem, or deployment target.

## Goal

- Explain the Mastra-specific integration path.
- Take readers from the required starting point to a working result when setup is involved.
- Cover the provider-specific setup and behavior needed for that path.

## Titles and navigation

The common frontmatter pattern is `$PRODUCT | $SIDEBAR_CATEGORY`. Use the product or integration name as the H1.

```mdx
---
title: '$PRODUCT | $CATEGORY'
description: 'Use $PRODUCT with Mastra to $OUTCOME.'
---

# $PRODUCT
```

Follow the established pattern in the relevant integration category. Do not add `Using`, `Deploy Mastra to`, or another fixed prefix solely to satisfy a template.

Update `docs/src/content/en/integrations/sidebars.js` when adding or renaming an integration.

## Choose the page structure

Integration pages do not share one mandatory section order. Use a feature-oriented structure for independent capabilities and the task sequence in `STYLEGUIDE.md` when actions depend on earlier setup.

Integration tasks commonly add external-service setup, Mastra registration, production constraints, and verification in the destination product. Use only the sections the page needs.

## Integration categories

### Frameworks

Usually cover:

- creating or opening the framework project;
- initializing Mastra;
- connecting routes, server code, or UI code;
- running and verifying the project;
- framework-specific deployment or runtime constraints.

### Channels

Usually cover:

- service and credential prerequisites;
- provider registration;
- transport, webhook, or polling setup;
- storage or memory requirements;
- message handling and platform limitations;
- a concrete way to send or receive a test message.

### Databases and storage providers

Usually cover:

- the Mastra interfaces the provider implements;
- package installation and client initialization;
- registration with Mastra;
- connection, schema, or index requirements;
- persistence and deployment constraints;
- provider-specific configuration that affects behavior.

### Observability integrations

Usually cover:

- exporter or bridge selection;
- credentials and environment variables;
- registration with observability;
- supported signals;
- buffering, flushing, quotas, or serverless behavior;
- verification in the destination product.

### Authentication providers

Usually cover:

- provider-side application setup;
- callback URLs and credentials;
- Mastra provider registration;
- Studio and API route behavior;
- session, token, or authorization constraints;
- a protected-route verification step.

### Browser, sandbox, and tool providers

Usually cover:

- credentials and package setup;
- agent, workspace, or Mastra registration;
- lifecycle and cleanup;
- filesystem, process, session, or remote-runtime boundaries;
- tool availability and exclusions;
- a minimal invocation.

### Mastra Connect providers

Each product has one integration page. When a vendor sells separate products, such as Neon Postgres, Neon Functions, and Neon Object Storage, keep separate pages and add the Connect section to the page for the product its tools manage. List each page in the sidebar category that matches what the product does; use **Other providers** only when no category fits. Put `## Connect` first, then `## Self-managed setup` when a supported alternative exists. On a page whose main topic isn't Connect, such as Neon Postgres storage, put `## Connect` at the end and link it from the introduction. Add new Connect pages to the Connect page's provider grid too. Don't add a self-managed section for Connect-only providers.

`packages/connect/scripts/generate-provider-docs.ts` owns these pages:

- Simple providers have fully generated pages. Change `packages/connect/scripts/provider-docs-metadata.ts` and regenerate; don't edit the page.
- Pages with other capabilities, such as channels or authentication, are handwritten and import a generated `### Agent tools` partial from `src/components/connect/generated/`.

On a handwritten page:

1. Start with a short list of the ways to use the provider, and link each non-Connect capability to its section.
1. In `## Connect`, link the Connect setup prerequisite, then render the partial. Add Connect-specific tasks, such as `### Agent chat`, as H3 sections.
1. Put other capabilities under their own H2, such as `## Server authentication`. Use `## Self-managed setup` only for an alternative way to do the same task as Connect, such as running your own Slack app.
1. Name each connection ID and credential type. When one provider needs separate connections, such as Slack's `slack` and `slack-channels`, say so before the steps.

Link the full tool list in `/reference/connect/providers` instead of repeating it. See `packages/connect/scripts/README.md` for regeneration.

## Deployment integrations

Use the following guidance for pages under `/integrations/deploy`.

A deployment page should:

- move a working Mastra application onto one supported target;
- explain the deployment path that applies to that target;
- cover runtime, persistence, networking, security, and observability constraints that affect the result.

The common title pattern is `$PLATFORM | Deploy`. The H1 may be the platform name, `$PLATFORM Deployer`, or the specific deployment product.

```mdx
---
title: '$PLATFORM | Deploy'
description: 'Deploy a Mastra application to $PLATFORM.'
---

# $PLATFORM
```

Open with what gets deployed and how the platform runs it. Add a scope note when the page covers only one path, such as the Mastra server rather than a framework adapter.

### Mastra deployer package

When Mastra provides an `@mastra/deployer-*` package, cover:

- package installation;
- registration in the Mastra configuration;
- generated output or build behavior;
- platform connection and deployment;
- optional deployer overrides;
- the matching deployer reference page.

### Framework or server deployment

When readers deploy through a framework adapter or existing server, cover:

- supported build and start commands;
- server adapter or framework requirements;
- route prefixes and public endpoints;
- environment variables;
- platform configuration files;
- process and filesystem assumptions.

Do not invent a Mastra deployer setup when none exists.

### Container or infrastructure deployment

For virtual machines, containers, Kubernetes, or similar infrastructure, cover:

- the build artifact;
- container command and exposed port;
- health checks;
- persistent storage and external services;
- ingress and authentication;
- scaling and process-role constraints;
- graceful shutdown or recovery behavior when relevant.

### Workflow runner integration

When an external platform executes Mastra workflows, cover:

- how Mastra workflow and step semantics map to the runner;
- required packages and service setup;
- registration and serving endpoints;
- event keys, signing keys, or development-mode controls;
- retries, memoization, suspension, and observability behavior;
- local and production execution.

### Platform constraints

Address constraints that change how Mastra behaves:

- ephemeral filesystems;
- cold starts and execution duration;
- serverless process termination;
- public and private networking;
- required ports and route prefixes;
- hosted storage requirements;
- worker roles and scaling limits;
- environment variable injection;
- observability flushing;
- browser or sandbox runtime support.

State the consequence and required action. Link to an alternative deployment pattern when the platform cannot support a feature.

### Deployment security and verification

- Require authentication before exposing Mastra endpoints or Studio publicly.
- Document secret and token requirements without showing real credentials.
- Put disabled signature verification, public callbacks, or broad Studio access in warnings.
- Verify the deployment through an endpoint, Studio route, workflow run, health check, log, or platform dashboard.
- State the expected result.

Verification may be the final task step or its own section.
