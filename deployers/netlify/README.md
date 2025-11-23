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
import { Mastra } from '@mastra/core/mastra';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

const deployer = new NetlifyDeployer();

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Configuration

### Constructor Options

The NetlifyDeployer accepts an optional configuration object:

```typescript
const deployer = new NetlifyDeployer({
  build: {
    command: 'npm run build',
    publish: '.netlify/v1/functions',
    environment: {
      NODE_VERSION: '20',
      NPM_FLAGS: '--legacy-peer-deps',
    },
  },
});
```

#### Build Configuration

- `build.command` (optional): Build command to execute during deployment. Defaults to `"npm run build"`.
- `build.publish` (optional): Directory to publish. Defaults to `".netlify/v1/functions"`.
- `build.environment` (optional): Environment variables to set during the build process. These are added to the `[build.environment]` section in netlify.toml.

#### Examples

Using a different package manager:

```typescript
const deployer = new NetlifyDeployer({
  build: {
    command: 'pnpm run build',
  },
});
```

Using Bun:

```typescript
const deployer = new NetlifyDeployer({
  build: {
    command: 'bun run build',
  },
});
```

With custom build environment:

```typescript
const deployer = new NetlifyDeployer({
  build: {
    command: 'npm run build',
    environment: {
      NODE_VERSION: '20.11.0',
      NODE_ENV: 'production',
      ENABLE_EXPERIMENTAL_FEATURES: 'true',
    },
  },
});
```

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

The deployer automatically creates a `netlify.toml` file with configuration based on your settings. If a `netlify.toml` file already exists, it will be preserved.

Default configuration:

```toml
[build]
  command = "npm run build"
  publish = ".netlify/v1/functions"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
```

With custom build environment variables:

```toml
[build]
  command = "npm run build"
  publish = ".netlify/v1/functions"

[build.environment]
  NODE_VERSION = "20.11.0"
  NODE_ENV = "production"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
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
