# @mastra/deployer-cloud

A cloud-optimized deployer for Mastra applications with built-in telemetry, logging, and storage integration.

## Features

- **Cloud-Native Integration**: Automatic setup for LibSQL storage and vector databases
- **Advanced Logging**: Built-in PinoLogger with HTTP transport for cloud logging endpoints
- **Telemetry & Monitoring**: OpenTelemetry instrumentation with readiness logging
- **Evaluation Hooks**: Automatic agent evaluation tracking and storage
- **Multi-Logger Support**: Combines cloud logging with existing application loggers
- **Environment-Based Configuration**: Smart configuration based on deployment environment

## Installation

```bash
pnpm add @mastra/deployer-cloud
```

## Usage

The cloud deployer is used as part of the Mastra build process:

```typescript
import { CloudDeployer } from '@mastra/deployer-cloud';

const deployer = new CloudDeployer();

// Bundle your Mastra application
await deployer.bundle(mastraDir, outputDirectory);

// The deployer automatically:
// - Adds cloud dependencies
// - Sets up instrumentation
// - Configures logging and storage
```

## What It Does

### 1. Dependency Management

Automatically adds cloud-specific dependencies to your package.json:

- `@mastra/loggers` - Cloud-optimized logging
- `@mastra/libsql` - Serverless SQL storage
- `@mastra/cloud` - Cloud platform utilities

### 2. Server Entry Generation

Creates a production-ready server entry point with:

- Cloud storage initialization (LibSQL)
- Vector database setup
- Multi-transport logging
- Telemetry and monitoring
- Evaluation hooks for agent metrics

### 3. Instrumentation

Provides OpenTelemetry instrumentation for:

- Distributed tracing
- Performance monitoring
- Custom telemetry configuration

## Environment Variables

The deployer configures your application to use these environment variables:

```bash
# Storage Configuration
MASTRA_STORAGE_URL=your-libsql-url
MASTRA_STORAGE_AUTH_TOKEN=your-auth-token

# Logging Configuration
BUSINESS_API_RUNNER_LOGS_ENDPOINT=your-logs-endpoint
BUSINESS_JWT_TOKEN=your-jwt-token

# Runtime Configuration
RUNNER_START_TIME=deployment-start-time
CI=true|false

# Deployment Metadata
TEAM_ID=your-team-id
PROJECT_ID=your-project-id
BUILD_ID=your-build-id
```

## Generated Server Code

The deployer generates a server entry that:

1. **Initializes Logging**:
   - Sets up PinoLogger with cloud transports
   - Combines with existing application loggers
   - Provides structured JSON logging

2. **Configures Storage**:
   - Initializes LibSQL store when credentials are provided
   - Sets up vector database for semantic search
   - Integrates with Mastra's memory system

3. **Registers Hooks**:
   - `ON_GENERATION` - Tracks agent generation metrics
   - `ON_EVALUATION` - Stores evaluation results

4. **Starts Server**:
   - Creates Node.js server with Mastra configuration
   - Disables playground and Swagger UI for production
   - Exports tools for API access

## Project Structure

After deployment, your project will have:

```
output/
├── instrumentation.mjs    # OpenTelemetry setup
├── package.json          # With cloud dependencies
├── index.mjs            # Main server entry
├── mastra.mjs          # Your Mastra configuration
└── tools/              # Exported tools
```

## Readiness Logging

The deployer includes structured readiness logs for monitoring:

```json
{
  "message": "Server starting|Server started|Runner Initialized",
  "type": "READINESS",
  "startTime": 1234567890,
  "durationMs": 123,
  "metadata": {
    "teamId": "your-team-id",
    "projectId": "your-project-id",
    "buildId": "your-build-id"
  }
}
```

## Testing

The cloud deployer includes comprehensive tests covering:

- Build pipeline functionality
- Server runtime generation
- Dependency management
- Error handling
- Integration scenarios

Run tests with:

```bash
pnpm test
```

## Development

For local development:

```bash
# Build the deployer
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```
