import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { ElasticSearchVector } from '@mastra/elasticsearch';
import { introspectIndices } from '../tools/introspect-indices';
import { executeSearch } from '../tools/execute-search';
import { getKibanaMcpTools } from '../mcp/kibana-mcp-client';
import { esClient } from '../lib/elasticsearch-client';
import { createEmbedder } from '../lib/embedder-config';

const localTools = { introspectIndices, executeSearch };

const kibanaMcpTools = await getKibanaMcpTools();
const hasKibanaTools = Object.keys(kibanaMcpTools).length > 0;

// Log Kibana MCP status
if (hasKibanaTools) {
  const toolCount = Object.keys(kibanaMcpTools).length;
  console.log(`[Kibana MCP] Enabled with ${toolCount} tool${toolCount !== 1 ? 's' : ''}: ${Object.keys(kibanaMcpTools).join(', ')}`);
} else {
  console.log('[Kibana MCP] Not configured. Set KIBANA_MCP_URL to enable additional tools.');
}

const kibanaToolsInstruction = hasKibanaTools
  ? `

## Kibana MCP Tools

You also have access to additional tools from Kibana's MCP server. These may include tools for:
- Running ES|QL queries
- Managing indices
- Accessing Kibana features
- Accessing O11y or Security features depending on the Elastic project type

Use these tools when they provide functionality not covered by the built-in tools.`
  : '';

const embedder = createEmbedder();

// Only configure memory if embedder is available
const memory = embedder
  ? new Memory({
      vector: new ElasticSearchVector({
        id: 'elasticsearch-memory-vector',
        client: esClient,
      }),
      embedder,
      options: {
        semanticRecall: true,
        lastMessages: 10,
      },
    })
  : undefined;

/**
 * AI agent for querying Elasticsearch clusters using natural language.
 * Includes schema introspection, hybrid search, and optional Kibana MCP tools.
 */
export const elasticsearchAgent = new Agent({
  id: 'elasticsearch-agent',
  name: 'Elasticsearch Agent',
  model: 'openai/gpt-5.4',
  instructions: `You are an Elasticsearch assistant that helps users explore and query their Elasticsearch cluster using natural language.

## Tools

You have the following tools:

- **introspect-indices**: Returns information about all indices in the cluster, including field mappings (names and types) and stats (document count, size). Use an optional indexPattern to filter specific indices.

- **execute-search**: Executes hybrid search queries combining full-text (BM25) and semantic search using RRF fusion. Returns documents with _id, _index, _score, and source fields.
${kibanaToolsInstruction}

## Workflow

1. When the user asks about the cluster or available data, call introspect-indices to understand what indices and fields exist.
2. Before searching, identify the correct index and field names from the schema.
3. For searches, determine the appropriate textField (and optionally vectorField for semantic search).
4. Execute the search and present results with proper citations.

## Search Guidelines

- Always call introspect-indices first if you don't know the schema.
- Use the textField parameter for the main searchable text field (e.g., "message", "content", "title").
- If a semantic_text field exists, use it as vectorField for hybrid search.
- Apply filters for narrowing results (e.g., status, category, date ranges).

## Citation Format

When presenting search results, ALWAYS cite the source documents:

1. Include the document _id for each piece of information
2. Reference the specific field the data came from
3. Include the index name for context

Example citation format:
> "The server returned a timeout error" (index: logs-2024.01, _id: abc123, field: message)

For summaries across multiple documents:
> Found 3 errors related to timeouts:
> - "Connection timeout after 30s" [logs-2024.01/_id:abc123]
> - "Request timeout exceeded" [logs-2024.01/_id:def456]
> - "Gateway timeout" [logs-2024.01/_id:ghi789]

## Response Guidelines

- Be concise but informative.
- Always cite sources when presenting data from search results.
- Explain your search strategy when relevant.
- If no results are found, suggest alternative queries or filters.`,
  tools: { ...localTools, ...kibanaMcpTools },
  memory,
});
