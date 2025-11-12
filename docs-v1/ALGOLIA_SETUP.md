# Algolia Search Setup

This documentation site has been migrated from Pagefind to Algolia for search functionality. Follow these steps to set up Algolia search.

## Prerequisites

1. An Algolia account (sign up at [algolia.com](https://www.algolia.com/))
2. An Algolia application with a search index

## Environment Variables

Create a `.env` file in the `docs` directory with the following variables:

```bash
# Required for search functionality
NEXT_PUBLIC_ALGOLIA_APP_ID=your_algolia_app_id
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_algolia_search_api_key
```

## Getting Your Algolia Credentials

1. **App ID**: Found in your Algolia dashboard under "Settings" → "API Keys"
2. **Search API Key**: The public search-only API key from the same location

## Index Configuration

The search hook expects an index named `crawler_mastra crawler` by default. You can customize this by passing `indexName` in the search options:

```typescript
const searchOptions: AlgoliaSearchOptions = {
  indexName: "crawler_mastra crawler",
  hitsPerPage: 20,
  attributesToRetrieve: ["title", "content", "url", "hierarchy"],
  attributesToHighlight: ["title", "content"],
  highlightPreTag: "<mark>",
  highlightPostTag: "</mark>",
};
```

## Indexing Your Content

You'll need to set up a process to index your documentation content. This can be done using:

1. **Algolia Crawler**: Automated web crawling
2. **DocSearch**: Algolia's documentation-specific solution
3. **Custom indexing script**: Using the Algolia API

We currently have a web crawler that indexes the content of the website daily.
