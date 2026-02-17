/**
 * Global confirmation tracking — used to manage a pending confirmation
 * ID when the TUI needs to coordinate confirmation dialogs with tool
 * execution.
 *
 * This is a minimal stub (the original was also a stub). In TUI mode,
 * confirmation is handled via the tool approval flow in the harness.
 */

let globalConfirmationId: string | null = null

export function setGlobalConfirmationId(id: string | null) {
    globalConfirmationId = id
}

export function getGlobalConfirmationId(): string | null {
    return globalConfirmationId
}
