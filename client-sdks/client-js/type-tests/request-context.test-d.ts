import { RequestContext } from '@mastra/core/request-context';
import { expectTypeOf, test } from 'vitest';
import type { MastraClient } from '../src/client';

declare const client: MastraClient;

// #29576: `StreamParamsBase.requestContext` only accepted a RequestContext instance
test('agent.generate and agent.stream accept a plain-object or RequestContext requestContext', () => {
  const agent = client.getAgent('support');

  for (const requestContext of [{ userId: '123' }, new RequestContext([['userId', '123']])]) {
    expectTypeOf(agent.generate('hi', { requestContext })).toBeObject();
    expectTypeOf(agent.stream('hi', { requestContext })).toBeObject();
  }
});
