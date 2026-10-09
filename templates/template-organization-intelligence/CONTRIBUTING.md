# Contributing

This repository is auto-generated from the [Mastra monorepo](https://github.com/mastra-ai/mastra). Pull requests opened here will be ignored.

To contribute:

1. Fork or clone the [Mastra monorepo](https://github.com/mastra-ai/mastra).
2. Find this template in [`templates/template-organization-intelligence`](https://github.com/mastra-ai/mastra/tree/main/templates/template-organization-intelligence).
3. Make your changes and run the checks below.
4. Open a pull request against the monorepo.

A bot syncs accepted changes to this repository.

## Local setup

1. From the monorepo root, run `cd templates/template-organization-intelligence`.
2. Run `npm install` to install dependencies and generate a local lockfile. Use `npm ci` for subsequent clean installs with that lockfile.
3. To run the application, copy `.env.example` to `.env`, add your OpenAI API key, and run `npm run dev`. The default catalog uses the bundled local documents.

Official templates use `latest` for Mastra dependencies and do not commit lockfiles, following the [template contribution policy](https://github.com/mastra-ai/mastra/blob/main/templates/README.md). Keep the generated lockfile locally to reproduce your installed versions. `npm run dev:local` installs with `npm install` on the first run and `npm ci` when a local lockfile exists, then starts the application.

## Making changes

- Keep Mastra components under `src/mastra`, grouped by responsibility.
- Keep test data in `fixtures` folders and test helpers alongside the tests that use them.
- Add or update tests when changing behavior, and update documentation when setup or usage changes.
- Keep credentials, private documents, and generated `.mastra` data out of commits.

## Before opening a pull request

Run `npm run check` from the project directory. It checks formatting, linting, types, deterministic tests, and the build. These checks do not require live provider calls. Use `npm run format` to fix formatting when needed.

Describe the problem, what changed, and how you verified it. Mention any provider behavior you could not test and follow the [monorepo contribution guidelines](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md) applicable to your contribution. Approval is handled by another Mastra member after CI validation.

## Conversational retrieval evaluation

After changing contextualization prompts or models, run `npm run eval:conversations -- --allow-live` with `OPENAI_API_KEY` configured. It makes at most seven model calls against synthetic conversations, without reading company documents or changing application state. The JSON report checks references, topic changes, corrections, ambiguity, and instructions embedded in history. These checks are a smoke evaluation, not a semantic guarantee. The command exits nonzero on a failed case.
