import { describe, expect, it } from 'vitest';

import { decodeTeamSourceId, encodeSourceId, encodeTeamSourceId, parseSourceId } from './integration.js';

describe('Linear source id encoding', () => {
  it('round-trips a team source id', () => {
    const id = encodeTeamSourceId('workspace-1', 'team-1');
    expect(id.startsWith('linear-team:')).toBe(true);
    expect(decodeTeamSourceId(id)).toEqual({ workspaceId: 'workspace-1', teamId: 'team-1' });
  });

  it('parseSourceId discriminates project vs team ids', () => {
    const projectId = encodeSourceId('workspace-1', 'project-1');
    const teamId = encodeTeamSourceId('workspace-1', 'team-1');

    expect(parseSourceId(projectId)).toEqual({
      kind: 'project',
      workspaceId: 'workspace-1',
      projectId: 'project-1',
    });
    expect(parseSourceId(teamId)).toEqual({
      kind: 'team',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    });
  });

  it('never collides: a project id and a team id with the same ids differ', () => {
    const projectId = encodeSourceId('workspace-1', 'shared-id');
    const teamId = encodeTeamSourceId('workspace-1', 'shared-id');
    expect(projectId).not.toEqual(teamId);
    // And each decodes only under its own scheme.
    expect(parseSourceId(projectId).kind).toBe('project');
    expect(parseSourceId(teamId).kind).toBe('team');
  });

  it('rejects a malformed team source id', () => {
    expect(() => decodeTeamSourceId('linear-team:not-base64!')).toThrow('Linear team source id is invalid.');
    expect(() => decodeTeamSourceId('linear-project:abc')).toThrow('Linear team source id is invalid.');
  });
});
