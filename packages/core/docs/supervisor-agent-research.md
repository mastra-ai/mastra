# Supervisor Agent Patterns: Research & Analysis

> Comprehensive research on supervisor agent implementations across AI frameworks

**Created:** February 2026
**Purpose:** Inform Mastra's supervisor pattern enhancements

---

## 1. Executive Summary

This document analyzes supervisor agent patterns across 5 major AI frameworks:

1. **LangGraph** - Graph-based orchestration with explicit routing
2. **CrewAI** - Role-based agents with hierarchical process
3. **AutoGen** - Conversational agents with group chat
4. **OpenAI Swarm** - Lightweight handoff-based coordination
5. **VoltAgent** - Tool-based delegation with bail mechanism

Key findings inform Mastra's approach to enhancing `stream()`/`generate()` as a unified supervisor implementation.

---

## 2. Framework Analysis

### 2.1 LangGraph

**Architecture:** Graph-based state machine with explicit node transitions.

**Supervisor Pattern:**
- Dedicated supervisor node makes routing decisions
- Workers are separate graph nodes
- State passed between nodes via typed state object

```python
# LangGraph Supervisor Pattern
from langgraph.graph import StateGraph, MessagesState

def supervisor_node(state: MessagesState):
    # Supervisor decides which worker to route to
    response = model.invoke([
        SystemMessage(content="Route to: researcher, writer, or FINISH"),
        *state["messages"]
    ])
    return {"next": response.content}

def researcher_node(state: MessagesState):
    # Worker performs specific task
    return {"messages": [research_result]}

# Build graph with conditional edges
graph = StateGraph(MessagesState)
graph.add_node("supervisor", supervisor_node)
graph.add_node("researcher", researcher_node)
graph.add_conditional_edges("supervisor", route_function)
```

**Key Features:**
| Feature | Description |
|---------|-------------|
| Explicit routing | Supervisor explicitly chooses next node |
| State persistence | Built-in checkpointing |
| Conditional edges | Dynamic routing based on state |
| Human-in-the-loop | Interrupt points for approval |

**Strengths:**
- Visual graph representation
- Strong typing with Pydantic
- Built-in persistence

**Weaknesses:**
- Verbose setup for simple cases
- Requires understanding graph concepts

---

### 2.2 CrewAI

**Architecture:** Role-based agents with process orchestration.

**Supervisor Pattern:**
- Hierarchical process with manager agent
- Agents defined with roles, goals, backstories
- Tasks assigned to specific agents

```python
# CrewAI Hierarchical Pattern
from crewai import Agent, Task, Crew, Process

manager = Agent(
    role="Research Manager",
    goal="Coordinate research and writing",
    backstory="Expert at delegating tasks",
    allow_delegation=True
)

researcher = Agent(
    role="Researcher",
    goal="Find accurate information",
    tools=[search_tool]
)

crew = Crew(
    agents=[manager, researcher, writer],
    tasks=[research_task, write_task],
    process=Process.hierarchical,
    manager_agent=manager
)

result = crew.kickoff()
```

**Key Features:**
| Feature | Description |
|---------|-------------|
| Role-based | Agents have roles, goals, backstories |
| Hierarchical process | Manager delegates to workers |
| Allow delegation | Agents can delegate to others |
| Task-based | Work organized as discrete tasks |

**Strengths:**
- Intuitive role metaphor
- Built-in delegation support
- Good for structured workflows

**Weaknesses:**
- Less flexible than graph-based
- Manager overhead for simple tasks

---

### 2.3 AutoGen

**Architecture:** Conversational agents with group chat coordination.

**Supervisor Pattern:**
- GroupChatManager orchestrates conversation
- Agents communicate via messages
- Speaker selection strategies

```python
# AutoGen Group Chat Pattern
from autogen import AssistantAgent, GroupChat, GroupChatManager

supervisor = AssistantAgent(
    name="supervisor",
    system_message="Coordinate the team"
)

researcher = AssistantAgent(
    name="researcher",
    system_message="Research topics"
)

group_chat = GroupChat(
    agents=[supervisor, researcher, writer],
    messages=[],
    max_round=10,
    speaker_selection_method="auto"  # or "round_robin", "random"
)

manager = GroupChatManager(groupchat=group_chat)
supervisor.initiate_chat(manager, message="Write a paper")
```

**Key Features:**
| Feature | Description |
|---------|-------------|
| Group chat | Agents converse in shared context |
| Speaker selection | Various strategies for turn-taking |
| Message history | Full conversation visible to all |
| Nested chats | Sub-conversations between agents |

**Strengths:**
- Natural conversation flow
- Flexible speaker selection
- Good for collaborative tasks

**Weaknesses:**
- Can be unpredictable
- Message history grows large

---

### 2.4 OpenAI Swarm

**Architecture:** Lightweight agent handoffs via tool calls.

**Supervisor Pattern:**
- Agents are functions with instructions
- Handoffs via special tool returns
- Minimal framework overhead

```python
# OpenAI Swarm Pattern
from swarm import Swarm, Agent

def transfer_to_researcher():
    return researcher_agent

def transfer_to_writer():
    return writer_agent

supervisor = Agent(
    name="Supervisor",
    instructions="Route tasks to appropriate agents",
    functions=[transfer_to_researcher, transfer_to_writer]
)

researcher_agent = Agent(
    name="Researcher",
    instructions="Research topics thoroughly",
    functions=[search_web, transfer_to_supervisor]
)

client = Swarm()
response = client.run(agent=supervisor, messages=[{"role": "user", "content": "Write a paper"}])
```

**Key Features:**
| Feature | Description |
|---------|-------------|
| Handoffs | Transfer control via function returns |
| Minimal overhead | Simple Python functions |
| Context variables | Shared state between agents |
| Stateless | No built-in persistence |

**Strengths:**
- Extremely lightweight
- Easy to understand
- No framework lock-in

**Weaknesses:**
- No built-in persistence
- Manual state management
- Limited observability

---

### 2.5 VoltAgent

**Architecture:** Tool-based delegation with supervisor synthesis.

**Supervisor Pattern:**
- Sub-agents exposed as tools
- LLM decides which tools to call
- Bail mechanism for early termination

```typescript
// VoltAgent Supervisor Pattern
import { Agent, createAgent } from "@voltagent/core";

const researcher = createAgent({
  name: "researcher",
  instructions: "Research topics",
  tools: [searchTool]
});

const supervisor = createAgent({
  name: "supervisor",
  instructions: "Coordinate research and writing",
  agents: [researcher, writer],  // Sub-agents become tools

  onAgentComplete: async ({ agent, result, bail }) => {
    // Bail to skip supervisor synthesis
    if (agent.name === "writer" && result.includes("## Conclusion")) {
      bail();  // Return writer output directly
    }
  }
});

const result = await supervisor.chat("Write a paper");
```

**Key Features:**
| Feature | Description |
|---------|-------------|
| Agents as tools | Sub-agents auto-converted to tools |
| Bail mechanism | Skip synthesis when sub-agent completes task |
| Implicit routing | LLM decides via tool calls |
| Token savings | Up to 79% with bail |

**Strengths:**
- Simple mental model
- Significant token savings via bail
- No explicit routing logic needed

**Weaknesses:**
- Less control over routing
- Relies on LLM judgment

---

## 3. Pattern Comparison

### 3.1 Routing Mechanisms

| Framework | Routing Type | Mechanism |
|-----------|--------------|-----------|
| LangGraph | Explicit | Conditional edges in graph |
| CrewAI | Hierarchical | Manager delegates tasks |
| AutoGen | Conversational | Speaker selection |
| Swarm | Handoff | Function return values |
| VoltAgent | Implicit | LLM tool calls |

### 3.2 State Management

| Framework | State Type | Persistence |
|-----------|------------|-------------|
| LangGraph | Typed state object | Built-in checkpointing |
| CrewAI | Task context | Memory modules |
| AutoGen | Message history | Manual |
| Swarm | Context variables | None |
| VoltAgent | Tool context | Optional |

### 3.3 Completion Validation

| Framework | Validation | Mechanism |
|-----------|------------|-----------|
| LangGraph | Conditional edges | Check state conditions |
| CrewAI | Task completion | Task output validation |
| AutoGen | Max rounds | Turn limit |
| Swarm | Agent decision | Agent returns final response |
| VoltAgent | Bail + scoring | External validators |

### 3.4 Token Efficiency

| Framework | Efficiency Feature | Savings |
|-----------|-------------------|---------|
| LangGraph | Targeted routing | Medium |
| CrewAI | Task-specific context | Medium |
| AutoGen | Selective history | Low |
| Swarm | Minimal overhead | High |
| VoltAgent | Bail mechanism | Up to 79% |

---

## 4. Key Patterns Identified

### 4.1 Implicit vs Explicit Routing

**Explicit Routing (LangGraph, CrewAI):**
- Supervisor makes deliberate routing decisions
- More control, more predictable
- Higher latency (extra LLM call for routing)

**Implicit Routing (Swarm, VoltAgent):**
- LLM decides via tool selection
- Simpler, more natural
- Relies on LLM judgment

### 4.2 Completion Scoring

**External Validators:**
- Run after each iteration
- Return pass/fail with reason
- Provide feedback to LLM

**Benefits:**
- Programmatic quality control
- Reusable validation logic
- Clear success criteria

### 4.3 Early Termination (Bail)

**Pattern:**
- Sub-agent produces complete output
- Skip supervisor synthesis
- Return sub-agent output directly

**Benefits:**
- Significant token savings
- Reduced latency
- Direct passthrough of expertise

### 4.4 Context Passing

**Filtered History:**
- Pass relevant context to sub-agents
- Filter out internal messages
- Limit history length

**Benefits:**
- Sub-agents understand full context
- Better coordination
- Reduced token usage

---

## 5. Recommendations for Mastra

Based on this research, Mastra should:

### 5.1 Adopt Tool-based Delegation (Like VoltAgent/Swarm)
- Sub-agents as tools is intuitive
- LLM implicit routing is simpler
- Already implemented in `agents` config

### 5.2 Add Completion Scoring
- External validators for task completion
- Reuse network's `runCompletionScorers`
- Multi-criteria with strategy (all/any)

### 5.3 Implement Bail Mechanism
- Skip synthesis when sub-agent completes task
- `onDelegationComplete` with `bail()` function
- Significant token savings potential

### 5.4 Add Iteration Hooks
- Full control over continuation
- Feedback to LLM on failure
- Custom validation logic

### 5.5 Support Conversation Context for Sub-agents
- Pass filtered message history
- Configure per-agent or globally
- Reuse network's filtering logic

---

## 6. References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [CrewAI Documentation](https://docs.crewai.com/)
- [AutoGen Documentation](https://microsoft.github.io/autogen/)
- [OpenAI Swarm](https://github.com/openai/swarm)
- [VoltAgent Documentation](https://voltagent.dev/docs/)
