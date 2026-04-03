---
name: extras
description: Templates, processors, MCP servers, request context
---

# Extras

These are secondary pages that should load correctly but may show empty states in a fresh project.

## Routes

- `/templates` - Templates gallery
- `/processors` - Processors listing
- `/mcps` - MCP servers listing
- `/request-context` - Request context JSON editor

## Tests

### Templates page loads
1. Navigate to `/templates`
2. Verify the page loads (should show a gallery of starter templates)
3. Screenshot

### Processors page loads
1. Navigate to `/processors`
2. Verify the page loads (empty state is OK for a fresh project)
3. Screenshot

### MCP Servers page loads
1. Navigate to `/mcps`
2. Verify the page loads (empty state is OK for a fresh project)
3. Screenshot

### Request Context page loads
1. Navigate to `/request-context`
2. Verify the page loads with a JSON editor or similar interface
3. Screenshot

## Known Issues

- These pages may all show empty states in a newly created project - that's expected
- Templates page content depends on available templates in the registry
