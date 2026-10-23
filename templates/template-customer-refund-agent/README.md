# Customer Support and Refund Agent

Turn customer support messages into answers grounded in your internal policies or refund proposals for human review. The agent checks purchase records, finds relevant policies, and prepares a response or proposed action with supporting evidence. Try the included customer chat and support dashboard, or connect an Intercom development workspace and Stripe sandbox to work with conversations, purchases, and billing through those services.

## Why we built this

Support teams handle multiple chats at once, check different purchase and refund policies, and move between applications such as Intercom, Stripe, and internal tools to understand each request. Gathering the right context takes time and makes consistent answers harder to deliver.

We built this template to bring that work into one flow: turn customer messages into answers guided by internal policies, or automatically prepare refund proposals with the evidence a person needs to review and approve them.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1789568523/refund_template_overview_v5wu5y.mp4"></video>

The included customer chat and support dashboard are example frontends. You can connect the backend to your own React, Next.js, or Vue application through the template's authenticated support API, keeping case review and human approval in your interface.

For Mastra agent and workflow integrations, see the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). You can also build an agentic interface with [AI SDK UI](https://mastra.ai/integrations/agentic-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/integrations/agentic-ui/copilotkit), or [Assistant UI](https://mastra.ai/integrations/agentic-ui/assistant-ui), adapting the integration to this template's authentication and approval flow. Refund decisions go through the authenticated support routes.

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for response generation and policy embeddings. API usage is billed to your OpenAI account.
- Keep `APP_MODE=local` from `.env.example` for the included demo. No Intercom or Stripe account is required; the launcher prepares the local databases, sample data, and signing keys.
- To connect an Intercom development workspace and Stripe sandbox, follow the [provider guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/external-adapters.md). Additional settings are described in [environment variables](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/env-variables.md).

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest template-customer-refund-agent --template customer-support-and-refund-agent`.
   - Run `cd template-customer-refund-agent`, then `npm install`.
2. **Add your API key**
   - Run `cp .env.example .env` and fill in the key described under Prerequisites.
3. **Start the dev server**
   - Run `npm run demo:local` to start the customer chat, support dashboard, and Mastra Studio together.
   - Open the [customer demo](http://127.0.0.1:3000), sign in as Alex with `alex@example.com` / `local-customer-alex`, and ask: “I bought API Credits for USD 5 on order DEMO-API-CREDITS-001 five days ago. I have no subscription. Can I get a refund?”
   - Open the [support dashboard](http://127.0.0.1:5173) as `approver@local.test` / `local-approver` to inspect the case. The workflow checks the order and policy, then prepares an eligible refund for human review before execution.

Each run resets the local demo data. See Try it out for the approval flow and more examples.

## Try it out

- Review the proposed refund and its supporting evidence in the support dashboard, then approve or reject it. Approval resumes execution against the local sample data; rejection leaves the refund unissued.
- Ask the customer chat, “What is your refund policy?” and check how the answer uses the included policy documents.
- Open [Mastra Studio](http://127.0.0.1:4111) and inspect the workflow execution from your request, including its steps and approval pause. Submit refund decisions through the support dashboard.

See the [local demo guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/local-demo.md) for accounts and configuration details.

## Making it yours

- Open the project in your coding agent and describe a change, such as: “Connect the customer chat and refund review flow to our Next.js app. Explore the existing API and propose a plan that preserves authentication and human approval before making changes.”
- Adapt the policies to your business or use published Intercom Articles with [the policy guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/policies-and-actions.md). Connect your development Intercom and Stripe environments using the [provider guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/docs/external-adapters.md).

## About Mastra templates

View the official [Customer Support and Refund Agent template](https://mastra.ai/templates/customer-support-and-refund-agent) in the Mastra catalog.

Mastra templates are ready-to-use projects that show what you can build with Mastra. Create a project with one, try it in Studio, and adapt it to your use case.

Want to contribute? Read the [contribution guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-customer-refund-agent/CONTRIBUTING.md).
