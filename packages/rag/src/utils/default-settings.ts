export const defaultVectorQueryDescription = () =>
  `Access the knowledge base to find information needed to answer user questions.`;

export const defaultGraphRagDescription = () =>
  `Access and analyze relationships between information in the knowledge base to answer complex questions about connections and patterns.`;

export const topKDescription = `Controls how many matching documents to return.
- Must be a valid number
- Uses provided value if specified
- Default: 10 results
- Higher values provide more context
- Lower values focus on best matches
- Based on query requirements`;

export const filterDescription = `JSON-formatted criteria to refine search results.
- Must be valid JSON format
- Uses provided filter if specified
- Default: "{}" (no filtering)
- Example: '{"category": "health"}'
- Based on query intent
- Multiple filters can be combined`;
