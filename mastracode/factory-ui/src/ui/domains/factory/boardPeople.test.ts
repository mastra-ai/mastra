import { describe, expect, it } from 'vitest';

import { boardFiltersFromParams } from './boardFilters';
import { boardParticipants, boardPersonIdentity, withPeopleFolded, withPeopleUnfolded } from './boardPeople';
import type { AuditEventPage } from './services/audit';

const activityPage: AuditEventPage = {
  events: [],
  actors: {
    'user-ada': { id: 'user-ada', name: 'Ada Lovelace', avatarUrl: 'https://avatars.example/ada.png' },
    'user-grace': { id: 'user-grace', name: 'Grace Hopper' },
    'factory-rule-dispatcher': { id: 'factory-rule-dispatcher', name: 'Factory' },
  },
};

/** The people the server lists for a project whose cards name these three on GitHub. */
const people = [
  { id: 'github:octocat', name: 'octocat', source: 'github' },
  { id: 'github:hubot', name: 'hubot', source: 'github' },
  { id: 'github:monalisa', name: 'monalisa', source: 'github' },
] as const;

const asIs = boardPersonIdentity(undefined, undefined);

function picks(entries: Array<[string, string]>, reviewsPullRequests = true) {
  return boardFiltersFromParams(new URLSearchParams(entries), reviewsPullRequests);
}

describe('board person filters', () => {
  it("shows the signed-in user's GitHub-login pick as them and stores every id they go by", () => {
    const octo = boardPersonIdentity('user-octo', 'OctoCat');
    const shown = withPeopleFolded(
      picks([
        ['teammate', 'github:octocat'],
        ['author', 'github:hubot'],
        ['label', 'github:octocat'],
      ]),
      octo,
    );

    expect([...shown.teammate]).toEqual(['factory:user-octo']);
    expect([...shown.author]).toEqual(['github:hubot']);
    expect([...shown.label]).toEqual(['github:octocat']);

    const stored = withPeopleUnfolded(picks([['author', 'factory:user-octo']]), octo);
    expect([...stored.author]).toEqual(['factory:user-octo', 'github:octocat']);
    // A teammate who opens the link folds nothing: the stored ids are the ones the server is asked.
    const hubot = boardPersonIdentity('user-hubot', 'hubot');
    expect([...withPeopleUnfolded(withPeopleFolded(stored, hubot), hubot).author]).toEqual([
      'factory:user-octo',
      'github:octocat',
    ]);
  });

  it('leaves every pick as it is for someone whose GitHub login is unknown', () => {
    const unlinked = boardPersonIdentity('user-octo', null);
    const stored = withPeopleUnfolded(picks([['author', 'factory:user-octo']]), unlinked);

    expect([...stored.author]).toEqual(['factory:user-octo']);
  });

  it('offers Review requested only on boards holding pull requests and ignores the retired relevance parameter', () => {
    const params: [string, string][] = [
      ['reviewer', 'github:monalisa'],
      ['relevance', 'assigned'],
      ['teammate', 'github:octocat'],
    ];

    expect(picks(params, false).reviewer.size).toBe(0);
    expect(picks(params, true).reviewer).toEqual(new Set(['github:monalisa']));
  });

  it('names the signed-in user, the humans who acted, and the people cards name', () => {
    const participants = boardParticipants({
      people,
      activityPage,
      currentUser: { userId: 'user-current', name: 'Katherine Johnson' },
      personId: asIs,
    });

    expect(participants.map(participant => participant.id)).toEqual([
      'factory:user-ada',
      'factory:user-grace',
      'github:hubot',
      'factory:user-current',
      'github:monalisa',
      'github:octocat',
    ]);
    expect(participants.find(participant => participant.id === 'github:octocat')?.avatarUrl).toContain(
      'github.com/octocat.png',
    );
    expect(participants.some(participant => participant.name === 'user-current')).toBe(false);
  });

  it('lists the signed-in user once, with their GitHub avatar, instead of beside their GitHub login', () => {
    const participants = boardParticipants({
      people,
      activityPage,
      currentUser: { userId: 'user-octo', name: 'Octo Cat' },
      personId: boardPersonIdentity('user-octo', 'octocat'),
    });

    expect(participants.map(participant => participant.id)).not.toContain('github:octocat');
    const you = participants.find(participant => participant.id === 'factory:user-octo');
    expect(you?.name).toBe('Octo Cat');
    expect(you?.avatarUrl).toContain('github.com/octocat.png');
  });
});
