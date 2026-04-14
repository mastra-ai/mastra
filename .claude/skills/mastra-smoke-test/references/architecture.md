# Architecture Overview

For detailed internal architecture documentation, see the Notion page:
**[Architecture Overview](https://www.notion.so/33bebffbc9f8816280b8eb09c72fed4f)**

## High-Level Summary

When you deploy a Studio or Server to Mastra platform:

1. **Deploy** → CLI sends your project to platform services
2. **Token** → Platform signs a JWT for your deployment
3. **Traces** → Your deployment sends traces using that token
4. **Storage** → Traces are stored and queryable in Studio UI

## Key Points for Testing

- Both Studio and Server deploys generate traces
- Traces should appear in Studio's Observability tab
- If traces don't appear, check deploy logs for warnings

## Troubleshooting

If you have GCP access and need to debug infrastructure issues, see the internal docs in Notion.
