import { describe, expect, it } from 'vitest';
import type { ResolvedMe } from '../services/identity-service.js';
import { matchesMe, partitionByMe } from './at-me.js';

function resolved(entries: Record<string, string[]>): ResolvedMe {
  const map: ResolvedMe = new Map();
  for (const [integrationId, ids] of Object.entries(entries)) {
    map.set(integrationId, new Set(ids));
  }
  return map;
}

describe('matchesMe', () => {
  describe('per-integration field coverage', () => {
    it('matches a GitHub record on assignee login', () => {
      // GitHub source (a) observes `assignees[].login` on issue/PR records;
      // the predicate has to answer the same question at query time.
      const me = resolved({ github: ['octocat'] });
      expect(
        matchesMe(
          {
            integrationId: 'github',
            assigneeExternalUserIds: ['octocat', 'someone-else'],
          },
          me,
        ),
      ).toBe(true);
    });

    it('matches a GitHub record on a requested reviewer', () => {
      const me = resolved({ github: ['octocat'] });
      expect(
        matchesMe(
          {
            integrationId: 'github',
            authorExternalUserId: 'someone-else',
            requestedReviewerExternalUserIds: ['octocat'],
          },
          me,
        ),
      ).toBe(true);
    });

    it('matches a Linear record on author (creator)', () => {
      // Linear stores creator/assignee as uuids; the predicate compares
      // exactly what the observed-authors reader wrote.
      const me = resolved({ linear: ['user-uuid-1'] });
      expect(
        matchesMe(
          {
            integrationId: 'linear',
            authorExternalUserId: 'user-uuid-1',
          },
          me,
        ),
      ).toBe(true);
    });

    it('matches a Jira record on reporter accountId', () => {
      // Jira reporter is a distinct field from assignee — the predicate
      // has to check both because a person can appear as either.
      const me = resolved({ jira: ['jira-account-1'] });
      expect(
        matchesMe(
          {
            integrationId: 'jira',
            assigneeExternalUserId: null,
            reporterExternalUserId: 'jira-account-1',
          },
          me,
        ),
      ).toBe(true);
    });

    it('matches an IncidentIO record on assignee id', () => {
      const me = resolved({ incidentio: ['incident-user-1'] });
      expect(
        matchesMe(
          {
            integrationId: 'incidentio',
            assigneeExternalUserId: 'incident-user-1',
          },
          me,
        ),
      ).toBe(true);
    });

    it('matches a Slack record on @-mention user id', () => {
      const me = resolved({ slack: ['U12345'] });
      expect(
        matchesMe(
          {
            integrationId: 'slack',
            authorExternalUserId: 'U99999',
            mentionedExternalUserIds: ['U12345'],
          },
          me,
        ),
      ).toBe(true);
    });
  });

  describe('non-matches', () => {
    it('returns false when no field references a claimed id', () => {
      const me = resolved({ github: ['octocat'] });
      expect(
        matchesMe(
          {
            integrationId: 'github',
            authorExternalUserId: 'someone-else',
            assigneeExternalUserId: 'yet-another',
          },
          me,
        ),
      ).toBe(false);
    });

    it('does not bleed claims across integrations', () => {
      // A user claiming `octocat` on GitHub must not match a Linear record
      // whose assignee id happens to also be the string 'octocat'.
      const me = resolved({ github: ['octocat'] });
      expect(
        matchesMe(
          {
            integrationId: 'linear',
            assigneeExternalUserId: 'octocat',
          },
          me,
        ),
      ).toBe(false);
    });

    it('returns false when resolvedMe is empty', () => {
      const me = resolved({});
      expect(
        matchesMe(
          {
            integrationId: 'github',
            authorExternalUserId: 'octocat',
          },
          me,
        ),
      ).toBe(false);
    });

    it('returns false when the record integration has no claims', () => {
      // ResolvedMe has entries but not for this record's integration —
      // absence of the key is the same as "not me here".
      const me = resolved({ github: ['octocat'] });
      expect(
        matchesMe(
          {
            integrationId: 'jira',
            assigneeExternalUserId: 'someone',
          },
          me,
        ),
      ).toBe(false);
    });

    it('ignores empty-string and null field values', () => {
      const me = resolved({ github: ['octocat', ''] });
      expect(
        matchesMe(
          {
            integrationId: 'github',
            authorExternalUserId: '',
            assigneeExternalUserId: null,
            assigneeExternalUserIds: ['', 'nobody'],
          },
          me,
        ),
      ).toBe(false);
    });
  });

  describe('partitionByMe', () => {
    it('splits a record list by the @me predicate, preserving order', () => {
      const me = resolved({ github: ['octocat'] });
      const records = [
        { id: 'a', integrationId: 'github', authorExternalUserId: 'octocat' },
        { id: 'b', integrationId: 'github', authorExternalUserId: 'someone' },
        { id: 'c', integrationId: 'linear', assigneeExternalUserId: 'octocat' },
        { id: 'd', integrationId: 'github', assigneeExternalUserIds: ['octocat'] },
      ];
      const { mine, others } = partitionByMe(records, me);
      expect(mine.map(r => r.id)).toEqual(['a', 'd']);
      expect(others.map(r => r.id)).toEqual(['b', 'c']);
    });
  });
});
