# @mastra/skills-api

Open API server for [skills.sh](https://skills.sh) - a marketplace for Agent Skills.

**Build your own skills marketplace!** This package provides everything you need to create a custom skills directory with the same data as skills.sh.

## Features

- **34,000+ skills** scraped from the skills.sh registry
- **2,800+ source repositories**
- **2,400+ unique owners**
- **17 supported AI agents** (Cursor, Claude Code, Copilot, etc.)
- Full-text search and filtering
- Pagination support
- Fetch skill content directly from GitHub
- Built-in scraper to update registry data

## Quick Start

### Running the Server

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Production mode
pnpm build:lib && pnpm start
```

The server runs on `http://localhost:3456` by default.

### Environment Variables

| Variable           | Default   | Description                                      |
| ------------------ | --------- | ------------------------------------------------ |
| `PORT`             | `3456`    | Server port                                      |
| `HOST`             | `0.0.0.0` | Server host                                      |
| `CORS_ORIGIN`      | `*`       | CORS origin                                      |
| `AUTO_REFRESH`     | `false`   | Enable auto-refresh scheduler (`true` or `1`)   |
| `REFRESH_INTERVAL` | `30`      | Refresh interval in minutes (minimum 5 minutes) |
| `SKILLS_DATA_DIR`  | -         | External directory for persistent data storage  |

### Storage Options

By default, skills data is bundled with the build. For production, use S3 or filesystem storage.

#### S3 Storage (Recommended for Production)

Works with AWS S3, MinIO, Cloudflare R2, or any S3-compatible service:

```bash
# AWS S3
S3_BUCKET=my-skills-bucket \
S3_KEY=skills-data.json \
AWS_ACCESS_KEY_ID=xxx \
AWS_SECRET_ACCESS_KEY=xxx \
pnpm start

# MinIO / S3-compatible
S3_BUCKET=skills \
S3_ENDPOINT=http://minio:9000 \
AWS_ACCESS_KEY_ID=minioadmin \
AWS_SECRET_ACCESS_KEY=minioadmin \
pnpm start

# Cloudflare R2
S3_BUCKET=skills \
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com \
AWS_ACCESS_KEY_ID=xxx \
AWS_SECRET_ACCESS_KEY=xxx \
pnpm start
```

| Variable | Default | Description |
|----------|---------|-------------|
| `S3_BUCKET` | - | S3 bucket name (required for S3) |
| `S3_KEY` | `skills-data.json` | Object key for the data file |
| `S3_REGION` | `us-east-1` | AWS region |
| `S3_ENDPOINT` | - | Custom endpoint for S3-compatible services |

#### Filesystem Storage

For simpler deployments with persistent volumes:

```bash
# Point to a persistent volume
SKILLS_DATA_DIR=/data/skills pnpm start

# Docker example
docker run -v /host/data:/data/skills -e SKILLS_DATA_DIR=/data/skills skills-api
```

#### Storage Priority

1. **S3** - If `S3_BUCKET` is configured, data is loaded from and saved to S3
2. **Filesystem** - If `SKILLS_DATA_DIR` is set, uses local filesystem
3. **Bundled** - Falls back to data bundled with the build

When both S3 and filesystem are configured, data is saved to both (S3 as primary, filesystem as backup).

## API Endpoints

### Root

```
GET /
```

Returns API information, all available endpoints, and usage examples.

### Health Check

```
GET /health
```

Returns server health status.

---

### Skills

#### List Skills

```
GET /api/skills
```

List and search skills with pagination.

**Query Parameters:**

| Parameter   | Type   | Default    | Description                              |
| ----------- | ------ | ---------- | ---------------------------------------- |
| `query`     | string | -          | Search text (name, displayName, source)  |
| `owner`     | string | -          | Filter by GitHub owner                   |
| `repo`      | string | -          | Filter by repository (owner/repo format) |
| `sortBy`    | string | `installs` | Sort field: `name`, `installs`           |
| `sortOrder` | string | `desc`     | Sort order: `asc`, `desc`                |
| `page`      | number | `1`        | Page number (1-indexed)                  |
| `pageSize`  | number | `20`       | Items per page (max: 100)                |

**Response:**

```json
{
  "skills": [
    {
      "source": "vercel-labs/agent-skills",
      "skillId": "vercel-react-best-practices",
      "name": "vercel-react-best-practices",
      "installs": 69954,
      "owner": "vercel-labs",
      "repo": "agent-skills",
      "githubUrl": "https://github.com/vercel-labs/agent-skills",
      "displayName": "Vercel React Best Practices"
    }
  ],
  "total": 34311,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1716
}
```

#### Top Skills

```
GET /api/skills/top?limit=100
```

Get top skills sorted by install count.

#### Get Skill by ID

```
GET /api/skills/:skillId
```

Get a skill by its ID. Returns the first match if skillId is not unique.

#### Get Skill by Source

```
GET /api/skills/:owner/:repo/:skillId
```

Get a specific skill from a specific repository. Includes install command.

```json
{
  "source": "vercel-labs/agent-skills",
  "skillId": "vercel-react-best-practices",
  "name": "vercel-react-best-practices",
  "installs": 69954,
  "installCommand": "npx skills add vercel-labs/agent-skills/vercel-react-best-practices"
}
```

#### Get Skill Content from GitHub

```
GET /api/skills/:owner/:repo/:skillId/content
```

Fetches the full SKILL.md content from GitHub and parses it.

**Query Parameters:**

| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| `branch`  | string | `main`  | Git branch to fetch from |

**Response:**

```json
{
  "source": "vercel-labs/agent-skills",
  "skillId": "vercel-react-best-practices",
  "path": "skills/react-best-practices/SKILL.md",
  "metadata": {
    "name": "vercel-react-best-practices",
    "description": "React and Next.js performance optimization guidelines...",
    "license": "MIT"
  },
  "instructions": "# Vercel React Best Practices\n\n...",
  "raw": "---\nname: vercel-react-best-practices\n..."
}
```

---

### Sources (Repositories)

#### List Sources

```
GET /api/skills/sources
```

Get all source repositories with skill counts, sorted by total installs.

**Response:**

```json
{
  "sources": [
    {
      "source": "vercel-labs/agent-skills",
      "owner": "vercel-labs",
      "repo": "agent-skills",
      "skillCount": 5,
      "totalInstalls": 150000
    }
  ],
  "total": 2843,
  "page": 1,
  "pageSize": 50,
  "totalPages": 57
}
```

#### Top Sources

```
GET /api/skills/sources/top?limit=50
```

Get top repositories by total install count.

#### Skills by Repository

```
GET /api/skills/by-source/:owner/:repo
```

Get all skills from a specific GitHub repository.

---

### Owners

```
GET /api/skills/owners
```

Get all skill owners with skill counts and total installs.

---

### Supported Agents

```
GET /api/skills/agents
```

Get all AI agents that support the Agent Skills specification.

**Response:**

```json
{
  "agents": [
    {
      "id": "cursor",
      "name": "Cursor",
      "url": "https://cursor.sh",
      "iconUrl": "https://skills.sh/agents/cursor.svg",
      "description": "AI-first code editor"
    }
  ],
  "total": 17
}
```

---

### Statistics

```
GET /api/skills/stats
```

Get registry statistics.

**Response:**

```json
{
  "scrapedAt": "2026-01-30T04:51:07.907Z",
  "totalSkills": 34311,
  "totalSources": 2843,
  "totalOwners": 2451,
  "totalInstalls": 1234567890
}
```

---

### Admin Routes

Admin routes allow you to manage the data refresh scheduler.

#### Get Status

```
GET /api/admin/status
```

Get scheduler and data status.

**Response:**

```json
{
  "scheduler": {
    "running": true,
    "refreshing": false
  },
  "data": {
    "lastUpdated": "2026-01-30T04:51:07.907Z",
    "lastRefresh": {
      "success": true,
      "timestamp": "2026-01-30T04:51:07.907Z",
      "skillCount": 34311,
      "sourceCount": 2843,
      "ownerCount": 2451,
      "durationMs": 1234
    }
  }
}
```

#### Trigger Manual Refresh

```
POST /api/admin/refresh
```

Manually trigger a skills data refresh (scrapes skills.sh).

#### Start Scheduler

```
POST /api/admin/scheduler/start?interval=30
```

Start the automatic refresh scheduler.

**Query Parameters:**

| Parameter  | Type   | Default | Description                          |
| ---------- | ------ | ------- | ------------------------------------ |
| `interval` | number | `30`    | Refresh interval in minutes (min: 5) |

#### Stop Scheduler

```
POST /api/admin/scheduler/stop
```

Stop the automatic refresh scheduler.

---

## Updating the Skills Data

The skills data is scraped from skills.sh. There are several ways to keep it updated:

### Manual Update

```bash
pnpm scrape
```

This fetches the latest skills and saves them to `src/registry/scraped-skills.json`.

### Auto-Refresh with Environment Variables

Enable automatic refresh when starting the server:

```bash
AUTO_REFRESH=true REFRESH_INTERVAL=30 pnpm start
```

This will refresh the skills data every 30 minutes.

### Using the Admin API

Start the scheduler via API:

```bash
# Start scheduler (30 minute interval)
curl -X POST http://localhost:3456/api/admin/scheduler/start?interval=30

# Check status
curl http://localhost:3456/api/admin/status

# Manual refresh
curl -X POST http://localhost:3456/api/admin/refresh

# Stop scheduler
curl -X POST http://localhost:3456/api/admin/scheduler/stop
```

### Programmatic Scheduling

```typescript
import { startRefreshScheduler, stopRefreshScheduler, refreshSkillsData } from '@mastra/skills-api';

// Start automatic refresh every 30 minutes
startRefreshScheduler({
  intervalMs: 30 * 60 * 1000, // 30 minutes
  refreshOnStart: false, // Don't refresh immediately
  onRefresh: result => {
    console.log(`Refreshed: ${result.skillCount} skills`);
  },
  onError: error => {
    console.error('Refresh failed:', error);
  },
});

// Or trigger a manual refresh
const result = await refreshSkillsData();
console.log(`Refreshed ${result.skillCount} skills in ${result.durationMs}ms`);

// Stop when done
stopRefreshScheduler();
```

## Usage as a Library

```typescript
import { createSkillsApiServer } from '@mastra/skills-api';

const app = createSkillsApiServer({
  cors: true,
  corsOrigin: 'https://your-domain.com',
  logging: true,
  prefix: '/api',
});

// Use with any Hono-compatible server
export default app;
```

### Accessing Registry Data Directly

```typescript
import { skills, metadata, getSources, getOwners, getTopSkills, supportedAgents } from '@mastra/skills-api';

// Get all skills
console.log(`Total skills: ${skills.length}`);

// Get metadata
console.log(`Scraped at: ${metadata.scrapedAt}`);

// Get top sources
const sources = getSources();
console.log(`Top source: ${sources[0].source}`);

// Get supported agents
console.log(`Agents: ${supportedAgents.map(a => a.name).join(', ')}`);
```

### Fetching Skill Content

```typescript
import { fetchSkillFromGitHub } from '@mastra/skills-api';

const result = await fetchSkillFromGitHub('vercel-labs', 'agent-skills', 'vercel-react-best-practices');

if (result.success) {
  console.log(result.content.metadata.description);
  console.log(result.content.instructions);
}
```

### Using the Scraper

```typescript
import { scrapeSkills, enrichSkills, scrapeAndSave } from '@mastra/skills-api';

// Scrape and save to default location
await scrapeAndSave();

// Or scrape and process manually
const rawSkills = await scrapeSkills();
const enriched = enrichSkills(rawSkills);
```

## Building Your Own Marketplace

This API provides everything you need to build a custom skills marketplace:

1. **Skills data** - 34,000+ skills with install counts
2. **Search & filter** - By name, owner, repository
3. **Skill content** - Fetch SKILL.md from GitHub
4. **Metadata** - Sources, owners, statistics
5. **Agent info** - Supported AI agents with logos

Example use cases:

- Custom skills directory for your organization
- Curated skills collection for specific domains
- Skills analytics dashboard
- Integration with your AI agent platform

## Development

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Build
pnpm build:lib

# Update skills data
pnpm scrape

# Run dev server
pnpm dev
```

## License

Apache-2.0
