# LLM Context Files

**DO NOT EDIT THESE FILES** - They are read-only reference for AI coding assistants.

## Files

| File             | JSON Config        | Purpose                                   |
| ---------------- | ------------------ | ----------------------------------------- |
| `agentcore.ts`   | `agentcore.json`   | Project, agent, memory, credential config |
| `mcp.ts`         | `agentcore.json`   | Gateways, targets, MCP runtime tools      |
| `aws-targets.ts` | `aws-targets.json` | Deployment targets (account + region)     |

## Usage

When editing schema JSON files, reference the corresponding `.ts` file here for type definitions and validation
constraints (marked with `@regex`, `@min`, `@max`).
