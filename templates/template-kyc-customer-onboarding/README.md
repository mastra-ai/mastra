# Mastra KYC and Customer Onboarding

Turn a KYC application into an auditable, review-ready decision flow with durable execution, typed provider boundaries, parallel checks, and human approval built in.

This Mastra template accepts identity documents, extracts structured fields, runs identity, address, sanctions, and PEP checks in parallel, evaluates deterministic risk, and pauses for authorized compliance review. Approved cases continue through idempotent account provisioning, while every outcome keeps a traceable evidence and decision history.

## Why we built this

Customer onboarding crosses document processing, external providers, policy rules, long-running work, and high-consequence human decisions. This template shows how to coordinate those concerns as one explicit workflow without hiding authority, retry, or privacy boundaries inside an LLM prompt.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1788989600/kyc_3min_overview_f9fybd.mp4"></video>

Use Mastra Studio, call the API, or open the included test portal to try three paths: a standard application, an application that pauses for missing information, and a sanctions candidate that requires explicit human review.

Mastra Studio, the API, and the portal are equal entry points to the same durable workflow.

You can connect this workflow to React, Next.js, or Vue applications with the [Mastra Client SDK](https://mastra.ai/reference/client-js/mastra-client), or use agentic UI libraries such as AI SDK UI, CopilotKit, and Assistant UI.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the default agent. The bundled document extraction and screening providers use local synthetic fixtures.
- Optional integrations and runtime requirements are described in [Configuration](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/configuration.md).

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template kyc-customer-onboarding` and name the project `kyc-customer-onboarding` when prompted.
2. **Add your API key**
   - Run `cd kyc-customer-onboarding && cp .env.example .env` and fill in the key described under Prerequisites.
3. **Start the complete development environment**
   - Run `npm run dev` to start the portal, API, and Mastra Studio together.
   - Open the portal at [http://127.0.0.1:5173](http://127.0.0.1:5173), Mastra Studio at [http://127.0.0.1:4112](http://127.0.0.1:4112), or the API documentation at [http://127.0.0.1:4111/openapi.json](http://127.0.0.1:4111/openapi.json).

Select **KYC Onboarding Agent** and ask it to start the low-risk onboarding scenario. The workflow completes intake, extraction, four parallel checks, evidence aggregation, and deterministic risk assessment before pausing for compliance review.

## Try it out

- In Studio, ask the agent to start `missing-information-v1`, inspect the pending request, and submit the requested bundled information. The workflow resumes from its saved state.
- Start `sanctions-strong-v1` and inspect the evidence and pending review. A screening candidate requires an explicit human decision.
- Use the [sample inputs](https://github.com/mastra-ai/mastra/tree/main/templates/template-kyc-customer-onboarding/inputs-sample) in the portal to follow a case through intake, checks, and review. The API and portal share case storage; Studio uses separate local storage by default. See [Use the API and portal](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/use-api.md).
- Run `npm run eval:baseline` to evaluate the bundled deterministic scenarios without external provider calls.

## Making it yours

- Ask your coding agent: "Explore the provider contracts and propose a plan to replace the local identity verifier with our provider. Preserve typed errors, replay behavior, and human review before making changes."
- Adapt the [policy and jurisdiction](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/customize-policy.md), add a [synthetic scenario](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/add-scenario.md), and implement the required integrations for your company's workflow.

Customization guides:

- [Configuration and optional integrations](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/configuration.md)
- [Customize providers](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/customize-providers.md)
- [Customize policy and jurisdiction](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/customize-policy.md)
- [Add a scenario](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/add-scenario.md)
- [Use the API and portal](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/docs/use-api.md)

As a template, you need to adapt it to your company's production workflow and implement the required integrations.

## How it works

The agent starts `durable-kyc-onboarding-v1`, which composes the intake workflow with policy completeness, risk assessment, human review, and provisioning. Mastra runs independent verification and screening steps in parallel, persists workflow state before a suspension, and resumes only from a schema-validated command bound to the original case and run.

Provider registries keep implementation selection outside the workflow graph. Local adapters make the example repeatable, while optional OpenAI document extraction, OpenSanctions screening, structured risk narratives, and signed webhooks demonstrate production integration points. Redacted tracing and deterministic evals provide feedback without giving the model authority over compliance decisions.

## Verify changes

Install the browser used by the portal tests once with `npx playwright install chromium`, then run:

```bash
npm test
npm run typecheck
npm run eval:baseline
npm run test:first-run
npm run build
```

The first-run check uses a deterministic agent fixture; it does not exercise the external OpenAI service or the Studio UI. See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/CONTRIBUTING.md) for contributor setup and review requirements.

## About Mastra templates

View the official [KYC and Customer Onboarding template](https://mastra.ai/templates/kyc-customer-onboarding) in the Mastra catalog.

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build - clone one, explore it, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-kyc-customer-onboarding/CONTRIBUTING.md).

This is a synthetic reference implementation, not a certified KYC product, legal advice or a substitute for your compliance program. A screening candidate is never treated as a confirmed identity match, and the workflow does not invent final compliance decisions.
