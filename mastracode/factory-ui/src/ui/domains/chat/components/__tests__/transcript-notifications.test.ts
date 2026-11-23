import { describe, expect, it } from 'vitest';

import { notificationLinkLabel, notificationUrl } from '../TranscriptNotifications';

describe('notification links', () => {
  it('keeps GitHub targets', () => {
    expect(notificationUrl({ source: 'github', metadata: { targetUrl: 'https://github.com/o/r/pull/3#c' } })).toBe(
      'https://github.com/o/r/pull/3#c',
    );
  });

  it('links GitLab merge request and issue targets on any instance host', () => {
    const target = 'https://gitlab.example.com/group/sub/app/-/merge_requests/36#note_9';
    expect(notificationUrl({ source: 'gitlab', metadata: { targetUrl: target } })).toBe(target);
    expect(notificationUrl({ source: 'gitlab', metadata: { targetUrl: 'https://gitlab.com/g/app/-/issues/2' } })).toBe(
      'https://gitlab.com/g/app/-/issues/2',
    );
    expect(notificationLinkLabel({ source: 'gitlab' })).toBe('Open on GitLab');
  });

  it('refuses GitLab targets that are not change request pages and unknown providers', () => {
    expect(
      notificationUrl({ source: 'gitlab', metadata: { targetUrl: 'https://evil.example/-/merge_requests' } }),
    ).toBeUndefined();
    expect(
      notificationUrl({ source: 'gitlab', metadata: { targetUrl: 'http://gitlab.com/g/app/-/issues/2' } }),
    ).toBeUndefined();
    expect(
      notificationUrl({ source: 'other', metadata: { targetUrl: 'https://gitlab.com/g/app/-/issues/2' } }),
    ).toBeUndefined();
    expect(notificationLinkLabel({ source: undefined })).toBe('Open notification target');
  });
});
