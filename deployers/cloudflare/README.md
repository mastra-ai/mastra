# @mastra/deployer-cloudflare

A Cloudflare Workers deployer for Mastra applications.

## Features

- Deploy Mastra applications to Cloudflare Workers
- Configure custom domains and routes
- Support for worker namespaces
- Automatic environment variable configuration

## Installation

```bash
pnpm add @mastra/deployer-cloudflare
```

## Usage

The Cloudflare deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

const deployer = new CloudflareDeployer({
  scope: 'your-account-id',
  projectName: 'your-project-name',
  routes: [
    {
      pattern: 'example.com/*',
      zone_name: 'example.com',
      custom_domain: true,
    },
  ],
  workerNamespace: 'your-namespace',
  auth: {
    apiToken: 'your-api-token',
    apiEmail: 'your-email',
  },
});

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Configuration

### Constructor Options

- `scope` (required): Your Cloudflare account ID
- `projectName`: Name of your worker project
- `routes`: Array of route configurations for your worker
  - `pattern`: URL pattern to match
  - `zone_name`: Domain zone name
  - `custom_domain`: Whether to use a custom domain
- `workerNamespace`: Namespace for your worker
- `auth`: Cloudflare authentication details
  - `apiToken`: Your Cloudflare API token
  - `apiEmail`: Your Cloudflare account email

## Environment Variables

The deployer will automatically load environment variables from:

- `.env` files in your project
- Environment variables passed through the Mastra configuration

## Routes

Routes can be configured to direct traffic to your worker based on URL patterns and domains:

```typescript
const routes = [
  {
    pattern: 'api.example.com/*',
    zone_name: 'example.com',
    custom_domain: true,
  },
  {
    pattern: 'example.com/api/*',
    zone_name: 'example.com',
  },
];
```

Each route requires:

- `pattern`: URL pattern to match
- `zone_name`: Domain zone name
- `custom_domain`: (optional) Set to true to use a custom domain

## Requirements

- Cloudflare account with Workers enabled
- API token with appropriate permissions
- Domain(s) configured in Cloudflare (for custom domains)
