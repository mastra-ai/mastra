import { describe, expect, it } from 'vitest';

import { decodeTeamSourceId, encodeSourceId, encodeTeamSourceId, parseSourceId } from './integration.js';

const OWNER = { linearWorkspaceId: 'workspace-1', connectionId: 'conn-1' };

describe('Linear source id encoding', () => {
  it('round-trips a team source id stamped with its connection', () => {
    const id = encodeTeamSourceId(OWNER, 'team-1');
    expect(id.startsWith('linear-team:')).toBe(true);
    expect(decodeTeamSourceId(id)).toEqual({ workspaceId: 'workspace-1', connectionId: 'conn-1', teamId: 'team-1' });
  });

  it('parseSourceId discriminates project vs team ids', () => {
    expect(parseSourceId(encodeSourceId(OWNER, 'project-1'))).toEqual({
      kind: 'project',
      workspaceId: 'workspace-1',
      connectionId: 'conn-1',
      projectId: 'project-1',
    });
    expect(parseSourceId(encodeTeamSourceId(OWNER, 'team-1'))).toEqual({
      kind: 'team',
      workspaceId: 'workspace-1',
      connectionId: 'conn-1',
      teamId: 'team-1',
    });
  });

  it('decodes legacy ids without a connection', () => {
    const legacy = `linear-project:${Buffer.from(JSON.stringify({ workspaceId: 'workspace-1', projectId: 'project-1' })).toString('base64url')}`;
    expect(parseSourceId(legacy)).toEqual({
      kind: 'project',
      workspaceId: 'workspace-1',
      connectionId: null,
      projectId: 'project-1',
    });
  });

  it('never collides: a project id and a team id with the same ids differ', () => {
    const projectId = encodeSourceId(OWNER, 'shared-id');
    const teamId = encodeTeamSourceId(OWNER, 'shared-id');
    expect(projectId).not.toEqual(teamId);
    expect(parseSourceId(projectId).kind).toBe('project');
    expect(parseSourceId(teamId).kind).toBe('team');
  });

  it('rejects a malformed team source id', () => {
    expect(() => decodeTeamSourceId('linear-team:not-base64!')).toThrow('Linear team source id is invalid.');
    expect(() => decodeTeamSourceId('linear-project:abc')).toThrow('Linear team source id is invalid.');
  });
});
