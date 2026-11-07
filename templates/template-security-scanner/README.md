# Security Scanner

Evaluate the security of authorized websites and APIs from a target URL. This Mastra template combines endpoint discovery, vulnerability investigation, controlled verification, and independent evidence review. A local console lets you configure targets and identities, run assessments, and inspect findings.

## Why we built this

Determining whether a vulnerability affects an application requires context: its endpoints, access rules, user identities, and reproducible evidence. This template provides a starting point for building security assessment tools with Mastra agents and workflows, while keeping authorization, request limits, and finding confirmation under application control.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1793917666/Security_Scanner_crbizq.mp4"></video>

## Prerequisites

- **[Docker Desktop](https://docs.docker.com/desktop/)**: a native Linux ARM64 daemon and the Docker CLI for the sandboxed crawler and local demo. Set `DOCKER_SOCKET` if your socket differs from `/var/run/docker.sock`.
- **[Morph API key](https://www.morphllm.com/dashboard/api-keys)**: set `MORPH_API_KEY` with access to the configured `EXPLORER_MODEL` and `JUDGE_MODEL`. The BOLA demo uses paid model calls; setup and ordinary discovery do not require a key.
- Set `CONTROL_BOOTSTRAP_SECRET` for console sign-in and `SCANNER_ENCRYPTION_KEY` for stored credentials. Generate independent values using the [configuration guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/configuration.md#local-access).
- Enable the demo with `SCANNER_DISCOVERY_ENABLED=true` and `SCANNER_INVESTIGATION_ENABLED=true`. Assess only authorized targets; non-lab targets also require an explicit evidence-retention policy.

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest security-scanner --template security-scanner` to scaffold the project.
   - Run `cd security-scanner`. If dependency installation was skipped, run `npm install --workspaces=false`.
2. **Add your API key and settings**
   - Run `cp .env.example .env` and fill in the values described under Prerequisites.
3. **Prepare the runtime**
   - Run `npm run setup` to build the local runtime and check the browser sandbox.
4. **Start the example API**
   - Run `npm run example-target` and leave it running. It prints the demo URLs and two users' API keys; keep the keys private.
5. **Start the dev server**
   - In another terminal, run `npm run dev` and open [the local console](http://127.0.0.1:4111/).
   - Sign in with `CONTROL_BOOTSTRAP_SECRET`, then follow the BOLA demo below to assess the example API.

## Try it out

Test broken object-level authorization (BOLA): whether one user can read another user's private order.

- **Register the target:** create a GET/HEAD policy and a REST API target using `/api/orders` appended to the printed `scannerUrl` and the printed `openApiUrl`. Mark orders as owner-only and products as public. Add both API-key profiles and check their identities using the [console walkthrough](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/bola-assessment.md).
- **Run the assessment:** choose **Start REST assessment**. Inspect the cross-user comparison in **Scans** and any confirmed BOLA result in **Findings**.
- **Compare protected behavior:** stop both processes, start `npm run example-target -- --mode=protected`, then restart `npm run dev`. Register the target using the new printed URLs and the same users, check both identities, and run another assessment. The cross-user read returns 403 and creates no new finding; the earlier result remains in history.

## Customization

- Open the project in your coding agent: “Add a security check that compares administrator and regular-user access to restricted API routes, with vulnerable and protected test cases. Explore the code and propose a plan before making changes.” Use the [vulnerability category](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/customization.md#route-rules-categories-and-checkers) and [checker](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/contracts/checkers.md) contracts to define its evidence and execution requirements.
- Adapt the [playbooks](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/src/knowledge/playbooks.ts) and [agent instructions](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/src/mastra/agents/investigation-agents.ts) to your application's security policies. Keep checks within the target's approved scope and require verification evidence before confirming findings.

The [customization guide](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/customization.md) maps drivers, authentication, models, and console changes to their source files.

## Testing and maintenance

See [testing](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/testing.md) for local checks, [configuration](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/configuration.md) for runtime settings, and [operations](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/operations.md) for backup, restore, and cleanup.

## Sync advisories demo

With the scanner running, run `npm run sync:advisories` in another terminal, then open **Vulnerabilities** to review imported cve.now advisories and their triage status. This contacts the feed and can make paid model calls when investigation is enabled. Advisories require further verification before becoming application findings.

If the feed fails or returns inconsistent data, the cycle reports `SKIPPED`. Retry after the displayed backoff. See [advisory configuration](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/docs/configuration.md#advisories) for optional scheduled sync.

## About Mastra templates

This is an official [Mastra template](https://mastra.ai/templates). Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-security-scanner/CONTRIBUTING.md)
