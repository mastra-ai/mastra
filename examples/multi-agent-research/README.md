# Multi-Agent Research Assistant

A multi-agent pipeline that demonstrates sequential agent handoff in Mastra.

## Architecture

User Input → Researcher Agent → Writer Agent → Final Report

## Agents

- **Researcher** - Gathers detailed information on any topic
- **Writer** - Transforms research into a structured report

## Prerequisites

- Node.js 18+
- Free [Groq API key](https://console.groq.com)

## Setup
```bash
cd examples/multi-agent-research
pnpm install --ignore-workspace
cp .env.example .env
# Add your GROQ_API_KEY to .env
```

## Run
```bash
# Default topic
pnpm dev

# Custom topic
npx tsx src/index.ts "the future of quantum computing"
```

## Key Concepts Demonstrated

- Sequential multi-agent handoff
- Agent output as input to next agent
- Separation of concerns between agents
- Free LLM provider (Groq) setup
