/**
 * MastraCode-specific event types.
 *
 * These extend the core HarnessEvent union with subagent lifecycle
 * and UI interaction events. Passed as TCustomEvent to Harness<>.
 */
import type { HarnessEvent } from "@mastra/core/harness"

// =============================================================================
// Subagent Events
// =============================================================================

/**
 * Subagent lifecycle events — emitted by the `subagent` tool
 * when delegating focused tasks to constrained agents.
 */
export type SubagentEvent =
    | {
        type: "subagent_start"
        toolCallId: string
        agentType: string
        task: string
        modelId?: string
    }
    | {
        type: "subagent_tool_start"
        toolCallId: string
        agentType: string
        subToolName: string
        subToolArgs: unknown
    }
    | {
        type: "subagent_tool_end"
        toolCallId: string
        agentType: string
        subToolName: string
        subToolResult: unknown
        isError: boolean
    }
    | {
        type: "subagent_text_delta"
        toolCallId: string
        agentType: string
        textDelta: string
    }
    | {
        type: "subagent_end"
        toolCallId: string
        agentType: string
        result: string
        isError: boolean
        durationMs: number
    }
    | {
        type: "subagent_model_changed"
        modelId: string
        scope: "global" | "thread"
        agentType: string
    }

// =============================================================================
// UI Events
// =============================================================================

/**
 * UI interaction events — emitted by mastracode-specific tools
 * (todo_write, ask_user, submit_plan, request_sandbox_access).
 */
export type UIEvent =
    | {
        type: "todo_updated"
        todos: Array<{
            content: string
            status: "pending" | "in_progress" | "completed"
            activeForm: string
        }>
    }
    | {
        type: "ask_question"
        questionId: string
        question: string
        options?: Array<{ label: string; description?: string }>
    }
    | {
        type: "sandbox_access_request"
        questionId: string
        path: string
        reason: string
    }
    | {
        type: "plan_approval_required"
        planId: string
        title: string
        plan: string
    }
    | { type: "plan_approved" }

// =============================================================================
// Composite Event Types
// =============================================================================

/**
 * Custom events specific to MastraCode — subagent lifecycle + UI interactions.
 * Passed as the TCustomEvent parameter to the Harness generic.
 */
export type MastraCodeCustomEvent = SubagentEvent | UIEvent

/**
 * Full event union for MastraCode — core HarnessEvent + custom events.
 * This is the type that listeners receive.
 */
export type MastraCodeEvent = HarnessEvent | MastraCodeCustomEvent
