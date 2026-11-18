import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';

/**
 * What people paste to name an issue or pull request, turned into the key its card's source
 * stores (see the provider adapters in `./providers`): `owner/repo#12` for a GitHub issue or pull
 * request, `group/project#3` and `group/project!7` for a GitLab issue and merge request, and the
 * tracker identifier (`ENG-42`) for Linear, Jira and incident.io.
 */
const GITLAB_MERGE_REQUEST_URL = /^https?:\/\/[^/\s]+\/(.+?)\/-\/merge_requests\/(\d+)(?:[/?#]|$)/i;
const GITLAB_ISSUE_URL = /^https?:\/\/[^/\s]+\/(.+?)\/-\/(?:issues|work_items)\/(\d+)(?:[/?#]|$)/i;
const GITHUB_URL = /^https?:\/\/[^/\s]+\/([^/\s]+\/[^/\s]+)\/(?:issues|pull)\/(\d+)(?:[/?#]|$)/i;
/** Linear (`/<workspace>/issue/ENG-42/<slug>`) and Jira (`/browse/OPS-3`) issue links. */
const TRACKER_URL = /^https?:\/\/[^/\s]+\/(?:[^\s]*\/)?(?:issue|browse)\/([a-z][a-z0-9]*-\d+)(?:[/?#]|$)/i;
/** `owner/repo#12`, `group/sub/project!7`. */
const REPOSITORY_SHORTHAND = /^[\w.-]+(?:\/[\w.-]+)+[#!]\d+$/;
const TRACKER_IDENTIFIER = /^[a-z][a-z0-9]*-\d+$/i;
const URL = /^https?:\/\/\S+$/i;

/** The source key a link or shorthand names, or null when it names no issue or pull request. */
export function sourceKeyFromReference(reference: string): string | null {
  const ref = reference.trim();
  const mergeRequest = GITLAB_MERGE_REQUEST_URL.exec(ref);
  if (mergeRequest) return `${mergeRequest[1]}!${mergeRequest[2]}`;
  const gitlabIssue = GITLAB_ISSUE_URL.exec(ref);
  if (gitlabIssue) return `${gitlabIssue[1]}#${gitlabIssue[2]}`;
  const github = GITHUB_URL.exec(ref);
  if (github) return `${github[1]}#${github[2]}`;
  const tracker = TRACKER_URL.exec(ref);
  if (tracker) return tracker[1]!;
  if (REPOSITORY_SHORTHAND.test(ref) || TRACKER_IDENTIFIER.test(ref)) return ref;
  return null;
}

/** Whether `reference` is a link or shorthand a card can be found by: a source key, or any other http(s) link. */
export function isSourceReference(reference: string): boolean {
  return sourceKeyFromReference(reference) !== null || URL.test(reference.trim());
}

/** A link without its query, its anchor, its trailing slashes or its case, which name no other issue or pull request. */
export function normalizedUrl(url: string): string {
  return url
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

type SourcedCard = { workItem: { sources?: readonly Pick<WorkItemSourceRow, 'key' | 'url'>[] } };

/**
 * Whether `source` is the issue or pull request `reference` names: by source key, which ignores
 * the rest of a link (`/files`, a comment anchor), or for other links by the link itself.
 */
export function sourceMatchesReference(source: Pick<WorkItemSourceRow, 'key' | 'url'>, reference: string): boolean {
  const key = sourceKeyFromReference(reference);
  if (key !== null) return source.key !== null && source.key.toLowerCase() === key.toLowerCase();
  return URL.test(reference.trim()) && source.url !== null && normalizedUrl(source.url) === normalizedUrl(reference);
}

/** The card's own issue or pull request (its first source) is the one `reference` names. */
export function isCardFor(card: SourcedCard, reference: string): boolean {
  const own = card.workItem.sources?.[0];
  return own !== undefined && sourceMatchesReference(own, reference);
}

/** The card carries the issue or pull request `reference` names, as its own source or an attached one. */
export function cardCarries(card: SourcedCard, reference: string): boolean {
  return (card.workItem.sources ?? []).some(source => sourceMatchesReference(source, reference));
}
