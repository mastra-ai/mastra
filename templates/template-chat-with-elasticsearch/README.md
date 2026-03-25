# Elasticsearch Chat Template

A Mastra template for building conversational AI agents that interact with Elasticsearch clusters using natural language.
This template uses Elasticsearch/Elastic for querying data, agent memory (with Elastic Inference Service for embeddings), observability (Elastic APM), and enhanced tooling (Kibana MCP).

## Getting Started

This template works with:
- **[Local Elasticsearch](https://www.elastic.co/docs/deploy-manage/deploy/self-managed/local-development-installation-quickstart)** - Run Elasticsearch locally for development
- **Serverless Elasticsearch** - Fully managed, auto-scaling projects
- **Elastic Cloud Hosted (ECH)** - Self-managed cloud deployments

[Sign up for a free Elastic Cloud trial](https://cloud.elastic.co/registration) to get started with cloud deployments.

### Using Observability Projects

To export traces to Elastic APM, create an **Observability** project (which includes Elasticsearch). This gives you:
- Elasticsearch for data storage and search
- APM for trace collection and visualization
- Pre-configured integration for seamless observability

### Free Elastic Inference Service (EIS)

Trial deployments include free token limits for [Elastic Inference Service](https://www.elastic.co/docs/explore-analyze/elastic-inference/eis#rate-limits), allowing you to use hosted embedding models without additional costs during evaluation.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| **Embedder Configuration** ||||
| `EMBEDDER_PROVIDER` | No | - | Embedder provider: `openai` or `elastic`. Leave empty to disable memory. |
| `OPENAI_API_KEY` | If `openai` | - | OpenAI API key for embeddings and LLM. |
| `OPENAI_EMBEDDING_MODEL` | No | `openai/text-embedding-3-small` | OpenAI embedding model to use. |
| `ELASTIC_INFERENCE_ID` | If `elastic` | `jina-embeddings-v5-text-small` | Elasticsearch Inference endpoint ID. |
| **Elasticsearch Configuration** ||||
| `ELASTICSEARCH_URL` | Yes | `http://localhost:9200` | Elasticsearch cluster endpoint. |
| `ELASTICSEARCH_API_KEY` | No | - | API key for Elasticsearch authentication. |
| **Optional Integrations** ||||
| `KIBANA_MCP_URL` | No | - | Kibana MCP server URL for additional tools. |
| `ELASTIC_APM_ENDPOINT` | No | - | Elastic APM endpoint for trace export. |
| `ELASTIC_APM_SECRET_TOKEN` | No | - | APM authentication token (sent as `ApiKey`). |
