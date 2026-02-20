// Stub for confirmation tracking - not used in TUI mode

let globalConfirmationId: string | null = null;

export function setGlobalConfirmationId(id: string | null) {
  globalConfirmationId = id;
}

export function getGlobalConfirmationId(): string | null {
  return globalConfirmationId;
}
