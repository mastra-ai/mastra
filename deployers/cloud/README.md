# @mastra/deployer-cloud

A cloud-optimized deployer for Mastra applications with built-in logging, storage, instrumentation, and server entry-point generation.

## Installation

```bash
npm install @mastra/deployer-cloud
```

## Usage

The cloud deployer is used as part of the Mastra build process:

```typescript
import { CloudDeployer } from '@mastra/deployer-cloud';

const deployer = new CloudDeployer({ studio: false });

await deployer.bundle('./src/mastra', './.mastra/output');
```

## Documentation

`CloudDeployer` creates the server bundle used by Mastra Cloud. It discovers the Mastra entry file and tools, generates a production server entry point, keeps npm dependencies external, writes the deployment package manifest, and installs the resulting dependencies into the output directory.

The generated server combines the application's logger with a cloud `PinoLogger`, sends logs to `BUSINESS_API_RUNNER_LOGS_ENDPOINT` when configured, and emits structured readiness events containing the deployment team, project, and build identifiers. When `MASTRA_STORAGE_URL` and `MASTRA_STORAGE_AUTH_TOKEN` are present, it initializes Mastra Cloud LibSQL storage; otherwise it initializes the storage configured by the application.

Studio is excluded by default. Pass `new CloudDeployer({ studio: true })` to copy and serve the Studio assets with the deployed server. The generated server disables Swagger UI, exposes discovered tools, registers internal trace-scoring support when storage is available, and applies the cloud authentication entry point.

Common runtime variables include:

- `MASTRA_STORAGE_URL` and `MASTRA_STORAGE_AUTH_TOKEN` for managed storage.
- `BUSINESS_API_RUNNER_LOGS_ENDPOINT` and `BUSINESS_JWT_TOKEN` for cloud log transport.
- `RUNNER_START_TIME`, `TEAM_ID`, `PROJECT_ID`, and `BUILD_ID` for readiness and deployment metadata.
- `CI=true` to disable the remote log transport during CI builds.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/cloud/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
