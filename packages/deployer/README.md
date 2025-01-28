# @mastra/deployer

Core deployment infrastructure for Mastra applications, handling build, packaging, and deployment processes.

## Installation

```bash
npm install @mastra/deployer
```

## Overview

The `@mastra/deployer` package provides the foundational deployment infrastructure for Mastra applications. It handles:

- Project building and bundling
- Dependency management
- Environment configuration
- Development and production deployments

## Usage

```typescript
import { Deployer } from '@mastra/deployer';

// Create a deployer instance
const deployer = new Deployer({
  dir: '/path/to/project',
  type: 'Deploy', // or 'Dev' for development mode
});

// Install dependencies
await deployer.install();

// Write package.json
await deployer.writePackageJson();

// Get Mastra instance
const { mastra } = await deployer.getMastra();
```

## Configuration

### Required Parameters

- `dir`: Project directory path
- `type`: Deployment type ('Deploy' or 'Dev')

## Features

### Project Structure Management

- Creates and manages `.mastra` directory
- Handles package.json generation and updates
- Manages project dependencies

### Dependency Management

- Automatic dependency installation
- Workspace dependency resolution
- Version management for @mastra packages

### Environment Handling

- Support for multiple environment files:
  - `.env`
  - `.env.development`
  - `.env.local`
- Environment variable validation and processing

### Build Process

- Project bundling
- Asset management
- Source code transformation

### Development Support

- Development server configuration
- Hot reloading capabilities
- Debug logging

## Project Structure

The deployer creates and manages the following structure:

```
your-project/
├── .mastra/
│   ├── package.json
│   ├── mastra.mjs
│   └── index.mjs
├── .env
├── .env.development
├── .env.local
└── package.json
```

## Package.json Management

The deployer automatically manages dependencies in the `.mastra/package.json`:

```json
{
  "name": "server",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@mastra/loggers": "latest",
    "hono": "4.6.17",
    "@hono/node-server": "^1.13.7",
    "superjson": "^2.2.2",
    "zod-to-json-schema": "^3.24.1"
  }
}
```

## Methods

### `install()`

Installs and updates project dependencies.

### `writePackageJson()`

Generates or updates the package.json in the .mastra directory.

### `getMastra()`

Returns the Mastra instance for the project.

### `getMastraPath()`

Returns the path to the .mastra directory.

## Error Handling

The deployer includes comprehensive error handling for:

- Dependency installation failures
- File system operations
- Environment configuration issues
- Build process errors

## Logging

Built-in logging support through @mastra/core:

- Debug information
- Installation progress
- Build status
- Error reporting

## Related Packages

- `@mastra/core`: Core Mastra functionality
- `@mastra/loggers`: Logging infrastructure
- Deployer implementations:
  - `@mastra/deployer-cloudflare`
  - Other platform-specific deployers
