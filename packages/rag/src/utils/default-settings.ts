export const defaultVectorQueryDescription = () =>
  `Access the knowledge base to find information needed to answer user questions.`;

export const defaultGraphRagDescription = () =>
  `Access and analyze relationships between information in the knowledge base to answer complex questions about connections and patterns.`;

export const queryDescription = `The text query to search for in the vector database.
- ALWAYS provide a non-empty query string
- Must contain the user's question or search terms
- Example: "market data" or "financial reports"
- If the user's query is about a specific topic, use that topic as the queryText
- Cannot be an empty string
- Do not include quotes, just the text itself
- Required for all searches`;

export const topKDescription = `Controls how many matching documents to return.
- ALWAYS provide a value
- If no value is provided, use the default (10)
- Must be a valid and positive number
- Cannot be NaN
- Uses provided value if specified
- Default: 10 results (use this if unsure)
- Higher values (like 20) provide more context
- Lower values (like 3) focus on best matches
- Based on query requirements`;

export const filterDescription = `JSON-formatted criteria to refine search results.
- ALWAYS provide a filter value
- If no filter is provided, use the default ("{}")
- MUST be a valid, complete JSON object with proper quotes and brackets
- Uses provided filter if specified
- Default: "{}" (no filtering)
- Example for no filtering: "filter": "{}"
- Example: '{"category": "health"}'
- Based on query intent
- Do NOT use single quotes or unquoted properties
- IMPORTANT: Always ensure JSON is properly closed with matching brackets
- Multiple filters can be combined`;
