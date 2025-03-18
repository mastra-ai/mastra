# @mastra/deployer-vercel

A Vercel deployer for Mastra applications.

## Features

- Deploy Mastra applications to Vercel
- Zero-configuration serverless deployments
- Automatic environment variable synchronization
- Support for production, preview, and development environments
- Instant global deployments with Edge Functions

## Installation

```bash
pnpm add @mastra/deployer-vercel
```

## Usage

The Vercel deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core';
import { VercelDeployer } from '@mastra/deployer-vercel';

const deployer = new VercelDeployer({
  teamId: 'your-team-id',
  projectName: 'your-project-name',
  token: 'your-vercel-token',
});

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Configuration

### Constructor Options

- `teamId` (required): Your Vercel team ID or username
- `projectName`: Name of your Vercel project (will be created if it doesn't exist)
- `token`: Your Vercel API token (required for authentication)

## Project Structure

The deployer creates:

```
your-project/
├── vercel.json     # Deployment configuration
└── index.mjs       # Application entry point
```

### vercel.json Configuration

Default configuration:

```json
{
  "version": 2,
  "installCommand": "npm install --omit=dev",
  "builds": [
    {
      "src": "index.mjs",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.mjs"
    }
  ]
}
```

## Environment Variables

Environment variables are handled automatically through:

- `.env` files in your project
- Environment variables passed through the Mastra configuration
- Vercel's environment variable UI

## Deployment Process

The deployer:

1. Configures your project with the necessary files
2. Deploys to Vercel using the CLI
3. Synchronizes environment variables for future deployments
