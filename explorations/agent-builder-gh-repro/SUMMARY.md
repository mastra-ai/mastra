# GitHub Issue Reproduction Agent - Project Summary

## Overview
This project creates an agent that can automatically reproduce GitHub issues using the Mastra AgentBuilder framework. The agent fetches issue details using the GitHub CLI (`gh`) and creates minimal reproductions in isolated temporary directories.

## Current Architecture

### Core Components

1. **AgentBuilder Integration** (`src/agent.ts`)
   - Uses `@mastra/agent-builder` to create a code-editing agent
   - Configured with enhanced instructions for GitHub issue reproduction
   - Uses LibSQLStore for memory/conversation persistence
   - Creates isolated temp directories for each issue (e.g., `/tmp/mastra-repros/gh-repro-owner-repo-123`)

2. **Interactive Chat System** (`src/chat.ts`)
   - Currently using `startInteractiveChat` function with while(true) loop
   - Handles Ctrl+C for aborting streams gracefully
   - Integrates MCP docs server for Mastra documentation access
   - Manages conversation memory with thread IDs based on issue slugs

3. **CLI Interface** (`src/index.ts`)
   - Command: `gh-repro <issue-url>`
   - Validates gh CLI installation
   - Passes issue URL to chat system

4. **Instructions** (`src/instructions.ts`)
   - Detailed prompts for the agent on how to reproduce issues
   - Includes gh CLI usage examples
   - Enhanced with project path context

## What We're Doing Now

### Migration to Mastra Workflows
We're converting the current while(true) chat loop into a proper Mastra workflow to:
- Better handle conversation state management
- Support suspend/resume for long-running reproductions
- Enable more complex control flow patterns
- Integrate with Mastra's workflow execution engine

### Workflow Structure (`src/workflow.ts`)
The new workflow consists of four main steps:

1. **checkConversationStep**
   - Checks if a conversation already exists in memory
   - Returns `hasConversation` boolean and existing messages

2. **initializeProjectStep**
   - Only runs for new conversations
   - Creates temp directory structure
   - Uses manageProject tool to scaffold initial files

3. **initialDiscoveryStep**
   - Only runs for new conversations
   - Fetches and analyzes the GitHub issue
   - Creates a reproduction plan

4. **chatLoopStep**
   - Interactive chat with user
   - Uses `dountil` pattern for recursive execution
   - Handles exit commands and abort signals

### Current Issues
- **Type Mismatch**: Workflow steps use different parameter structure than we initially implemented
  - Steps receive `ExecuteFunctionParams` with properties like `inputData`, `getStepResult`, etc.
  - Need to refactor step definitions to match the correct interface

### Next Steps
1. Fix step parameter types to match workflow requirements
2. Update step execution logic to use correct context
3. Integrate workflow with existing chat system
4. Test end-to-end workflow execution
5. Remove old while(true) loop implementation

## Key Features
- **GitHub CLI Integration**: Uses `gh` CLI instead of deprecated @mastra/github
- **Isolated Environments**: Each issue gets its own temp directory
- **Memory Persistence**: Conversations are saved and can be resumed
- **Stream Abort**: Ctrl+C gracefully aborts current stream without exiting
- **MCP Docs Access**: Agent can query Mastra documentation

## Dependencies
- `@mastra/core`: Core Mastra framework
- `@mastra/agent-builder`: Agent creation with code editing capabilities
- `@mastra/memory`: Conversation memory management
- `@mastra/libsql`: SQLite storage for persistence
- `@mastra/mcp`: Model Context Protocol for docs access
- `@ai-sdk/openai`: OpenAI model integration
- `commander`: CLI argument parsing
- `chalk`: Terminal styling
- `ora`: Loading spinners