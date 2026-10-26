# Mastra Factory (self-hosted)

Mastra Factory is an open source environment for building software with coding agents. Connect your repository to turn issues into plans, implementations, and reviewed pull requests.

This template runs the Factory Server entirely on infrastructure you operate, with no Mastra platform services. Keep it separate from the repository you want agents to change.

Read the [documentation](https://factory.mastra.ai/) or [watch the Mastra Factory overview](https://youtu.be/iMA-Xkhj7fU).

## What it uses

`src/mastra/index.ts` wires each service explicitly:

| Service     | Provider                                   | Configured by                       |
| ----------- | ------------------------------------------ | ----------------------------------- |
| Storage     | PostgreSQL with pgvector                   | `DATABASE_URL`                      |
| Auth        | [WorkOS](https://workos.com)               | `WORKOS_*`                          |
| Source code | Your own GitHub App                        | `GITHUB_APP_*`                      |
| Sandboxes   | Local — agent commands run on this machine | —                                   |
| Secrets     | AES encryption of stored credentials       | `FACTORY_CREDENTIAL_ENCRYPTION_KEY` |

To change a service, replace its instance in `src/mastra/index.ts`. See [Configure your Factory](#configure-your-factory).

## Start the Factory Server

1. Copy `.env.example` to `.env`.
1. Generate a credential encryption key and save it as `FACTORY_CREDENTIAL_ENCRYPTION_KEY`. Preserve it across restarts and deployments, and keep a protected backup.

   ```bash
   openssl rand -base64 32
   ```

1. Start the local PostgreSQL service and set `DATABASE_URL=postgres://factory:factory@localhost:54330/factory`:

   ```bash
   npm run db:up
   ```

1. Create a [WorkOS](https://dashboard.workos.com) application. Set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and a 32+ character `WORKOS_COOKIE_PASSWORD`. Add `http://localhost:4111/auth/callback` as a redirect URI.
1. [Create a GitHub App](https://factory.mastra.ai/configure/github) and fill in the `GITHUB_APP_*` variables.
1. Install Git and your repository's build tools on this machine, then start the server:

   ```bash
   npm run dev
   ```

Open the local URL printed by the server and sign in. The onboarding wizard asks you to select the repository agents should change and connect a model provider.

## Run your first issue

1. Open **Settings → Work Intake → GitHub issues**. Enable **Sync GitHub issues** and select your repository.
1. Create a small GitHub issue, such as adding contribution guidance to the repository's README.
1. Find the issue in **Work → Intake**, select **Investigate**, and open its session to follow the agent's work.

Continue with the [issue-to-pull-request walkthrough](https://factory.mastra.ai/#create-your-first-pull-request).

## Configure your Factory

| Configuration                                              | What you can change                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Models](https://factory.mastra.ai/configure/models)       | Provider access, personal or organization credentials, and default model. |
| [GitHub](https://factory.mastra.ai/configure/github)       | Repository access and personal issue intake.                              |
| [Linear](https://factory.mastra.ai/configure/linear)       | Add a `LinearIntegration` to `integrations`.                              |
| [Jira](https://factory.mastra.ai/configure/jira)           | Add a `JiraIntegration` to `integrations`.                                |
| [Slack](https://factory.mastra.ai/configure/slack)         | Add a `SlackIntegration` to `integrations`.                               |
| [Auth](https://factory.mastra.ai/configure/auth)           | Replace `MastraAuthWorkos` with another auth provider.                    |
| [Storage](https://factory.mastra.ai/configure/storage)     | Replace `PgFactoryStorage` with another Factory storage adapter.          |
| [Sandboxes](https://factory.mastra.ai/configure/sandboxes) | Replace `LocalFactorySandbox`, for example with `E2BFactorySandbox`.      |

## Deploy

Run Factory as a persistent Node.js service on a virtual machine or in a container. Set `MASTRACODE_PUBLIC_URL` to the public HTTPS origin, update your WorkOS and GitHub App callback URLs to match, and supply the `.env` values through the deployment environment. Then build and start the server:

```bash
npm run build
npm run start
```

See [self-hosting](https://factory.mastra.ai/deployment#self-host) for runtime requirements.

## Scripts

| Script                              | What it does                                         |
| ----------------------------------- | ---------------------------------------------------- |
| `npm run dev`                       | Start the local Factory Server with its UI and API.  |
| `npm run build`                     | Build the server and Factory UI in `.mastra/output`. |
| `npm run start`                     | Run the production build.                            |
| `npm run db:up` / `npm run db:down` | Start or stop the local PostgreSQL service.          |

## Troubleshooting

- **Runtime:** Use a Node.js version that matches `engines.node` in this project's `package.json`.
- **Port changes:** Set `PORT` and update `MASTRACODE_PUBLIC_URL` to match. Update your WorkOS and GitHub App callback URLs.
- **Missing issues:** Check repository access and your **Work Intake** selections. See [intake troubleshooting](https://factory.mastra.ai/troubleshooting#intake-is-empty).

See [Troubleshooting](https://factory.mastra.ai/troubleshooting) or [Environment variables](https://factory.mastra.ai/reference/configuration).

## License

Apache-2.0
