# Competitor Monitor with Jev

Tell the chat which product to monitor, share its public page URLs, and describe what matters to your team. The monitor compares pricing, changelog, and documentation pages with saved history. Jev classifies the changes, and an LLM explains the results with source links and before and after excerpts.

## Why we built this

A page edit doesn't always mean a competitor changed its pricing or product. Navigation updates and promotional copy can distract from useful signals. This monitor keeps the evidence visible, uses Jev to assess each change, and applies a policy to ignore it, record it, request review, or flag an alert. First captures and unchanged pages without pending work need no Jev call.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1790883356/competitor_monitor_jev_hmoipr.mp4"></video>

## Prerequisites

- **[OpenAI API key](https://platform.openai.com/api-keys)**: set `OPENAI_API_KEY` for the Studio chat. The chat uses `openai/gpt-6-luna` to understand requests and explain results. Your account needs access to this model.
- **[TypeSafe AI API key](https://console.typesafe.ai)**: set `TYPESAFE_AI_API_KEY` to classify changes with Jev. Direct TypeSafe access is the default, using `jev-latest`.
- **[Vercel AI Gateway key (alternative)](https://vercel.com/docs/ai-gateway/authentication-and-byok)**: instead of a TypeSafe key, set `JEV_ACCESS_MODE=vercel-gateway` and `AI_GATEWAY_API_KEY`. This route uses `typesafe-ai/jev`; your Gateway account needs access to it. OpenAI chat still uses `OPENAI_API_KEY` directly.
- **[Google Chrome (optional)](https://www.google.com/chrome/)**: install Chrome for the local Stagehand fallback when a page needs browser rendering. Ordinary HTTP collection needs no browser account.

## Quickstart 🚀

1. **Create your project**
   - Run `npx create-mastra@latest competitor-monitor --template competitor-monitor-jev --no-install`.
   - Run `cd competitor-monitor`, then `npm ci`.
2. **Add your API keys**
   - Run `cp .env.example .env` and fill in the values described under Prerequisites.
   - Keep `EXECUTION_MODE=local`. Local databases are created automatically.
3. **Start the dev server**
   - Run `npm run dev`.
   - Open [Mastra Studio](http://localhost:4111), select the **Competitor Monitor** agent (`competitor-monitor-agent`), and send the example below with a real company and its page URLs.
   - The first successful check saves each page as a baseline. It does not report those pages as new changes. You enter the URLs in chat; no manual JSON setup is required.

## Try it out

- **Monitor a product, like the Resend company.** Send this message in Studio, with a real company and operational links for pricing, changelog, and documentation:

  ```plaintext
  Monitor Resend for our product team.
  Pricing: https://resend.com/pricing
  Changelog: https://resend.com/changelog
  Documentation: https://resend.com/docs
  Focus on pricing, plan changes, new features, and deprecations.
  Check these pages now and explain the result.
  ```

- **Check again later.** Send “Check Resend again,” including in a new chat with the same Resource ID. The agent remembers the company's URLs, interests, monitor identity, and latest conversation context. The monitor compares current content with saved captures. Unchanged pages without pending work skip Jev; actual changes include their evidence and routing decision. Each request runs one check.
- **Explain a change.** Ask “Which changes need review, and what changed before and after?” The chat explains the returned evidence and identifies uncertainty or incomplete work.
- **Monitor your own product list.** Send another product name, its public URLs, and your interests. The chat asks for missing information and creates a separate monitor. Reuse the same monitor and source identities for later comparisons; give replacement URLs new source IDs.

## Customization

- Ask your coding agent: “Explore the acquisition, Jev questions, and routing policy. Propose a plan to prioritize pricing and deprecation changes while preserving exact evidence and uncertainty review.”
- Customize all workflow input values, including `interests`, `kind`, `fetchMode`, and `runMode`, in `src/mastra/schemas.ts`. Interest meanings are defined in `INTEREST_DEFINITIONS`; keep the corresponding classifier criteria in `src/mastra/lib/classification.ts` aligned when changing them. Use `contentSelector` and `ignoreSelectors` in workflow inputs to control which page regions are compared.
- Each monitor accepts **3 sites by default**. Set `MAX_SOURCES` to another value from 1 to 20 to change this limit. `SOURCE_CONCURRENCY=3` separately controls how many sites are fetched at once (maximum 5). Use a separate `monitorId` for each competitor so their histories remain independent. Set these environment variables in `.env`; edit `SOURCE_LIMITS` in `src/mastra/config/source-config.ts` to change their defaults. Other operational defaults live in `src/mastra/config/`.

## Configuration and data

- **Structured runs:** the **competitorMonitor** workflow (`competitor-monitor`) remains available in Studio for integrations or direct input. Its JSON input accepts `monitorId`, `profile`, and `sources`; the chat builds this input for you. Without an LLM, you can use this workflow directly, but chat and generated summaries are unavailable. In Studio, use JSON input with numeric policy values: the current generated Form can serialize numeric defaults as strings and fail input validation.
- **Storage:** `.data/mastra.db` holds Mastra state, chat messages, and company working memory; `.data/competitor-monitor.db` holds snapshots, pending changes, and decisions. Override these paths with `MASTRA_DATABASE_URL` and `MONITOR_DATABASE_URL`. Preserve both databases across restarts. The agent loads the latest 20 messages within a thread and retains the last user message, active company, pending setup, and named company configurations across threads through native [resource-scoped working memory](https://mastra.ai/docs/memory/working-memory). In Studio, keep the same **Resource ID** when starting a new chat. API callers must pass a stable `memory.resource` and a `memory.thread` per conversation to `agent.generate()` or `agent.stream()`; changing the resource starts separate company memory. Memory updates use the chat model's native tool calls; no embedding model is required.
- **Production mode:** set `EXECUTION_MODE=production` and a nonblank `MASTRA_API_TOKEN` for native SimpleAuth protection. The static token has no expiry; rotate it by changing the value and restarting. Local mode binds to `127.0.0.1`.

For a production build, run `npm run build`, then `npm start`. The npm postbuild lifecycle preserves the scoped Stagehand security override in the generated installation; keep that lifecycle when adapting build commands.

### Monitoring with Daily Scheduler

The scheduler is disabled by default. To enable daily checks:

1. Run `cp scheduled-monitors-example.json scheduled-monitors.json`. The example contains two competitors. Replace every `.example` URL with a real public page and keep one array entry per competitor, each with a unique `monitorId` and up to 3 `sources` by default.
2. Set `ENABLE_MONITOR_SCHEDULER=true` in `.env`.
3. Start or restart Mastra and keep the process running. Startup validates the local, ignored JSON file and registers one schedule per monitor.

Checks run **daily at 09:00 UTC** (`0 9 * * *`). The first successful check saves a baseline; later checks compare pages and notify enabled providers when classification completes. Change the time or timezone through `SCHEDULE_DEFAULTS` in `src/mastra/config/model-defaults-config.ts`, or register schedules programmatically with `ensureDailyMonitorSchedule` in `src/mastra/lib/schedules.ts`.

Restart Mastra after changing `scheduled-monitors.json` or `.env`. View or pause schedules in Mastra Studio's Schedules area.

### Notification output

The template includes an example `NotificationProvider` in `src/mastra/notifications/markdown-report.ts` that writes dated Markdown reports to `.data/reports/`, with source URLs and exact before/after excerpts. You can customize delivery for any channel, such as email, Slack, Discord, webhooks, or a Mastra Channel, by implementing the contract in `src/mastra/notifications/types.ts` and registering providers in `src/mastra/notifications/index.ts`.

Only scheduled checks create and dispatch notifications; baselines and manual checks stay silent. Failed classification preserves evidence for a later scheduled check, and failed deliveries are retried. Custom providers must deduplicate `eventId` to handle retries safely. Keep `.data/reports/` and both databases on persistent storage.

## Limitations

The monitor collects public English-language pages that allow automated access, without login or CAPTCHA. Redirected document destinations must also permit access through robots.txt.

Browser fallback is intentionally restricted. It permits same-origin scripts and modules served with a validated JavaScript MIME type. A strict CSP and denying proxy block cross-origin resources, network fetch/XHR, frames, workers, images, fonts, forms, and navigation. Sites that depend on those capabilities may fail to render useful content. It does not browse autonomously or perform page actions.

The English-only restriction is due to Jev's current language performance: English is its primary training language and where its accuracy is currently best. Jev can process other languages, but they do not perform equally well, so this template limits monitored pages to English for more reliable change classification. See TypeSafe AI's [Jev language support documentation](https://docs.typesafe.ai/models#language-support).

## About Mastra templates

This is an official [Mastra template](https://mastra.ai/templates) you can run and adapt to your own projects. Official templates are maintained in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and automatically synchronized to standalone repositories.

Want to contribute? See the [template contribution guide](https://github.com/mastra-ai/mastra/blob/main/templates/README.md) for setup and pull request guidance.
