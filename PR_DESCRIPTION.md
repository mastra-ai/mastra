# feat: add Amazon Bedrock Knowledge Base tool to @mastra/rag

## Description

Adds a new `createBedrockKBTool` factory function to the `@mastra/rag` package that retrieves documents from Amazon Bedrock Knowledge Bases.

- Created `createBedrockKBTool` factory with `execute()` method
- Returns `BedrockKBResult` with content, source, score, metadata
- Supports managed knowledge base type
- Agentic retrieval with fallback to standard Retrieve API
- Uses `@aws-sdk/client-bedrock-agent-runtime`
- Unit tests included
- Added BEDROCK_MANAGED_KB.md design doc
- Updated `packages/rag/src/tools/README.md`

## Related issue(s)

N/A — new feature adding Amazon Bedrock Knowledge Base integration to the RAG tools package.

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [x] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement
- [ ] Test update

## Checklist

- [x] I have linked the related issue(s) in the description above
- [x] I have made corresponding changes to the documentation (if applicable)
- [x] I have added tests that prove my fix is effective or that my feature works
- [ ] I have addressed all Coderabbit comments on this PR
