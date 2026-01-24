# @mastra/admin-server

HTTP API server for MastraAdmin. This package provides a REST API layer that exposes `MastraAdmin` functionality via HTTP endpoints, following the same pattern as `@mastra/server` wrapping `Mastra`.

## Installation

```bash
npm install @mastra/admin-server
# or
pnpm add @mastra/admin-server
# or
yarn add @mastra/admin-server
```

### Peer Dependencies

```bash
npm install @mastra/admin zod
```

## Quick Start

```typescript
import { MastraAdmin } from '@mastra/admin';
import { AdminServer } from '@mastra/admin-server';

// 1. Create and initialize MastraAdmin
const admin = new MastraAdmin({
  licenseKey: process.env.LICENSE_KEY!,
  // Configure your storage, auth, runner, etc.
});
await admin.init();

// 2. Create and start the server
const server = new AdminServer({
  admin,
  port: 3000,
  host: '0.0.0.0',
});

await server.start();
// Server is now running at http://0.0.0.0:3000
// API available at http://0.0.0.0:3000/api
// WebSocket at ws://0.0.0.0:3000/ws
```

## Configuration

### AdminServerConfig

| Option                  | Type               | Default                | Description                                  |
| ----------------------- | ------------------ | ---------------------- | -------------------------------------------- |
| `admin`                 | `MastraAdmin`      | **required**           | MastraAdmin instance with all business logic |
| `port`                  | `number`           | `3000`                 | Server port                                  |
| `host`                  | `string`           | `'localhost'`          | Server host                                  |
| `basePath`              | `string`           | `'/api'`               | Base path for all API routes                 |
| `cors`                  | `CorsOptions`      | `{ origin: '*', ... }` | CORS configuration                           |
| `rateLimit`             | `RateLimitOptions` | `undefined`            | Rate limiting options                        |
| `timeout`               | `number`           | `30000`                | Request timeout in milliseconds              |
| `maxBodySize`           | `number`           | `10485760`             | Maximum request body size in bytes (10MB)    |
| `enableBuildWorker`     | `boolean`          | `true`                 | Enable background build queue processor      |
| `buildWorkerIntervalMs` | `number`           | `5000`                 | Build worker polling interval                |
| `enableHealthWorker`    | `boolean`          | `true`                 | Enable server health check worker            |
| `healthCheckIntervalMs` | `number`           | `30000`                | Health check interval                        |
| `enableWebSocket`       | `boolean`          | `true`                 | Enable WebSocket support for real-time logs  |
| `enableRequestLogging`  | `boolean`          | `true` (dev)           | Enable request logging                       |
| `onError`               | `function`         | `undefined`            | Custom error handler                         |

### CORS Configuration

```typescript
const server = new AdminServer({
  admin,
  cors: {
    origin: ['http://localhost:3001', 'https://admin.example.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Team-Id'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  },
});
```

### Rate Limiting

```typescript
const server = new AdminServer({
  admin,
  rateLimit: {
    windowMs: 60000, // 1 minute window
    max: 100, // 100 requests per window
    keyGenerator: context => {
      // Rate limit by user ID if authenticated, otherwise by IP
      return context.userId || context.ip;
    },
  },
});
```

### Custom Error Handler

```typescript
const server = new AdminServer({
  admin,
  onError: (error, context) => {
    // Log to external service
    logger.error('API Error', {
      error: error.message,
      path: context.path,
      method: context.method,
      userId: context.userId,
    });

    // Return custom response or undefined to use default handler
    return undefined;
  },
});
```

## API Reference

The server exposes the following endpoint groups. See [openapi.yaml](./openapi.yaml) for the complete API specification.

### System Endpoints

| Method | Path      | Description     |
| ------ | --------- | --------------- |
| `GET`  | `/health` | Health check    |
| `GET`  | `/ready`  | Readiness check |

### Authentication (`/api/auth`)

| Method | Path            | Description             |
| ------ | --------------- | ----------------------- |
| `POST` | `/auth/login`   | Login via auth provider |
| `POST` | `/auth/logout`  | End current session     |
| `GET`  | `/auth/me`      | Get current user info   |
| `POST` | `/auth/refresh` | Refresh access token    |

### Teams (`/api/teams`)

| Method   | Path                               | Description          |
| -------- | ---------------------------------- | -------------------- |
| `GET`    | `/teams`                           | List user's teams    |
| `POST`   | `/teams`                           | Create new team      |
| `GET`    | `/teams/:teamId`                   | Get team details     |
| `PATCH`  | `/teams/:teamId`                   | Update team          |
| `DELETE` | `/teams/:teamId`                   | Delete team          |
| `GET`    | `/teams/:teamId/members`           | List team members    |
| `POST`   | `/teams/:teamId/members`           | Invite member        |
| `PATCH`  | `/teams/:teamId/members/:userId`   | Update member role   |
| `DELETE` | `/teams/:teamId/members/:userId`   | Remove member        |
| `GET`    | `/teams/:teamId/invites`           | List pending invites |
| `DELETE` | `/teams/:teamId/invites/:inviteId` | Cancel invite        |
| `POST`   | `/invites/:inviteId/accept`        | Accept invite        |

### Projects (`/api/projects`)

| Method   | Path                                       | Description                 |
| -------- | ------------------------------------------ | --------------------------- |
| `GET`    | `/teams/:teamId/projects`                  | List team's projects        |
| `POST`   | `/teams/:teamId/projects`                  | Create project              |
| `GET`    | `/projects/:projectId`                     | Get project details         |
| `PATCH`  | `/projects/:projectId`                     | Update project              |
| `DELETE` | `/projects/:projectId`                     | Delete project              |
| `GET`    | `/projects/:projectId/env-vars`            | List environment variables  |
| `POST`   | `/projects/:projectId/env-vars`            | Set environment variable    |
| `DELETE` | `/projects/:projectId/env-vars/:key`       | Delete environment variable |
| `GET`    | `/projects/:projectId/api-tokens`          | List API tokens             |
| `POST`   | `/projects/:projectId/api-tokens`          | Create API token            |
| `DELETE` | `/projects/:projectId/api-tokens/:tokenId` | Revoke API token            |

### Deployments (`/api/deployments`)

| Method   | Path                                  | Description                |
| -------- | ------------------------------------- | -------------------------- |
| `GET`    | `/projects/:projectId/deployments`    | List deployments           |
| `POST`   | `/projects/:projectId/deployments`    | Create deployment          |
| `GET`    | `/deployments/:deploymentId`          | Get deployment details     |
| `PATCH`  | `/deployments/:deploymentId`          | Update deployment config   |
| `DELETE` | `/deployments/:deploymentId`          | Delete deployment          |
| `POST`   | `/deployments/:deploymentId/deploy`   | Trigger deploy             |
| `POST`   | `/deployments/:deploymentId/stop`     | Stop deployment            |
| `POST`   | `/deployments/:deploymentId/restart`  | Restart deployment         |
| `POST`   | `/deployments/:deploymentId/rollback` | Rollback to previous build |

### Builds (`/api/builds`)

| Method | Path                                | Description       |
| ------ | ----------------------------------- | ----------------- |
| `GET`  | `/deployments/:deploymentId/builds` | List builds       |
| `GET`  | `/builds/:buildId`                  | Get build details |
| `GET`  | `/builds/:buildId/logs`             | Get build logs    |
| `POST` | `/builds/:buildId/cancel`           | Cancel build      |

### Servers (`/api/servers`)

| Method | Path                                | Description             |
| ------ | ----------------------------------- | ----------------------- |
| `GET`  | `/deployments/:deploymentId/server` | Get running server info |
| `GET`  | `/servers/:serverId/logs`           | Get server logs         |
| `GET`  | `/servers/:serverId/health`         | Get server health       |
| `GET`  | `/servers/:serverId/metrics`        | Get server metrics      |

### Observability (`/api/projects/:projectId`)

| Method | Path                           | Description          |
| ------ | ------------------------------ | -------------------- |
| `GET`  | `/projects/:projectId/traces`  | Query traces         |
| `GET`  | `/traces/:traceId`             | Get trace with spans |
| `GET`  | `/projects/:projectId/logs`    | Query logs           |
| `GET`  | `/projects/:projectId/metrics` | Query metrics        |
| `GET`  | `/projects/:projectId/scores`  | Query scores         |

### Admin (`/api/admin`)

| Method | Path             | Description                 |
| ------ | ---------------- | --------------------------- |
| `GET`  | `/admin/users`   | List all users (admin only) |
| `GET`  | `/admin/teams`   | List all teams (admin only) |
| `GET`  | `/admin/license` | Get license info            |
| `POST` | `/admin/license` | Update license              |
| `GET`  | `/admin/stats`   | Get system statistics       |

## Authentication

All API endpoints (except `/health`, `/ready`, `/auth/login`, `/auth/refresh`) require authentication via Bearer token:

```
Authorization: Bearer <token>
```

Tokens are obtained through the auth provider configured in MastraAdmin.

## WebSocket

Real-time updates for build logs and server logs are available via WebSocket:

```typescript
// Connect with authentication token
const ws = new WebSocket('ws://localhost:3000/ws?token=<your-token>');

ws.onopen = () => {
  // Subscribe to build logs
  ws.send(
    JSON.stringify({
      type: 'subscribe',
      payload: { channel: 'build:build-uuid-here' },
    }),
  );
};

ws.onmessage = event => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'build:log':
      console.log(`[${message.payload.level}] ${message.payload.line}`);
      break;
    case 'build:status':
      console.log(`Build status: ${message.payload.status}`);
      break;
    case 'server:log':
      console.log(`[${message.payload.stream}] ${message.payload.line}`);
      break;
    case 'server:health':
      console.log(`Server health: ${message.payload.status}`);
      break;
  }
};
```

### WebSocket Channels

| Channel             | Events                        | Description                   |
| ------------------- | ----------------------------- | ----------------------------- |
| `build:<buildId>`   | `build:log`, `build:status`   | Build log and status updates  |
| `server:<serverId>` | `server:log`, `server:health` | Server log and health updates |

## Background Workers

### Build Worker

The build worker processes the build queue in the background:

```typescript
const server = new AdminServer({
  admin,
  enableBuildWorker: true,
  buildWorkerIntervalMs: 5000, // Check queue every 5 seconds
});
```

To disable the build worker (e.g., when running workers separately):

```typescript
const server = new AdminServer({
  admin,
  enableBuildWorker: false,
});
```

### Health Check Worker

The health worker periodically checks the health of running servers:

```typescript
const server = new AdminServer({
  admin,
  enableHealthWorker: true,
  healthCheckIntervalMs: 30000, // Check every 30 seconds
});
```

## Complete Example

```typescript
import { MastraAdmin } from '@mastra/admin';
import { PostgresAdminStorage } from '@mastra/admin-pg';
import { LocalProcessRunner } from '@mastra/runner-local';
import { LocalEdgeRouter } from '@mastra/router-local';
import { AdminServer } from '@mastra/admin-server';

async function main() {
  // 1. Create MastraAdmin with all providers
  const admin = new MastraAdmin({
    licenseKey: process.env.LICENSE_KEY!,
    storage: new PostgresAdminStorage({
      connectionString: process.env.DATABASE_URL!,
    }),
    runner: new LocalProcessRunner({
      workDir: '/var/mastra/builds',
    }),
    router: new LocalEdgeRouter({
      baseDomain: 'localhost',
      portRange: { start: 3001, end: 4000 },
    }),
  });

  // 2. Initialize admin (validates license, runs migrations, etc.)
  await admin.init();

  // 3. Create server with full configuration
  const server = new AdminServer({
    admin,
    port: parseInt(process.env.PORT || '3000'),
    host: '0.0.0.0',
    basePath: '/api',
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      credentials: true,
    },
    enableBuildWorker: true,
    enableHealthWorker: true,
    enableWebSocket: true,
    enableRequestLogging: process.env.NODE_ENV !== 'production',
  });

  // 4. Start server
  await server.start();
  console.log(`Server running on port ${server.getStatus().port}`);

  // 5. Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

## Server Methods

### `start(): Promise<void>`

Start the HTTP server and background workers.

### `stop(): Promise<void>`

Stop the server and workers gracefully.

### `getApp(): Hono`

Get the underlying Hono app for customization.

```typescript
const app = server.getApp();

// Add custom middleware
app.use('/custom/*', customMiddleware);

// Add custom routes
app.get('/custom/endpoint', c => c.json({ hello: 'world' }));
```

### `getAdmin(): MastraAdmin`

Get the MastraAdmin instance.

### `isHealthy(): boolean`

Check if the server is healthy.

### `getStatus(): ServerStatus`

Get server status including uptime, worker states, and connection counts.

```typescript
const status = server.getStatus();
// {
//   running: true,
//   uptime: 3600,
//   buildWorkerActive: true,
//   healthWorkerActive: true,
//   wsConnectionCount: 5,
//   port: 3000,
//   host: '0.0.0.0'
// }
```

### `getWebSocketServer(): AdminWebSocketServer | undefined`

Get the WebSocket server instance for custom event broadcasting.

### `getBuildWorker(): BuildWorker | undefined`

Get the build worker instance.

### `getHealthWorker(): HealthCheckWorker | undefined`

Get the health check worker instance.

## Exports

### Main

```typescript
import {
  AdminServer,
  // Types
  AdminServerConfig,
  AdminServerContext,
  ServerStatus,
  CorsOptions,
  RateLimitOptions,
  ErrorContext,
} from '@mastra/admin-server';
```

### Routes

```typescript
import {
  ADMIN_SERVER_ROUTES,
  AUTH_ROUTES,
  TEAM_ROUTES,
  PROJECT_ROUTES,
  // ... etc
} from '@mastra/admin-server/routes';
```

### Middleware

```typescript
import {
  createAuthMiddleware,
  createRBACMiddleware,
  createTeamContextMiddleware,
  createRequestLoggerMiddleware,
  errorHandler,
} from '@mastra/admin-server/middleware';
```

### WebSocket

```typescript
import { AdminWebSocketServer, BuildLogStreamer, ServerLogStreamer } from '@mastra/admin-server/websocket';
```

### Workers

```typescript
import { BuildWorker, HealthCheckWorker } from '@mastra/admin-server/worker';
```

## Error Handling

All errors are returned in a consistent JSON format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { ... },
  "requestId": "uuid"
}
```

### Error Codes

| Code               | HTTP Status | Description             |
| ------------------ | ----------- | ----------------------- |
| `NOT_FOUND`        | 404         | Resource not found      |
| `UNAUTHORIZED`     | 401         | Authentication required |
| `FORBIDDEN`        | 403         | Permission denied       |
| `VALIDATION_ERROR` | 400         | Invalid request data    |
| `CONFLICT`         | 409         | Resource conflict       |
| `RATE_LIMITED`     | 429         | Rate limit exceeded     |
| `LICENSE_INVALID`  | 402         | Invalid license         |
| `LICENSE_EXPIRED`  | 402         | License expired         |
| `QUOTA_EXCEEDED`   | 402         | Quota exceeded          |
| `INTERNAL_ERROR`   | 500         | Internal server error   |

## License

Apache-2.0
