---
title: Mastra Cloud
description: Deployment and monitoring service for Mastra applications
---

# Mastra Cloud

[Mastra Cloud](https://mastra.ai/cloud) is a platform for deploying, managing, monitoring, and debugging Mastra applications. When you [deploy](/docs/mastra-cloud/setting-up) your application, Mastra Cloud exposes your agents, tools, and workflows as REST API endpoints.

:::tip Mastra Cloud

Deploy your Mastra application to [Mastra Cloud](https://mastra.ai/cloud) for automated deployment, monitoring, and management.

:::

## Platform features

Deploy and manage your applications with automated builds, organized projects, and no additional configuration.

![Platform features](/img/mastra-cloud/mastra-cloud-platform-features.jpg)

Key features:

Mastra Cloud supports zero-config deployment, continuous integration with GitHub, and atomic deployments that package agents, tools, and workflows together.

## Project Dashboard

Monitor and debug your applications with detailed output logs, deployment state, and interactive tools.

![Project dashboard](/img/mastra-cloud/mastra-cloud-project-dashboard.jpg)

Key features:

The Project Dashboard gives you an overview of your application's status and deployments, with access to logs and a built-in playground for testing agents and workflows.

## Project structure

Use a standard Mastra project structure for proper detection and deployment.

> File structure information available - see original documentation for detailed tree view.

Mastra Cloud scans your repository for:

- **Agents**: Defined using: `new Agent({...})`
- **Tools**: Defined using: `createTool({...})`
- **Workflows**: Defined using: `createWorkflow({...})`
- **Steps**: Defined using: `createStep({...})`
- **Environment Variables**: API keys and configuration variables

## Technical implementation

Mastra Cloud is purpose-built for Mastra agents, tools, and workflows. It handles long-running requests, records detailed traces for every execution, and includes built-in support for evals.

## Next steps

- [Setting Up and Deploying](/docs/mastra-cloud/setting-up)
