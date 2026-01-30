# @mastra/skills-api

API server for [skills.sh](https://skills.sh) - a marketplace for Agent Skills.

This package provides a standalone HTTP API for browsing, searching, and discovering skills that follow the [Agent Skills specification](https://agentskills.io).

## Features

- List and search skills with pagination
- Filter by category, tags, and author
- Get detailed skill information
- Installation instructions
- Statistics and metadata

## Quick Start

### Running the Server

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Production mode
pnpm build && pnpm start
```

The server runs on `http://localhost:3456` by default.

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

### Skills

```
GET /api/skills
```

List and search skills with pagination.

**Query Parameters:**

| Parameter   | Type    | Description                                                        |
| ----------- | ------- | ------------------------------------------------------------------ |
| `query`     | string  | Search text                                                        |
| `category`  | string  | Filter by category                                                 |
| `tags`      | string  | Comma-separated tags                                               |
| `author`    | string  | Filter by author                                                   |
| `sortBy`    | string  | Sort field: `name`, `downloads`, `stars`, `createdAt`, `updatedAt` |
| `sortOrder` | string  | Sort order: `asc`, `desc`                                          |
| `page`      | number  | Page number (1-indexed)                                            |
| `pageSize`  | number  | Items per page (default: 20, max: 100)                             |
| `featured`  | boolean | Only featured skills                                               |

**Response:**

```json
{
  "skills": [...],
  "total": 12,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

### Get Skill

```
GET /api/skills/:name
```

Get detailed information about a specific skill.

### Featured Skills

```
GET /api/skills/featured
```

Get all featured skills.

### Categories

```
GET /api/skills/categories
```

Get all categories with skill counts.

### Tags

```
GET /api/skills/tags
```

Get all available tags.

### Authors

```
GET /api/skills/authors
```

Get all skill authors.

### Statistics

```
GET /api/skills/stats
```

Get registry statistics (total skills, downloads, stars, etc.).

### Installation Instructions

```
GET /api/skills/:name/install
```

Get installation instructions for a specific skill.

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
import { skills, categories, getAllTags, getAllAuthors } from '@mastra/skills-api';

// Get all skills
console.log(skills);

// Get all categories
console.log(categories);

// Get all tags
console.log(getAllTags());
```

## Development

```bash
# Run tests
pnpm test

# Lint
pnpm lint

# Build
pnpm build:lib
```

## License

Apache-2.0
