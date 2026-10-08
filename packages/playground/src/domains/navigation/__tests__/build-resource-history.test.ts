import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildHistoryKey,
  getBuildResourceRoute,
  readBuildHistory,
  rememberBuildResource,
  toggleBuildResourcePin,
} from '../utils/build-resource-history';

beforeEach(() => localStorage.clear());
const key = buildHistoryKey('http://localhost:4111');
const agent = { kind: 'agent', id: 'chef', name: 'Chef Agent', path: '/agents/chef/overview' } as const;

describe('Build resource history', () => {
  describe('when an existing resource is opened in another section', () => {
    it('keeps one recent entry pointing to the latest section', () => {
      rememberBuildResource(key, agent);
      rememberBuildResource(key, { ...agent, path: '/agents/chef/metrics' });
      expect(readBuildHistory(key).recent).toEqual([{ ...agent, path: '/agents/chef/metrics' }]);
    });
  });
  describe('when a pinned resource is revisited', () => {
    it('updates its destination while preserving the pin', () => {
      rememberBuildResource(key, agent);
      toggleBuildResourcePin(key, agent);
      rememberBuildResource(key, { ...agent, path: '/agents/chef/overview#tools' });
      expect(readBuildHistory(key).pinned).toEqual([{ ...agent, path: '/agents/chef/overview#tools' }]);
    });
  });
  describe('when a resource is unpinned', () => {
    it('remains available in recent history', () => {
      rememberBuildResource(key, agent);
      toggleBuildResourcePin(key, agent);
      toggleBuildResourcePin(key, agent);
      expect(readBuildHistory(key)).toEqual({ pinned: [], recent: [agent] });
    });
  });
  describe('when many resources are visited', () => {
    it('keeps only the twelve most recent resources', () => {
      for (let id = 0; id < 20; id++) {
        rememberBuildResource(key, { kind: 'tool', id: `${id}`, name: `Tool ${id}`, path: `/tools/${id}` });
      }
      expect(readBuildHistory(key).recent.map(item => item.id)).toEqual([
        '19',
        '18',
        '17',
        '16',
        '15',
        '14',
        '13',
        '12',
        '11',
        '10',
        '9',
        '8',
      ]);
    });
  });
  describe('when saved data contains an external or mismatched destination', () => {
    it('discards invalid entries', () => {
      localStorage.setItem(
        key,
        JSON.stringify({
          pinned: [{ ...agent, path: 'https://example.com' }],
          recent: [{ ...agent, path: '/tools/chef' }, agent],
        }),
      );
      expect(readBuildHistory(key)).toEqual({ pinned: [], recent: [agent] });
    });
  });
  describe('when another account or instance is selected', () => {
    it('keeps its shortcuts separate', () => {
      rememberBuildResource(key, agent);
      expect(readBuildHistory(buildHistoryKey('http://other-instance:4111')).recent).toEqual([]);
      expect(readBuildHistory(buildHistoryKey('http://localhost:4111', undefined, 'other-user')).recent).toEqual([]);
    });
  });
});

describe('Build resource destinations', () => {
  describe('when the route is a conversation, creation form, or unknown section', () => {
    it.each([
      '/agents/chef/threads/secret',
      '/agents/chef/session/private',
      '/chat/chef',
      '/cms/prompts/create',
      '/tools',
      '/agents/chef/missing',
      '/agents/create',
      '/workflows/test/unknown',
      '/workflows/schedules',
      '/cms/agents/create',
      '/cms/agents/chef/edit/missing',
    ])('does not remember %s', path => {
      expect(getBuildResourceRoute(path)).toBeUndefined();
    });
  });
  describe('when the route opens an agent configuration section', () => {
    it('retains the section with the agent identity', () => {
      expect(getBuildResourceRoute('/agents/chef/configuration#tools')).toEqual({
        kind: 'agent',
        id: 'chef',
        path: '/agents/chef/configuration#tools',
      });
    });
  });
  describe('when the route opens an existing prompt editor', () => {
    it('recognizes the prompt as a Build resource', () => {
      expect(getBuildResourceRoute('/cms/prompts/abc/edit')).toEqual({
        kind: 'prompt',
        id: 'abc',
        path: '/cms/prompts/abc/edit',
      });
    });
  });
});

describe('Agent editor history', () => {
  describe('when a section of the CMS editor is opened', () => {
    it('keeps the agent identity and returns directly to that section', () => {
      expect(getBuildResourceRoute('/cms/agents/chef/edit/tools')).toEqual({
        kind: 'agent',
        id: 'chef',
        path: '/cms/agents/chef/edit/tools',
      });
    });
  });
});
