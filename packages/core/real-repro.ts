// Test the real createVectorQueryTool to see if it causes infinite loop
import { createStep } from './src/workflows/workflow';
import { createVectorQueryTool } from '../rag/src/tools/vector-query';

// This replicates the user's exact scenario
const heroUIRagTool = createVectorQueryTool({
  id: "heroui-rag-tool", 
  description: "Search and retrieve reference and guides for using HeroUI",
  indexName: "heroui_docs",
  vectorStoreName: "test_store",
  model: { modelId: "text-embedding-3-small" }, // mock model
  enableFilter: false,
});

// This line should cause the infinite loop if the bug exists
const recallHeroUIRagTool = createStep(heroUIRagTool);