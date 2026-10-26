# Contributing

This repository is auto-generated from the [Mastra monorepo](https://github.com/mastra-ai/mastra). Pull requests opened in the synchronized standalone repository will be ignored.

To contribute:

1. Fork or clone the [Mastra monorepo](https://github.com/mastra-ai/mastra).
2. Find this template in [templates/template-accounts-payable-invoice-processing](https://github.com/mastra-ai/mastra/tree/main/templates/template-accounts-payable-invoice-processing).
3. Make your changes and run the checks below.
4. Open a pull request against the monorepo.

A bot syncs accepted changes to the standalone repository.

## Local setup

From the monorepo root, run `cd templates/template-accounts-payable-invoice-processing`, then `npm install`. Keep the generated `package-lock.json` locally and use `npm ci` for subsequent reproducible installations. Official templates declare Mastra dependencies as `latest`; the local lockfile records the actual resolution. Dependencies, caches, credentials, databases, fixtures generated for live checks, and raw evidence stay inside this template's ignored directories.

Copy `.env.example` to `.env` for development and follow the [README](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/README.md) to prepare OpenAI and the external QuickBooks MCP server. The deterministic local suite requires neither real credentials nor a running external MCP.

## Making changes

- Preserve the provider interface, deterministic controls, and explicit approval boundary.
- Use `node:test` and real Mastra workflows with LibSQL persistence. Simulate external systems at their transport boundary; do not replace the workflow or storage under test.
- Reproduce bugs before fixing them and verify that each regression fails without its fix.
- Keep credentials and generated data out of commits. Put the external MCP in `.local/quickbooks-online-mcp-server` without changing its source.

## Checks

Run `npm run check` for formatting, lint, types, deterministic local tests, and build. Run `npm run format` to fix formatting. Individual commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

The live QuickBooks sandbox suite runs separately with `npm run test:integration`. It must fail clearly when configuration is absent. Use a dedicated sandbox company, explicit write opt-in, unique invoice numbers, and an isolated database and posting lock directory. Record created IDs without deleting preexisting records. Inspect every created Bill's vendor, number, currency, amounts, accounts, and PO linkage. Test read-only mode, screening without bypass, approval, rejection, replay after restart, tax, and missing tax-account configuration.

Verify the README in Studio using PDF, PNG, and JPEG invoices with OpenAI, including approval and rejection by `runId`. Repeat connection and processing checks in `npm start` after a build. Update the [verification record](https://github.com/mastra-ai/mastra/blob/main/templates/template-accounts-payable-invoice-processing/VERIFICATION.md) with commands, versions, results, and outstanding blockers. Do not describe configuration failures or unexecuted tests as passes.

Before opening a pull request, describe the problem, changes, and checks; follow the [monorepo contribution guidelines](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md). Approval is handled by another Mastra member after CI validation.
