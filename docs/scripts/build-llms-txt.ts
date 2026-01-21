import path from "path";
import fs from "fs/promises";

const DOCS_DIR = path.join(process.cwd(), "src", "content", "en");
const OUTPUT_DIR = path.join(process.cwd(), "static");
const OUTPUT_FILENAME = "llms.txt";
const PREFIX_BLOCK = `# Mastra

Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

Some of its highlights include: Model routing, agents, workflows, human-in-the-loop, context management, and MCP.

The documentation is organized into key sections:

- [**Docs**](https://mastra.ai/docs): Core documentation covering concepts, features, and implementation details
- [**Models**](https://mastra.ai/models): Mastra provides a unified interface for working with LLMs across multiple providers
- [**Guides**](https://mastra.ai/guides): Step-by-step tutorials for building specific applications
- [**Reference**](https://mastra.ai/reference): API reference documentation

Each section contains detailed markdown files that provide comprehensive information about Mastra's features and how to use them effectively.`;
