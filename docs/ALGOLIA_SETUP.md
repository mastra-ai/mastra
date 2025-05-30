# Algolia Search Setup

This documentation site has been migrated from Pagefind to Algolia for search functionality. Follow these steps to set up Algolia search.

## Prerequisites

1. An Algolia account (sign up at [algolia.com](https://www.algolia.com/))
2. An Algolia application with a search index

## Environment Variables

Create a `.env.local` file in the `docs` directory with the following variables:

```bash
# Required for search functionality
NEXT_PUBLIC_ALGOLIA_APP_ID=your_algolia_app_id
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_algolia_search_api_key

# Optional: For indexing (keep this secret, don't expose to client)
ALGOLIA_ADMIN_API_KEY=your_algolia_admin_api_key
```

## Getting Your Algolia Credentials

1. **App ID**: Found in your Algolia dashboard under "Settings" → "API Keys"
2. **Search API Key**: The public search-only API key from the same location
3. **Admin API Key**: The admin API key (only needed for indexing operations)

## Index Configuration

The search hook expects an index named `docs` by default. You can customize this by passing `indexName` in the search options:

```typescript
const searchOptions: AlgoliaSearchOptions = {
  indexName: "your-custom-index-name",
  hitsPerPage: 20,
  attributesToRetrieve: ["title", "content", "url", "hierarchy"],
  attributesToHighlight: ["title", "content"],
  highlightPreTag: "<mark>",
  highlightPostTag: "</mark>",
};
```

## Document Structure

Your Algolia index should contain documents with the following structure:

```json
{
  "objectID": "unique-id",
  "title": "Page Title",
  "content": "Page content...",
  "url": "/path/to/page",
  "hierarchy": {
    "lvl0": "Section",
    "lvl1": "Subsection",
    "lvl2": "Page Title"
  }
}
```

## Indexing Your Content

You'll need to set up a process to index your documentation content. This can be done using:

1. **Algolia Crawler**: Automated web crawling
2. **DocSearch**: Algolia's documentation-specific solution
3. **Custom indexing script**: Using the Algolia API

### Example Custom Indexing Script

```javascript
const algoliasearch = require("algoliasearch");

const client = algoliasearch("YOUR_APP_ID", "YOUR_ADMIN_API_KEY");
const index = client.initIndex("docs");

// Your indexing logic here
const records = [
  {
    objectID: "1",
    title: "Getting Started",
    content: "Welcome to our documentation...",
    url: "/getting-started",
    hierarchy: {
      lvl0: "Documentation",
      lvl1: "Getting Started",
    },
  },
];

index.saveObjects(records).then(({ objectIDs }) => {
  console.log("Indexed:", objectIDs);
});
```

## Search Features

The Algolia implementation includes:

- **Debounced search**: 300ms delay to avoid excessive API calls
- **Highlighted results**: Search terms are highlighted in results
- **Keyboard navigation**: Arrow keys and Enter support
- **AI integration**: Option to ask the docs agent about search terms
- **Virtual scrolling**: Efficient rendering of large result sets

## Troubleshooting

### Search not working

1. Check that environment variables are set correctly
2. Verify your Algolia credentials in the dashboard
3. Ensure your index contains data
4. Check browser console for error messages

### No results returned

1. Verify your index name matches the configuration
2. Check that your documents have the expected structure
3. Test your search directly in the Algolia dashboard

### Performance issues

1. Adjust `hitsPerPage` to return fewer results
2. Limit `attributesToRetrieve` to only necessary fields
3. Consider using filters to narrow search scope

## Migration from Pagefind

The migration from Pagefind to Algolia includes:

1. ✅ Replaced `useDebounceSearch` hook with `useAlgoliaSearch`
2. ✅ Updated search component to use Algolia types
3. ✅ Removed Pagefind dependencies and build steps
4. ✅ Added Algolia client configuration
5. ✅ Maintained existing UI and functionality

The search interface remains the same for users, but now powered by Algolia's cloud search service.
