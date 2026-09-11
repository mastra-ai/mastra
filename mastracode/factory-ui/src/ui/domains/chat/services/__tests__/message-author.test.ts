import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { channelOrigin, messageAuthor, sentByOther } from '../message-author';

type MastraOptions = NonNullable<MastraDBMessage['content']['providerMetadata']>[string];

const ADA = { id: 'user_ada', name: 'Ada', avatarUrl: 'https://avatars.example/ada.png' };
const SLACK = {
  channels: {
    slack: { messageId: '1784830644.821249', author: { userId: 'U095PUH0FKL', fullName: 'Caleb Barnes' } },
  },
};

function persisted(mastra?: MastraOptions): MastraDBMessage {
  return {
    id: 'm1',
    role: 'user',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'Hi' }],
      ...(mastra ? { providerMetadata: { mastra } } : {}),
    },
  };
}

function live(mastra: MastraOptions): MastraDBMessage {
  const payload = { id: 'sig-1', type: 'user', tagName: 'user', contents: 'Hi', providerOptions: { mastra } };
  return {
    id: 'sig-1',
    role: 'signal',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'data-user-message', data: payload }] as unknown as MastraMessagePart[],
      metadata: { signal: payload },
    },
  };
}

describe('messageAuthor', () => {
  it('reads the person the server stamped on a persisted message', () => {
    expect(messageAuthor(persisted({ author: ADA }))).toEqual(ADA);
  });

  it('reads the same person from the live event', () => {
    expect(messageAuthor(live({ author: ADA }))).toEqual(ADA);
  });

  it('names a Slack sender by their channel account when nobody stamped a person', () => {
    expect(messageAuthor(persisted(SLACK))).toEqual({ id: 'slack:U095PUH0FKL', name: 'Caleb Barnes' });
  });

  it('falls back to the id when the stamp carries no name', () => {
    expect(messageAuthor(persisted({ author: { id: 'user_1' } }))).toEqual({ id: 'user_1', name: 'user_1' });
  });

  it('finds nobody on an unstamped message', () => {
    expect(messageAuthor(persisted())).toBeUndefined();
    expect(messageAuthor(persisted({ author: { name: 'no id' } }))).toBeUndefined();
  });
});

describe('channelOrigin', () => {
  it('given a Slack-stamped message, when parsed, then it yields the platform and author name', () => {
    expect(channelOrigin(persisted(SLACK))).toEqual({ platform: 'slack', authorName: 'Caleb Barnes' });
  });

  it('given a message without channel provenance, when parsed, then there is no origin', () => {
    expect(channelOrigin(persisted())).toBeUndefined();
    expect(channelOrigin(persisted({ author: ADA }))).toBeUndefined();
  });

  it('falls back to userName when no fullName is stamped', () => {
    const origin = channelOrigin(persisted({ channels: { slack: { author: { userId: 'U1', userName: 'caleb' } } } }));

    expect(origin).toEqual({ platform: 'slack', authorName: 'caleb' });
  });
});

describe('sentByOther', () => {
  it('is true for anyone but the viewer', () => {
    expect(sentByOther(persisted({ author: ADA }), 'user_me')).toBe(true);
    expect(sentByOther(persisted({ author: ADA }), 'user_ada')).toBe(false);
  });

  it('is true for every channel message, even one nobody is named on', () => {
    expect(sentByOther(persisted({ channels: { slack: {} } }), 'user_me')).toBe(true);
  });

  it('is false for an unstamped message', () => {
    expect(sentByOther(persisted(), undefined)).toBe(false);
  });
});
