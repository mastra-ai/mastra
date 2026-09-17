# Security incident triage and response

Give your team the context to act on a security alert. This Mastra template gathers evidence, checks the relevant runbook, and prepares an incident summary and response plan for review. It handles unexpected privilege changes, logins from disallowed countries, and unfamiliar devices. Containment waits for approval.

## Why we built this

An alert tells you something happened. Deciding what to do takes more work: checking the account, finding the right procedure, and making sure the response targets the right session or device.

We built this template to bring that context into one review. Your team can inspect the evidence and proposed actions before approving a response. Start with the sample alerts, then connect the services you use.

The workflow combines Mastra agents and tools, parallel evidence collection, retrieval from runbooks, durable workflow suspension and resumption, and observability.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1788989359/security_triage_overview_tddjro.mp4"></video>

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` to run the sample workflows in Studio with the default `openai/gpt-4o-mini` model.
- Keep the local settings in `.env.example`. The sample workflows need no WorkOS, IPinfo, or Linear account and no approval secrets.
- The first start downloads an embedding model and indexes the included runbooks, so allow extra time and network access for it to finish.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest template-security-incident-triage --template security-incident-triage-and-response`.
   - Run `cd template-security-incident-triage`, then `npm install`.
2. **Add your API keys**
   - Run `cp .env.example .env` and fill in the value described under Prerequisites.
3. **Start the dev server**
   - Run `npm run dev`.
   - Open [Mastra Studio](http://localhost:4111), select **Workflows → securityIncidentWorkflow**, and paste [the sample alert for an unfamiliar device](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/scripts/fixtures/studio/01-new-device.json) into the input. Inspect the incident summary and plan when the run pauses at `await-approval`.

## Try it out

- In the suspended step's Resume input, paste [resolve.json](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/scripts/fixtures/studio/resolve.json) to approve the local plan, then inspect the verified containment result.
- Start a new run with the same alert and paste [reject.json](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/scripts/fixtures/studio/reject.json) at approval. The run finishes without containment.
- Compare [a login from the US](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/scripts/fixtures/studio/02-country-us.json) with [a login from Brazil](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/scripts/fixtures/studio/03-country-br.json). The sample US policy closes the first as benign; the second prepares a response and waits for approval.
- Try [an unexpected privilege change](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/scripts/fixtures/studio/04-privilege-change.json) and review the proposed role restoration before approving it.

Approval in this demo affects only local sample data. Start a new run to try an alert again. The [Studio walkthrough](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/docs/how-to-test-studio.md) covers each scenario. Real containment requires authenticated approval.

## Making it yours

- Open the project in your coding agent and describe a change, such as: “Adapt the allowed-country policy and its runbook to our team's procedures. Explore the code and propose a plan before making changes.” See [runbooks and policy rules](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/docs/runbooks.md) for edits that require corresponding policy changes.
- Connect your identity provider, incident tracker, and evidence sources. Start with the included WorkOS, IPinfo, and Linear adapters, or replace them with your own. See [provider setup](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/docs/provider-setup.md) for the required configuration and evidence.

## Try the complete flow without credentials

After installing dependencies, run `npm run demo:local -- --output /tmp/security-local-demo` without an API key or a running dev server.

Use a new output directory each time. The demo runs all three alert scenarios, simulates an authorized approval, verifies local containment, and writes `demo-report.json` to that directory. It uses deterministic model substitutes and synthetic data. See the [local demo guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/docs/local-demo.md) to inspect the results.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build with Mastra. Clone one, try it in Studio, and adapt it to your use case. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

This template was contributed by Diego and is already [published on the Mastra website](https://mastra.ai/templates/security-incident-triage-and-response).

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/CONTRIBUTING.md) Contributions are welcome under the [Apache-2.0 license](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-incident-triage/LICENSE).
