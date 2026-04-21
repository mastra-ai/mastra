# Enhanced Deploy Config for Multi-Environment Support

## End-to-End User Journey

```
# 1. Create project & develop locally
npx create-mastra my-app && cd my-app
mastra dev                    # Studio + Server on localhost:4111

# 2. Deploy studio (default — studio serves its own API)
mastra studio deploy

# 3. Deploy server to production
mastra server deploy
# → Deploy succeeded! https://my-app-abc.mastra.cloud
# → "Create .mastra-prod.json so studio can point to this server? (Y/n)"
# → Writes .mastra-prod.json with server config auto-populated

# 4. Deploy studio pointing at prod server
mastra studio deploy -c .mastra-prod.json
# → Studio HTML gets %%MASTRA_SERVER_HOST%% = my-app-abc.mastra.cloud, etc.
```

## How Studio Connects to a Server (existing mechanism)

Studio's `index.html` has `%%MASTRA_*%%` placeholders that get replaced at serve time:

```html
window.MASTRA_SERVER_HOST = '%%MASTRA_SERVER_HOST%%';
window.MASTRA_SERVER_PORT = '%%MASTRA_SERVER_PORT%%';
window.MASTRA_SERVER_PROTOCOL = '%%MASTRA_SERVER_PROTOCOL%%';
window.MASTRA_API_PREFIX = '%%MASTRA_API_PREFIX%%';
window.MASTRA_REQUEST_CONTEXT_PRESETS = '%%MASTRA_REQUEST_CONTEXT_PRESETS%%';
```

`App.tsx` reads these to build the API endpoint: `${protocol}://${host}:${port}`.

The platform needs to receive `server` config in the deploy payload so it can inject these values when serving the studio.

## Config File Format

Extend `ProjectConfig` with optional fields (fully backward compatible):

```json
{
  "projectId": "proj_abc",
  "projectName": "my-app-staging",
  "organizationId": "org_xyz",
  "envFile": ".env.staging",
  "envVars": {
    "NODE_ENV": "staging",
    "DEBUG": "true"
  },
  "requestContextPresets": "./presets/staging.json",
  "server": {
    "host": "my-app-abc.mastra.cloud",
    "port": 443,
    "protocol": "https",
    "apiPrefix": "/api"
  }
}
```

- `requestContextPresets` can be a **string** (file path) or **inline object**
- `envFile` replaces the default `.env.production → .env.local → .env` cascade
- `envVars` are applied after envFile (overrides)
- `server` tells the deployed studio which backend to talk to
- All paths resolved relative to project directory

## Files to Modify

### 1. `packages/cli/src/commands/studio/project-config.ts`

**Add types:**
```typescript
export interface ServerConfig {
  host?: string;
  port?: number;
  protocol?: string;
  apiPrefix?: string;
}

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  organizationId: string;
  // Extended fields (manually authored)
  envFile?: string;
  envVars?: Record<string, string>;
  requestContextPresets?: Record<string, Record<string, unknown>> | string;
  server?: ServerConfig;
}
```

**Fix `saveProjectConfig` to preserve extended fields** (critical — current impl overwrites entire file):
```typescript
export async function saveProjectConfig(
  dir: string,
  config: Partial<ProjectConfig>,
  configFile?: string,
): Promise<void> {
  const path = resolveConfigPath(dir, configFile);
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    // File doesn't exist yet — start fresh
  }
  const merged = { ...existing, ...config };
  await writeFile(path, JSON.stringify(merged, null, 2) + '\n');
}
```

### 2. `packages/cli/src/commands/studio/deploy.ts`

**Add imports:**
```typescript
import { isAbsolute, join, resolve } from 'node:path';
import { loadAndValidatePresets } from '../../utils/validate-presets.js';
import type { ServerConfig } from './project-config.js';
```

**Add helpers after `readEnvVars()`:**
```typescript
async function readSingleEnvFile(projectDir: string, envFilePath: string): Promise<Record<string, string>> {
  const resolved = isAbsolute(envFilePath) ? envFilePath : join(projectDir, envFilePath);
  const content = await readFile(resolved, 'utf-8');
  return parseEnvFile(content);
}

function validatePresetsObject(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('requestContextPresets must be a JSON object with named presets');
  }
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Preset "${key}" must be a JSON object`);
    }
  }
}
```

**In `deployAction()`, after loading config (line ~261):**

Extract extended fields:
```typescript
const configEnvFile = projectConfig?.envFile;
const configEnvVars = projectConfig?.envVars;
const configPresets = projectConfig?.requestContextPresets;
const configServer = projectConfig?.server;
```

**Enhance confirmation note (lines ~273-280)** to show env file, presets, and server info:
```typescript
p.note(
  [
    `Organization:  ${orgName}`,
    `Project:       ${projectName}`,
    `Directory:     ${targetDir}`,
    ...(gitBranch ? [`Git branch:    ${gitBranch}`] : []),
    ...(configEnvFile ? [`Env file:      ${configEnvFile}`] : []),
    ...(configEnvVars ? [`Env overrides: ${Object.keys(configEnvVars).length} var(s)`] : []),
    ...(configPresets ? [`Presets:       ${typeof configPresets === 'string' ? configPresets : 'inline'}`] : []),
    ...(configServer ? [`Server:        ${configServer.protocol ?? 'https'}://${configServer.host ?? 'default'}:${configServer.port ?? 443}${configServer.apiPrefix ?? ''}`] : []),
  ].join('\n'),
  'Deploy settings',
);
```

**Replace env var reading (lines ~342-349):**
```typescript
s.start('Reading environment variables...');
let envVars: Record<string, string>;
if (configEnvFile) {
  envVars = await readSingleEnvFile(targetDir, configEnvFile);
} else {
  envVars = await readEnvVars(targetDir);
}
if (configEnvVars) {
  Object.assign(envVars, configEnvVars);
}
const envCount = Object.keys(envVars).length;
if (envCount > 0) {
  s.stop(`Found ${envCount} env var(s)${configEnvFile ? ` from ${configEnvFile}` : ''}${configEnvVars ? ` (+ ${Object.keys(configEnvVars).length} override(s))` : ''}`);
} else {
  s.stop('No .env file found');
}
```

**Resolve presets (new block after env vars):**
```typescript
let resolvedPresets: string | undefined;
if (configPresets) {
  if (typeof configPresets === 'string') {
    const absolutePresetsPath = isAbsolute(configPresets) ? configPresets : join(targetDir, configPresets);
    resolvedPresets = await loadAndValidatePresets(absolutePresetsPath);
  } else {
    validatePresetsObject(configPresets);
    resolvedPresets = JSON.stringify(configPresets);
  }
}
```

**Pass presets + server to `uploadDeploy()`:**
```typescript
const deployResult = await uploadDeploy(token, orgId, projectId, zipBuffer, {
  gitBranch: gitBranch ?? undefined,
  projectName,
  envVars: envCount > 0 ? envVars : undefined,
  requestContextPresets: resolvedPresets,
  server: configServer,
});
```

### 3. `packages/cli/src/commands/studio/platform-api.ts`

**Add import:**
```typescript
import type { ServerConfig } from './project-config.js';
```

**Extend `uploadDeploy` meta type:**
```typescript
meta?: {
  gitBranch?: string;
  projectName?: string;
  envVars?: Record<string, string>;
  requestContextPresets?: string;  // JSON string
  server?: ServerConfig;
},
```

**Update POST body (line ~86):**
```typescript
body: JSON.stringify({
  envVars: meta?.envVars,
  ...(meta?.requestContextPresets && { requestContextPresets: meta.requestContextPresets }),
  ...(meta?.server && { server: meta.server }),
}),
```

Note: The platform API may not yet accept these fields — unknown fields are typically ignored. The CLI sends them so the backend can adopt them independently.

### 4. `packages/cli/src/commands/server/deploy.ts` (NEW — the key UX flow)

After a successful server deploy (line ~263, when `finalStatus.status === 'running'`), offer to create a prod studio config:

```typescript
if (finalStatus.status === 'running') {
  p.outro(`Deploy succeeded! ${finalStatus.instanceUrl}`);

  // Offer to create a studio config pointing at this server
  if (!isHeadless && finalStatus.instanceUrl) {
    const createConfig = await p.confirm({
      message: 'Create .mastra-prod.json so studio can point to this server?',
    });

    if (!p.isCancel(createConfig) && createConfig) {
      const serverUrl = new URL(finalStatus.instanceUrl);
      await saveProjectConfig(
        targetDir,
        {
          projectId,
          projectName,
          organizationId: orgId,
          server: {
            host: serverUrl.hostname,
            port: serverUrl.port ? Number(serverUrl.port) : (serverUrl.protocol === 'https:' ? 443 : 80),
            protocol: serverUrl.protocol.replace(':', ''),
            apiPrefix: '/api',
          },
        },
        '.mastra-prod.json',
      );
      p.log.success('Saved .mastra-prod.json');
      p.log.info('Deploy studio with: mastra studio deploy -c .mastra-prod.json');
    }
  }
}
```

**Parse instanceUrl into ServerConfig:**
The `instanceUrl` returned from the platform (e.g. `https://my-app-abc.mastra.cloud`) gets parsed via `new URL()` to extract host, port, and protocol. `apiPrefix` defaults to `/api`.

### 5. `packages/cli/src/utils/validate-presets.ts`

No changes needed — callers will pre-resolve paths to absolute before calling `loadAndValidatePresets()`.

## Precedence

1. Environment variables (`MASTRA_ORG_ID`, etc.)
2. CLI flags (`--org`, `--project`)
3. Config file fields
4. Default behavior (env cascade, no presets)

## Verification

1. **Backward compat**: Deploy with existing `.mastra-project.json` (3 fields only) — should work identically
2. **envFile**: Create `.mastra-test.json` with `"envFile": ".env.test"`, deploy, verify correct env vars sent
3. **envVars override**: Add `"envVars": {"FOO": "bar"}` to config, verify it appears in deploy payload
4. **Presets (file path)**: Set `"requestContextPresets": "./presets.json"`, verify loaded and sent
5. **Presets (inline)**: Set inline presets object, verify sent
6. **Server config**: Set server fields, verify sent in deploy payload
7. **saveProjectConfig preservation**: Deploy with extended config, verify save doesn't clobber extended fields
8. **Server deploy → prod config**: Run `mastra server deploy`, accept prompt, verify `.mastra-prod.json` created with correct server fields parsed from instanceUrl
9. **End-to-end**: `mastra server deploy` → accept → `mastra studio deploy -c .mastra-prod.json` → verify studio deploy payload includes server config
10. Build and typecheck: `pnpm build:cli && pnpm typecheck`
