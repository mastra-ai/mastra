# Cloud Roadmap

## High Level architecture ideas

Moved to separate architecture document.

---

## June/July Projects

These are projects that we want to get into the GA and have completed by November 1st

### Cloud → Playground parity

We need to get Cloud and Playground to feel the same. This means sharing components and ensuring the design/ux matches. Make sure we can easily pull in oss changes.

Moved to separate document.

### Evals

Evals - what Abhi/Shane/Vlad have been discussing

### Logs

Logs - we need to make logs more helpful

### Agent Network

Agent Network v2

### Rollback / Deployment improvements

We should be able to rollback to a previous deployment, we should have an option to not automatically deploy

### Preview Environments + Github PR comments

Auto-comment on Github PRs

### Playground → Cloud upgrade

We need a way to easily

---

## August → November (GA)

### Prompt CMS

We need to allow users to track and iterate on prompts

### Custom Domains

Users are going to want to bring their own domain to Mastra Cloud eventually

### Enterprise Security Features

This needs scoping, but we will need some kind of security features built into the cloud platform for Enterprises. General ideas are around Guardrails and Automated Red Teaming

### MCP Toolkits

The ability for a user to configure a selection of tools and get a single URL to access those tools locally. The configuration for this could live in the playground (but require authenticating to Cloud). It could work similar to Zapier MCP where you can select from a providers and then specific tools to configure a toolkit. Then in your agent code you create a `new ToolKit('https://cloud.mastra.ai/whatev')` and pass it into your agent (something like this).

In the playground and in cloud you could see your toolkits and test the tools individually before passing them to your agent.

This provides a really easy way for users to add capabilities to their agent quickly but also gets them to authenticate with cloud early and become dependent on our cloud environment (since the toolkit lives in and is configurable in cloud). It also is more dynamic as users can quickly swap tools in and out for their agents. So the agent gets a toolkit but the toolkit is made up of a dynamic list of tools.

### Pricing & Packaging

Need to determine how we price and package

---

## Fast Follow Projects

These projects will likely be pushed until after GA
