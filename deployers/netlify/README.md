# @mastra/deployer-netlify

A Netlify deployer for Mastra applications.

## Features

- Deploy Mastra applications to Netlify Functions
- Automatic site creation and configuration
- Serverless function support with Edge Functions
- Zero-configuration deployments

## Installation

```bash
pnpm add @mastra/deployer-netlify
```

## Usage

The Netlify deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

const deployer = new NetlifyDeployer({
  scope: 'your-team-id',
  projectName: 'your-project-name',
  token: 'your-netlify-token',
});

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Configuration

### Constructor Options

- `scope` (required): Your Netlify team slug or ID
- `projectName`: Name of your Netlify site (will be created if it doesn't exist)
- `token`: Your Netlify authentication token

## Project Structure

The deployer automatically creates the following structure:

```
your-project/
├── netlify/
│   └── functions/
│       └── api/
└── netlify.toml
```

### netlify.toml Configuration

The deployer creates a `netlify.toml` with the following defaults:

```toml
[functions]
node_bundler = "esbuild"
directory = "/netlify/functions"

[[redirects]]
force = true
from = "/*"
status = 200
to = "/.netlify/functions/api/:splat"
```

## Environment Variables

Environment variables are handled automatically through:

- `.env` files in your project
- Environment variables passed through the Mastra configuration
- Netlify's environment variable UI

## Deployment Process

The deployer will:

1. Create a new site if it doesn't exist
2. Configure the site with your environment variables
3. Deploy your application to Netlify Functions
