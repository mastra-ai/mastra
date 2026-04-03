---
name: navigation
description: Home page, routing, and general navigation
---

# Navigation

## Routes

- `/` - Home/root (should redirect)
- `/agents` - Default landing after redirect

## Tests

### Studio loads from root
1. Navigate to the root URL (`/`)
2. Verify the page loads without errors
3. Verify redirection to `/agents` (or the default landing page)
4. Screenshot

### Sidebar navigation works
1. Verify the sidebar/navigation menu is visible
2. Click on each main nav item and verify the corresponding page loads:
   - Agents
   - Workflows
   - Tools
   - Scorers
   - Observability
3. Screenshot at least one navigation transition

### Page titles are correct
1. As you navigate between pages, verify each page has an appropriate heading or title
2. No page should show "undefined" or blank titles

## Known Issues

- Initial load may show a brief loading state before redirect completes
