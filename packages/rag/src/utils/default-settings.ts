export const defaultTopK = `You MUST generate for each query:
    topK: number of results to return (REQUIRED) (Default: 10)
        - Generate topK based on exactly what user specifies
        - must be a valid number

    Notes: 
    - If user provides a valid topK, use the topK provided
    - If user does not specify topK or provides an invalid topK, use default topK: 10
`;

export const defaultFilter = `You MUST generate for each query:
    filter: query filter (REQUIRED) (Default: {})
        - Generate filter based on user's explicit query intent
        - Must be valid JSON string

    Notes: 
    - If user provides a valid filter, use the filter provided
    - If user does not specify filter or provides an invalid filter, use default filter: {}
`;

export const defaultVectorQueryDescription = (vectorStoreName: string, indexName: string) =>
  `Retrieves relevant information from ${vectorStoreName} using ${indexName} index.

    ${defaultTopK}
    ${defaultFilter}
    `;

export const defaultGraphRagDescription = (vectorStoreName: string, indexName: string) =>
  `Fetches and reranks the most relevant chunks using GraphRAG from the ${vectorStoreName} vector store using the ${indexName} index.

    ${defaultTopK}
    ${defaultFilter}
    `;
