/**
 * Factory's own GitHub identity.
 *
 * Factory must recognise its own writes, or it wakes itself: a handoff comment
 * arrives back through ingress, fires the rule that authored it, and cancels the
 * run mid-flight. Every self-loop guard depends on answering "is this me?".
 *
 * The answer is not free. On a Platform deployment the credentials that post as
 * `mastra-platform[bot]` do not carry that login, and `GITHUB_APP_SLUG`
 * describes a *different*, self-hosted App — so it is legitimately unset. A bare
 * `login === `${slug}[bot]`` therefore compares against `undefined[bot]`, never
 * matches, and silently disables every guard while looking correct.
 *
 * Two sources, in order of trust:
 *
 * 1. **Observed.** Every comment Factory creates comes back with its author.
 *    That is authoritative, costs no extra request, and needs no configuration —
 *    Factory learns its own name the first time it speaks.
 * 2. **Configured.** `slug` from a self-hosted GitHub App, when present.
 *
 * When neither is available the identity is *unknown*, which is distinct from
 * "not Factory". Callers must handle it explicitly rather than inherit a `false`.
 */
export class GithubAppIdentity {
  #configuredLogin: string | undefined;
  #observedLogin: string | undefined;

  constructor(slug?: string) {
    const trimmed = slug?.trim();
    this.#configuredLogin = trimmed ? `${trimmed.toLowerCase()}[bot]` : undefined;
  }

  /** The login Factory posts as, or `undefined` when it cannot be determined. */
  get login(): string | undefined {
    return this.#observedLogin ?? this.#configuredLogin;
  }

  /** True once Factory can recognise its own writes. */
  get known(): boolean {
    return this.login !== undefined;
  }

  /**
   * Record the author GitHub reported for a write Factory just made. Observed
   * identity wins over configuration: it is what GitHub actually attributes the
   * write to, whereas the slug is a claim about a possibly-different App.
   */
  observeSelfAuthor(login: string | null | undefined): void {
    const trimmed = login?.trim().toLowerCase();
    if (trimmed) this.#observedLogin = trimmed;
  }

  /**
   * Whether `login` is Factory. Returns `false` when the identity is unknown —
   * callers that must not fail open should check {@link known} first.
   */
  matches(login: string | null | undefined): boolean {
    const self = this.login;
    if (!self || !login) return false;
    return login.trim().toLowerCase() === self;
  }
}
