# @mastra/deployer-netlify

A Netlify deployer for Mastra applications.

## Features

- Deploy Mastra applications to Netlify Functions
- Generates Netlify Frameworks API configuration during build
- Bundles functions with optimized settings for serverless environments
- Routes all requests through a single API endpoint

## Installation

```bash
npm install @mastra/deployer-netlify
```

## Usage

The Netlify deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

const mastra = new Mastra({
  deployer: new NetlifyDeployer(),
});
```

## Project Structure

The deployer automatically creates the following structure:

```bash
your-project/
└── .netlify/
    └── v1/
        ├── config.json
        └── functions/
            └── api/
                ├── index.js
                ├── package.json
                └── node_modules/
```

### Netlify Frameworks API Configuration

The deployer uses Netlify's [Frameworks API](https://docs.netlify.com/build/frameworks/frameworks-api/) and generates a `.netlify/v1/config.json` file to configure functions and routing for Netlify.

Generated configuration:

```json
{
  "functions": {
    "directory": ".netlify/v1/functions",
    "node_bundler": "none",
    "included_files": [".netlify/v1/functions/**"]
  },
  "redirects": [
    {
      "force": true,
      "from": "/*",
      "to": "/.netlify/functions/api/:splat",
      "status": 200
    }
  ]
}
```

This configuration:

- Tells Netlify where to find your functions
- Disables Netlify's bundling (Mastra pre-bundles for optimization)
- Routes all requests to your Mastra API function

## How It Works

The Netlify deployer:

1. **Bundles your Mastra application** into optimized serverless functions
2. **Creates the Frameworks API configuration** automatically
3. **Handles all routing** through a single API endpoint
4. **Pre-optimizes dependencies** for serverless environments

## Environment Variables

Environment variables are handled through:

- `.env` files in your project
- Netlify's environment variable dashboard
- Runtime environment variable access in your Mastra app

## Deployment

Deploy your Mastra application to Netlify by:

1. **Building locally**: Run your build command (the deployer handles bundling)
2. **Using Netlify CLI**: `netlify deploy --prod`
3. **Via Git integration**: Connect your repository to Netlify for automatic deployments

The deployer automatically configures everything needed for Netlify Functions.
