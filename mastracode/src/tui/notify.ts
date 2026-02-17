/**
 * Notification utility for alerting the user when the TUI needs attention.
 * Sends a terminal bell and optionally a native OS notification.
 */

import { exec } from "node:child_process"

export type NotificationMode = "bell" | "system" | "both" | "off"

export type NotificationReason =
    | "agent_done"
    | "ask_question"
    | "tool_approval"
    | "plan_approval"
    | "sandbox_access"

/**
 * Send a notification to the user.
 * - "bell": writes \x07 to stdout (terminal bell)
 * - "system": sends a native OS notification (macOS only for now)
 * - "both": bell + system
 * - "off": no-op
 */
export function sendNotification(
    reason: NotificationReason,
    opts: {
        mode: NotificationMode
        message?: string
    },
): void {
    const { mode, message } = opts

    if (mode === "off") return

    if (mode === "bell" || mode === "both") {
        process.stdout.write("\x07")
    }

    if (mode === "system" || mode === "both") {
        sendSystemNotification(reason, message)
    }
}

function sendSystemNotification(
    reason: NotificationReason,
    message?: string,
): void {
    if (process.platform === "darwin") {
        const title = "Mastra Code"
        const body = message || reasonToMessage(reason)
        const escaped = body.replace(/"/g, '\\"')
        exec(
            `osascript -e 'display notification "${escaped}" with title "${title}"'`,
        )
    }
}

function reasonToMessage(reason: NotificationReason): string {
    switch (reason) {
        case "agent_done":
            return "Agent finished — waiting for your input"
        case "ask_question":
            return "Agent has a question for you"
        case "tool_approval":
            return "Tool requires your approval"
        case "plan_approval":
            return "Plan requires your approval"
        case "sandbox_access":
            return "Sandbox access requested"
    }
}
