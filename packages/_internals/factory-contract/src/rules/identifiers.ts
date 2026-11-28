// Browser-safe: part of @internal/factory-contract, which Factory's server and UIs share.

export const MAX_BOARD_IDENTIFIER_LENGTH = 128;
export const IDENTIFIER_RE = /^[a-z0-9][a-z0-9_-]*$/i;
export const BOARD_IDENTIFIER_RE = IDENTIFIER_RE;
