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
