import { describe, expect, it } from 'vitest';

import { parseGitlabWebhook } from './webhook.js';

const project = { id: 42, path_with_namespace: 'acme/widgets' };

function issueDelivery(overrides: Record<string, unknown> = {}) {
  return {
    object_kind: 'issue',
    user: { username: 'reporter' },
    project,
    object_attributes: {
      iid: 7,
      title: 'Widget falls over',
      url: 'https://gitlab.com/acme/widgets/-/issues/7',
      state: 'opened',
      action: 'open',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      labels: [{ title: 'bug' }],
      assignees: [{ username: 'dev' }],
      ...overrides,
    },
  };
}

function noteDelivery(overrides: Record<string, unknown> = {}) {
  return {
    object_kind: 'note',
    user: { username: 'commenter' },
    project,
    object_attributes: {
      id: 900,
      note: 'Still broken.',
      noteable_type: 'Issue',
      url: 'https://gitlab.com/acme/widgets/-/issues/7#note_900',
      created_at: '2026-01-03T00:00:00Z',
      ...overrides,
    },
    issue: {
      iid: 7,
      title: 'Widget falls over',
      url: 'https://gitlab.com/acme/widgets/-/issues/7',
      state: 'opened',
      updated_at: '2026-01-02T00:00:00Z',
    },
  };
}

describe('event mapping', () => {
  it.each([
    ['open', 'issueOpened'],
    // A reopen restores the state a new issue arrives in, and the handler that
    // serves it is upsert-shaped either way.
    ['reopen', 'issueOpened'],
    ['update', 'issueEdited'],
    ['close', 'issueClosed'],
  ])('maps issue action %s onto %s', (action, event) => {
    expect(parseGitlabWebhook(issueDelivery({ action }))?.event).toBe(event);
  });

  it('maps a note on an issue onto issueNoteCreated', () => {
    expect(parseGitlabWebhook(noteDelivery())?.event).toBe('issueNoteCreated');
  });

  it.each([
    ['merge_request', { object_kind: 'merge_request', project, object_attributes: { iid: 1, action: 'open' } }],
    ['pipeline', { object_kind: 'pipeline', project, object_attributes: { id: 1 } }],
    ['push', { object_kind: 'push', project }],
  ])('ignores the unsupported kind %s instead of throwing', (_kind, body) => {
    // Returning null matters: GitLab retries any non-2xx, so a hook Factory has
    // no rule for must not become a retry loop.
    expect(parseGitlabWebhook(body)).toBeNull();
  });

  it('ignores a note on a merge request', () => {
    expect(parseGitlabWebhook(noteDelivery({ noteable_type: 'MergeRequest' }))).toBeNull();
  });

  it('ignores an unrecognized issue action rather than guessing', () => {
    expect(parseGitlabWebhook(issueDelivery({ action: 'confidential' }))).toBeNull();
  });

  it.each([null, undefined, 'string', 42, [], {}, { object_kind: 'issue' }])('ignores the malformed body %s', body => {
    expect(parseGitlabWebhook(body)).toBeNull();
  });

  it('ignores a delivery whose project cannot be identified', () => {
    expect(parseGitlabWebhook({ ...issueDelivery(), project: { id: 42 } })).toBeNull();
  });

  it('ignores an issue delivery with no iid or title to key on', () => {
    expect(parseGitlabWebhook(issueDelivery({ iid: undefined }))).toBeNull();
    expect(parseGitlabWebhook(issueDelivery({ title: undefined }))).toBeNull();
  });
});

describe('parsed shape', () => {
  it('carries the fields rules and skills need without a refetch', () => {
    expect(parseGitlabWebhook(issueDelivery())).toEqual({
      event: 'issueOpened',
      deliveryId: 'gitlab:issue:42!7:issueOpened:2026-01-02T00:00:00Z',
      project: { id: 42, pathWithNamespace: 'acme/widgets' },
      issue: {
        iid: 7,
        // The ref the intake capability round-trips, so a webhook-created card
        // resolves back to a dispatchable connection.
        ref: '42!7',
        title: 'Widget falls over',
        url: 'https://gitlab.com/acme/widgets/-/issues/7',
        state: 'opened',
        stateType: 'unstarted',
        author: 'reporter',
        assignees: ['dev'],
        labels: ['bug'],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    });
  });

  it('reports a closed issue as completed', () => {
    const parsed = parseGitlabWebhook(issueDelivery({ action: 'close', state: 'closed' }));
    expect(parsed?.issue).toMatchObject({ state: 'closed', stateType: 'completed' });
  });

  it('keys an issue delivery by its revision so a redelivery replays', () => {
    const first = parseGitlabWebhook(issueDelivery());
    const redelivered = parseGitlabWebhook(issueDelivery());
    expect(redelivered?.deliveryId).toBe(first?.deliveryId);

    // A real edit is a new revision, so it commits rather than replaying.
    const edited = parseGitlabWebhook(issueDelivery({ action: 'update', updated_at: '2026-01-09T00:00:00Z' }));
    expect(edited?.deliveryId).not.toBe(first?.deliveryId);
  });

  it('separates two actions that share a timestamp', () => {
    // `updated_at` has second precision. Keyed on it alone, an edit and a close
    // landing in the same second dedupe to one delivery and the close — the
    // transition that retires the card — is dropped as a replay.
    const stamp = '2026-01-02T00:00:00Z';
    const edited = parseGitlabWebhook(issueDelivery({ action: 'update', updated_at: stamp }));
    const closed = parseGitlabWebhook(issueDelivery({ action: 'close', state: 'closed', updated_at: stamp }));
    expect(edited?.deliveryId).not.toBe(closed?.deliveryId);
  });

  it('keys a note by its own id, not the issue revision', () => {
    // Two notes can share the issue's updated_at; keying on it would make the
    // second one replay the first and vanish.
    const first = parseGitlabWebhook(noteDelivery({ id: 900 }));
    const second = parseGitlabWebhook(noteDelivery({ id: 901 }));
    expect(first?.deliveryId).toBe('gitlab:note:900');
    expect(second?.deliveryId).not.toBe(first?.deliveryId);
  });

  it('attributes the note to its commenter and the issue to its own fields', () => {
    expect(parseGitlabWebhook(noteDelivery())).toMatchObject({
      issue: { iid: 7, ref: '42!7', title: 'Widget falls over' },
      issueNote: {
        id: 900,
        body: 'Still broken.',
        author: 'commenter',
        url: 'https://gitlab.com/acme/widgets/-/issues/7#note_900',
      },
    });
  });

  it('accepts stringified ids from proxies that JSON-mangle numbers', () => {
    const parsed = parseGitlabWebhook({
      ...issueDelivery(),
      project: { id: '42', path_with_namespace: 'acme/widgets' },
    });
    expect(parsed?.project.id).toBe(42);
    expect(parsed?.issue.ref).toBe('42!7');
  });

  it('reads plain-string labels as well as objects', () => {
    // GitLab's issue hook sends label objects; some system hooks send strings.
    expect(parseGitlabWebhook(issueDelivery({ labels: ['bug', 'p1'] }))?.issue.labels).toEqual(['bug', 'p1']);
  });
});

function mrDelivery(overrides: Record<string, unknown> = {}) {
  return {
    object_kind: 'merge_request',
    user: { username: 'contributor' },
    project,
    labels: [{ title: 'feature' }],
    object_attributes: {
      iid: 12,
      title: 'Add the widget',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/12',
      state: 'opened',
      action: 'open',
      source_branch: 'feat/widget',
      target_branch: 'main',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-02T00:00:00Z',
      reviewers: [{ username: 'reviewer' }],
      ...overrides,
    },
  };
}

function mrNoteDelivery(overrides: Record<string, unknown> = {}) {
  return {
    object_kind: 'note',
    user: { username: 'commenter' },
    project,
    object_attributes: {
      id: 950,
      note: 'One nit.',
      noteable_type: 'MergeRequest',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/12#note_950',
      created_at: '2026-02-03T00:00:00Z',
      ...overrides,
    },
    merge_request: {
      iid: 12,
      title: 'Add the widget',
      url: 'https://gitlab.com/acme/widgets/-/merge_requests/12',
      state: 'opened',
      source_branch: 'feat/widget',
      target_branch: 'main',
      updated_at: '2026-02-02T00:00:00Z',
    },
  };
}

describe('merge request deliveries', () => {
  it.each([
    ['open', 'mergeRequestOpened'],
    ['reopen', 'mergeRequestOpened'],
    ['update', 'mergeRequestUpdated'],
    ['merge', 'mergeRequestMerged'],
    ['close', 'mergeRequestClosed'],
  ])('maps merge request action %s onto %s', (action, event) => {
    expect(parseGitlabWebhook(mrDelivery({ action }))?.event).toBe(event);
  });

  it('ignores approval actions rather than acting on a verdict it did not run', () => {
    for (const action of ['approved', 'unapproved', 'approval', 'unapproval']) {
      expect(parseGitlabWebhook(mrDelivery({ action }))).toBeNull();
    }
  });

  it('reads a merged state as a merge even when the action is absent', () => {
    const parsed = parseGitlabWebhook(mrDelivery({ action: undefined, state: 'merged' }));
    expect(parsed?.event).toBe('mergeRequestMerged');
    expect(parsed?.mergeRequest?.merged).toBe(true);
  });

  it('carries the branches, ref, and labels the review board reads', () => {
    const parsed = parseGitlabWebhook(mrDelivery());
    expect(parsed?.mergeRequest).toMatchObject({
      iid: 12,
      ref: '42!12',
      headBranch: 'feat/widget',
      baseBranch: 'main',
      state: 'open',
      merged: false,
      draft: false,
      author: 'contributor',
      labels: ['feature'],
      reviewers: ['reviewer'],
    });
    // An MR delivery describes no issue; leaving one behind would let an issue
    // rule fire on a merge request.
    expect(parsed?.issue).toBeUndefined();
  });

  it('treats a locked merge request as still open', () => {
    // `locked` is a transient state while GitLab performs the merge.
    expect(parseGitlabWebhook(mrDelivery({ state: 'locked' }))?.mergeRequest?.state).toBe('open');
  });

  it('reports a draft under either of GitLab\u2019s two field names', () => {
    expect(parseGitlabWebhook(mrDelivery({ draft: true }))?.mergeRequest?.draft).toBe(true);
    expect(parseGitlabWebhook(mrDelivery({ work_in_progress: true }))?.mergeRequest?.draft).toBe(true);
    expect(parseGitlabWebhook(mrDelivery())?.mergeRequest?.draft).toBe(false);
  });

  it('marks only a delivery that moved the head as a push', () => {
    // GitLab collapses a push, a retitle, and a label change into one `update`.
    expect(parseGitlabWebhook(mrDelivery({ action: 'update', oldrev: 'abc123' }))?.mergeRequest?.headChanged).toBe(true);
    expect(parseGitlabWebhook(mrDelivery({ action: 'update' }))?.mergeRequest?.headChanged).toBe(false);
  });

  it('routes a note by what it is attached to', () => {
    const onMr = parseGitlabWebhook(mrNoteDelivery());
    expect(onMr?.event).toBe('mergeRequestNoteCreated');
    expect(onMr?.mergeRequestNote).toMatchObject({ id: 950, body: 'One nit.', author: 'commenter' });
    expect(onMr?.mergeRequest?.iid).toBe(12);
    expect(onMr?.issue).toBeUndefined();
    expect(onMr?.issueNote).toBeUndefined();
  });

  it('drops a merge request delivery with no branches to review', () => {
    expect(parseGitlabWebhook(mrDelivery({ source_branch: undefined }))).toBeNull();
    expect(parseGitlabWebhook(mrDelivery({ target_branch: undefined }))).toBeNull();
  });

  it('separates a merge request from an issue sharing its iid', () => {
    // Both are `42!12` by ref; only the delivery shape tells them apart.
    const mr = parseGitlabWebhook(mrDelivery({ iid: 12 }));
    const issue = parseGitlabWebhook(issueDelivery({ iid: 12 }));
    expect(mr?.deliveryId).not.toBe(issue?.deliveryId);
    expect(mr?.mergeRequest?.ref).toBe(issue?.issue?.ref);
  });

  it('keeps distinct merge request actions from colliding in one second', () => {
    const updated = parseGitlabWebhook(mrDelivery({ action: 'update' }));
    const merged = parseGitlabWebhook(mrDelivery({ action: 'merge', state: 'merged' }));
    expect(updated?.deliveryId).not.toBe(merged?.deliveryId);
  });

  it('collapses a redelivery of the same change onto one id', () => {
    expect(parseGitlabWebhook(mrDelivery())?.deliveryId).toBe(parseGitlabWebhook(mrDelivery())?.deliveryId);
  });
});
