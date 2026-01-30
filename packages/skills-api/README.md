# @mastra/skills-api

API server for [skills.sh](https://skills.sh) - a marketplace for Agent Skills.

This package provides a standalone HTTP API for browsing, searching, and discovering skills that follow the [Agent Skills specification](https://agentskills.io).

## Features

- **34,000+ skills** scraped from the skills.sh registry
- List and search skills with pagination
- Filter by owner and repository
- Get skills by source repository
- Statistics and metadata
- Built-in scraper to update the registry

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

### Updating the Skills Data

The skills data is scraped from skills.sh. To update:

```bash
pnpm scrape
```

This will fetch the latest skills and save them to `src/registry/scraped-skills.json`.

### Environment Variables

| Variable      | Default   | Description |
| ------------- | --------- | ----------- |
| `PORT`        | `3456`    | Server port |
| `HOST`        | `0.0.0.0` | Server host |
| `CORS_ORIGIN` | `*`       | CORS origin |

## API Endpoints

### Health Check

```
GET /health
```

Returns server health status.

### Root

```
GET /
```

Returns API information and available endpoints.

### List Skills

```
GET /api/skills
```

List and search skills with pagination.

**Query Parameters:**

| Parameter   | Type   | Description                              |
| ----------- | ------ | ---------------------------------------- |
| `query`     | string | Search text (name, displayName, source)  |
| `owner`     | string | Filter by GitHub owner                   |
| `repo`      | string | Filter by repository (owner/repo format) |
| `sortBy`    | string | Sort field: `name`, `installs`           |
| `sortOrder` | string | Sort order: `asc`, `desc`                |
| `page`      | number | Page number (1-indexed)                  |
| `pageSize`  | number | Items per page (default: 20, max: 100)   |

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

### Top Skills

```
GET /api/skills/top?limit=100
```

Get top skills by installs.

### Get Skill by ID

```
GET /api/skills/:skillId
```

Get a skill by its ID. Note: skill IDs may not be unique across sources.

### Get Skill by Source

```
GET /api/skills/:owner/:repo/:skillId
```

Get a specific skill from a specific repository. Includes install command.

### Skills by Repository

```
GET /api/skills/by-source/:owner/:repo
```

Get all skills from a specific GitHub repository.

### Sources (Repositories)

```
GET /api/skills/sources
```

Get all source repositories with skill counts, sorted by total installs.

### Top Sources

```
GET /api/skills/sources/top?limit=50
```

Get top repositories by total installs.

### Owners

```
GET /api/skills/owners
```

Get all skill owners with counts.

### Statistics

```
GET /api/skills/stats
```

Get registry statistics.

```json
{
  "scrapedAt": "2026-01-30T04:51:07.907Z",
  "totalSkills": 34311,
  "totalSources": 2843,
  "totalOwners": 2451,
  "totalInstalls": 123456789
}
```

## Usage as a Library

You can also use this package programmatically:

```typescript
import { createSkillsApiServer } from '@mastra/skills-api';

const app = createSkillsApiServer({
  cors: true,
  corsOrigin: 'https://skills.sh',
  logging: true,
  prefix: '/api',
});

// Use with any Hono-compatible server
export default app;
```

### Accessing Registry Data

```typescript
import { skills, metadata, getSources, getOwners } from '@mastra/skills-api';

// Get all skills
console.log(`Total skills: ${skills.length}`);

// Get metadata
console.log(`Scraped at: ${metadata.scrapedAt}`);

// Get sources
const sources = getSources();
console.log(`Top source: ${sources[0].source}`);
```

### Using the Scraper

```typescript
import { scrapeSkills, enrichSkills, scrapeAndSave } from '@mastra/skills-api';

// Scrape and save to default location
await scrapeAndSave();

// Or scrape and process manually
const skills = await scrapeSkills();
const enriched = enrichSkills(skills);
```

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
```

## License

Apache-2.0
