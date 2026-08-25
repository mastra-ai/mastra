/** Wire-stable `Error.name`: the server flattens errors to `{ name, message }`, so hosts match on this. */
export const PROVIDER_AUTH_REQUIRED_ERROR = 'ProviderAuthRequiredError';

/**
 * A provider credential is missing or no longer usable. The message states the
 * fact only — how the user re-authenticates is the host's call (`/login` in the
 * TUI, Settings → Models in the factory web UI), so no host advertises a
 * command another host doesn't have.
 */
export class ProviderAuthRequiredError extends Error {
  readonly name = PROVIDER_AUTH_REQUIRED_ERROR;
}
