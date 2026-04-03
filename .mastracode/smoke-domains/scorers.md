---
name: scorers
description: Scorer listing and detail views
---

# Scorers

## Routes

- `/scorers` - Scorer listing page
- `/scorers/<scorerName>` - Scorer detail view

## Tests

### Scorer listing loads
1. Navigate to `/scorers`
2. Verify the scorers list loads (should show 3 example scorers if created with `-e`)
3. Screenshot

### Scorer detail view loads
1. Navigate directly to `/scorers/completeness-scorer` using URL navigation (do NOT click - use direct URL)
2. Verify the scorer detail page loads with:
   - Scorer name
   - Description
   - Scores table or configuration
3. Screenshot

## Known Issues

- **Use direct URL navigation** for scorer details - clicking from the list has client-side routing timing issues with browser automation
- Scorer names in URLs are kebab-case versions of the display names
