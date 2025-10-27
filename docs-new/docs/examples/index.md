---
title: Overview
description: "Explore practical examples of AI development with Mastra, including text generation, RAG implementations, structured outputs, and multi-modal interactions. Learn how to build AI applications using OpenAI, Anthropic, and Google Gemini."
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { CardItems } from '@site/src/components/CardItems';

# Examples

The Examples section is a short list of example projects demonstrating basic AI engineering with Mastra, including text generation, structured output, streaming responses, retrieval‐augmented generation (RAG), and voice.

<CardItems
titles={["Agent", "Workflow", "Tool", "legacyWorkflow", "Memory", "RAG", "Evals", "Scorers (Experimental)", "Voice"]}
items={{
    Agent: [
      { title: "Calling Agents", href: "/docs/examples/agents/calling-agents" },
      { title: "Agent System Prompt", href: "/docs/examples/agents/system-prompt" },
      { title: "Agents with Tools", href: "/docs/examples/agents/using-a-tool" },
      { title: "Supervisor Agent", href: "/docs/examples/agents/supervisor-agent" },
      { title: "Image Analysis Agent", href: "/docs/examples/agents/image-analysis" },
      { title: "Voice Agents", href: "/docs/examples/agents/adding-voice-capabilities" },
      { title: "Dynamic Agents", href: "/docs/examples/agents/dynamic-agents" },
      { title: "Deploying an MCPServer", href: "/docs/examples/agents/deploying-mcp-server" },
      { title: "AI SDK v5 Integration", href: "/docs/examples/agents/ai-sdk-v5-integration" },
      { title: "WhatsApp Chat Bot", href: "/docs/examples/agents/whatsapp-chat-bot" }
    ],
    Workflow: [
      { title: "Running Workflows", href: "/docs/examples/workflows/running-workflows" },
      { title: "Sequential Steps", href: "/docs/examples/workflows/sequential-steps" },
      { title: "Parallel Steps", href: "/docs/examples/workflows/parallel-steps" },
      { title: "Conditional Branching", href: "/docs/examples/workflows/conditional-branching" },
      { title: "Array as Input", href: "/docs/examples/workflows/array-as-input" },
      { title: "Calling an Agent", href: "/docs/examples/workflows/calling-agent" },
      { title: "Agent as Step", href: "/docs/examples/workflows/agent-as-step" },
      { title: "Tool as Step", href: "/docs/examples/workflows/tool-as-step" },
      { title: "Human in the Loop", href: "/docs/examples/workflows/human-in-the-loop" },
      { title: "Multi-Turn Human in the Loop", href: "/docs/examples/workflows/human-in-the-loop-multi-turn" },
      { title: "Inngest Workflow", href: "/docs/examples/workflows/inngest-workflow" }
    ],
    Tool: [
      { title: "Calling Tools", href: "/docs/examples/tools/calling-tools" },
      { title: "Dynamic Tools", href: "/docs/examples/tools/dynamic-tools" },
      { title: "Tools with Workflows", href: "/docs/examples/tools/workflow-as-tools" }
    ],
    legacyWorkflow: [
      { title: "Creating a Workflow", href: "/docs/examples/workflows_legacy/creating-a-workflow" },
      { title: "Sequential Steps", href: "/docs/examples/workflows_legacy/sequential-steps" },
      { title: "Parallel Steps", href: "/docs/examples/workflows_legacy/parallel-steps" },
      { title: "Branching Paths", href: "/docs/examples/workflows_legacy/branching-paths" },
      { title: "Conditional Branching", href: "/docs/examples/workflows_legacy/conditional-branching" },
      { title: "Calling an Agent", href: "/docs/examples/workflows_legacy/calling-agent" },
      { title: "Using a Tool as a Step", href: "/docs/examples/workflows_legacy/using-a-tool-as-a-step" },
      { title: "Cyclical Dependencies", href: "/docs/examples/workflows_legacy/cyclical-dependencies" },
      { title: "Workflow Variables", href: "/docs/examples/workflows_legacy/workflow-variables" }
    ],
    Memory: [
      { title: "Basic Working Memory", href: "/docs/examples/memory/working-memory-basic" },
      { title: "Memory with Template", href: "/docs/examples/memory/working-memory-template" },
      { title: "Memory with Schema", href: "/docs/examples/memory/working-memory-schema" },
      { title: "Memory with LibSQL", href: "/docs/examples/memory/memory-with-libsql" },
      { title: "Memory with PostgreSQL", href: "/docs/examples/memory/memory-with-pg" },
      { title: "Memory with Upstash", href: "/docs/examples/memory/memory-with-upstash" },
      { title: "Memory with Mem0", href: "/docs/examples/memory/memory-with-mem0" },
      { title: "Memory Processors", href: "/docs/examples/memory/memory-processors" }
    ],
    RAG: [
      { title: "Chunk Text", href: "/docs/examples/rag/chunking/chunk-text" },
      { title: "Chunk Markdown", href: "/docs/examples/rag/chunking/chunk-markdown" },
      { title: "Chunk HTML", href: "/docs/examples/rag/chunking/chunk-html" },
      { title: "Chunk JSON", href: "/docs/examples/rag/chunking/chunk-json" },
      { title: "Adjust Chunk Size", href: "/docs/examples/rag/chunking/adjust-chunk-size" },
      { title: "Adjust Chunk Delimiters", href: "/docs/examples/rag/chunking/adjust-chunk-delimiters" },
      { title: "Embed Text Chunk", href: "/docs/examples/rag/embedding/embed-text-chunk" },
      { title: "Embed Chunk Array", href: "/docs/examples/rag/embedding/embed-chunk-array" },
      { title: "Embed Text with Cohere", href: "/docs/examples/rag/embedding/embed-text-with-cohere" },
      { title: "Metadata Extraction", href: "/docs/examples/rag/embedding/metadata-extraction" },
      { title: "Upsert Embeddings", href: "/docs/examples/rag/upsert/upsert-embeddings" },
      { title: "Using the Vector Query Tool", href: "/docs/examples/rag/usage/basic-rag" },
      { title: "Optimizing Information Density", href: "/docs/examples/rag/usage/cleanup-rag" },
      { title: "Metadata Filtering", href: "/docs/examples/rag/usage/filter-rag" },
      { title: "Chain of Thought Prompting", href: "/docs/examples/rag/usage/cot-rag" },
      { title: "Structured Reasoning with Workflows", href: "/docs/examples/rag/usage/cot-workflow-rag" },
      { title: "Graph RAG", href: "/docs/examples/rag/usage/graph-rag" }
    ],
    Evals: [
      { title: "Answer Relevancy", href: "/docs/examples/evals/answer-relevancy" },
      { title: "Bias", href: "/docs/examples/evals/bias" },
      { title: "Completeness", href: "/docs/examples/evals/completeness" },
      { title: "Content Similarity", href: "/docs/examples/evals/content-similarity" },
      { title: "Context Position", href: "/docs/examples/evals/context-position" },
      { title: "Context Precision", href: "/docs/examples/evals/context-precision" },
      { title: "Context Relevancy", href: "/docs/examples/evals/context-relevancy" },
      { title: "Contextual Recall", href: "/docs/examples/evals/contextual-recall" },
      { title: "Faithfulness", href: "/docs/examples/evals/faithfulness" },
      { title: "Hallucination", href: "/docs/examples/evals/hallucination" },
      { title: "Keyword Coverage", href: "/docs/examples/evals/keyword-coverage" },
      { title: "Prompt Alignment", href: "/docs/examples/evals/prompt-alignment" },
      { title: "Summarization", href: "/docs/examples/evals/summarization" },
      { title: "Textual Difference", href: "/docs/examples/evals/textual-difference" },
      { title: "Tone Consistency", href: "/docs/examples/evals/tone-consistency" },
      { title: "Toxicity", href: "/docs/examples/evals/toxicity" },
      { title: "LLM as a Judge", href: "/docs/examples/evals/custom-llm-judge-eval" },
      { title: "Native JavaScript", href: "/docs/examples/evals/custom-native-javascript-eval" }
    ],
    "Scorers (Experimental)": [
      { title: "Custom Scorer", href: "/docs/examples/scorers/custom-scorer" },
      { title: "Answer Relevancy", href: "/docs/examples/scorers/answer-relevancy" },
      { title: "Answer Similarity", href: "/docs/examples/scorers/answer-similarity" },
      { title: "Bias", href: "/docs/examples/scorers/bias" },
      { title: "Completeness", href: "/docs/examples/scorers/completeness" },
      { title: "Content Similarity", href: "/docs/examples/scorers/content-similarity" },
      { title: "Faithfulness", href: "/docs/examples/scorers/faithfulness" },
      { title: "Hallucination", href: "/docs/examples/scorers/hallucination" },
      { title: "Keyword Coverage", href: "/docs/examples/scorers/keyword-coverage" },
      { title: "Textual Difference", href: "/docs/examples/scorers/textual-difference" },
      { title: "Tone Consistency", href: "/docs/examples/scorers/tone-consistency" },
      { title: "Toxicity", href: "/docs/examples/scorers/toxicity" },
      { title: "Noise Sensitivity", href: "/docs/examples/scorers/noise-sensitivity" },
      { title: "Prompt Alignment", href: "/docs/examples/scorers/prompt-alignment" },
      { title: "Tool Call Accuracy", href: "/docs/examples/scorers/tool-call-accuracy" },
      { title: "Context Relevance", href: "/docs/examples/scorers/context-relevance" },
      { title: "Context Precision", href: "/docs/examples/scorers/context-precision" },
    ],
    Voice: [
      { title: "Text to Speech", href: "/docs/examples/voice/text-to-speech" },
      { title: "Speech to Text", href: "/docs/examples/voice/speech-to-text" },
      { title: "Turn Taking", href: "/docs/examples/voice/turn-taking" },
      { title: "Speech to Speech", href: "/docs/examples/voice/speech-to-speech" }
    ]
  }}
/>
