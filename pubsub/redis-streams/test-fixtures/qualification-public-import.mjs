import assert from 'node:assert/strict';
import { Agent } from '@mastra/core/agent';
import { RedisStreamsPubSub } from '@mastra/redis-streams';

assert.equal(typeof Agent, 'function');
assert.equal(typeof RedisStreamsPubSub, 'function');
console.log('Built package entrypoints: Agent, RedisStreamsPubSub OK');
console.log('Readiness only: no execution, replay, approval, or outage qualification claimed.');
