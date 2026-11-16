import type { RuleFacts } from '../rules/rule-group.js';
import type { StoredBoardScope } from '../storage/domains/boards/base.js';

/** What one provider's lookup found for a URL. */
export type IntakeLookupResult =
  /** Read once from the provider: the facts intake would test of it had it just arrived. */
  | { status: 'found'; title: string; url: string; facts: RuleFacts }
  /** The URL is this provider's, but names a repository or team not linked to the project. Nothing was fetched. */
  | { status: 'not_linked' }
  /** The linked source has no such item, or it couldn't be read. */
  | { status: 'not_found' };

/**
 * Reads one issue or pull request by URL from a source linked to the project, with the project's
 * own credentials, for the intake tester. Never writes, never records anything.
 */
export interface IntakeItemLookup {
  /** Undefined when the URL isn't this provider's. */
  lookup(scope: StoredBoardScope, url: string): Promise<IntakeLookupResult | undefined>;
}

/** Asks each lookup in turn; `unsupported` when none knows the URL. */
export async function lookupIntakeItem(
  lookups: readonly IntakeItemLookup[],
  scope: StoredBoardScope,
  url: string,
): Promise<IntakeLookupResult | { status: 'unsupported' }> {
  for (const lookup of lookups) {
    const result = await lookup.lookup(scope, url);
    if (result) return result;
  }
  return { status: 'unsupported' };
}
