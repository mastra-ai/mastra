import { randomUUID } from 'node:crypto';
import { bindAgentPubSub } from '@mastra/core/agent/durable';
import type { EventCallback } from '@mastra/core/events';
import { describe, expect, it } from 'vitest';
import { GoogleCloudPubSub } from './index';

const config = { projectId: 'scoped-agent-test', apiEndpoint: process.env.PUBSUB_EMULATOR_HOST ?? 'localhost:8085' };

describe('agent topics over the real Google Cloud Pub/Sub emulator', () => {
  it.each(['agent.stream.', 'agent.control.', 'agent.abort-ack.'])(
    'delivers %s across independent adapter instances without sibling leakage',
    async prefix => {
      const sender = new GoogleCloudPubSub(config);
      const receiver = new GoogleCloudPubSub(config);
      const runId = randomUUID();
      const agentId = `owner !'()* 日本語 ${randomUUID()}`;
      const owner = bindAgentPubSub(sender, agentId);
      const observer = bindAgentPubSub(receiver, agentId);
      const sibling = bindAgentPubSub(receiver, `sibling-${randomUUID()}`);
      const topic = `${prefix}${runId}`;
      const received: string[] = [];
      const foreign: string[] = [];
      const onOwner: EventCallback = async (event, ack) => {
        received.push(event.type);
        await ack?.();
      };
      const onSibling: EventCallback = async (event, ack) => {
        foreign.push(event.type);
        await ack?.();
      };
      try {
        await observer.subscribe(topic, onOwner);
        await sibling.subscribe(topic, onSibling);
        await owner.publish(topic, { type: 'owner', runId, data: {} });
        await sibling.publish(topic, { type: 'sibling', runId, data: {} });
        await expect.poll(() => received).toEqual(['owner']);
        await expect.poll(() => foreign).toEqual(['sibling']);
      } finally {
        await observer.unsubscribe(topic, onOwner);
        await sibling.unsubscribe(topic, onSibling);
        await Promise.all([sender.flush(), receiver.flush()]);
      }
    },
  );

  it('keeps the longest tested ASCII identity pair within topic and UUID-suffixed subscription limits', async () => {
    const transport = new GoogleCloudPubSub(config);
    const agentId = 'a'.repeat(71);
    const runId = 'r'.repeat(71);
    const agent = bindAgentPubSub(transport, agentId);
    const received: string[] = [];
    const callback: EventCallback = async (event, ack) => {
      received.push(event.type);
      await ack?.();
    };
    for (const prefix of ['agent.stream.', 'agent.control.', 'agent.abort-ack.']) {
      const physical = `${prefix}v2.${Buffer.from(JSON.stringify([agentId, runId])).toString('base64url')}`;
      expect(physical).toMatch(/^[A-Za-z][A-Za-z0-9._~+%-]*$/);
      expect(physical.length).toBeLessThanOrEqual(255);
      expect(transport.getSubscriptionName(physical).length).toBeLessThanOrEqual(255);
      const topic = `${prefix}${runId}`;
      try {
        await agent.subscribe(topic, callback);
        await agent.publish(topic, { type: prefix, runId, data: {} });
        await expect.poll(() => received).toContain(prefix);
      } finally {
        await agent.unsubscribe(topic, callback);
      }
    }
    await transport.flush();
  });

  it('rejects an identity exceeding the subscription limit instead of truncating it', async () => {
    const transport = new GoogleCloudPubSub(config);
    const agentId = 'a'.repeat(72);
    const runId = 'r'.repeat(72);
    const physical = `agent.abort-ack.v2.${Buffer.from(JSON.stringify([agentId, runId])).toString('base64url')}`;
    expect(physical.length).toBeLessThanOrEqual(255);
    expect(transport.getSubscriptionName(physical).length).toBeGreaterThan(255);
    const agent = bindAgentPubSub(transport, agentId);
    try {
      await expect(agent.subscribe(`agent.abort-ack.${runId}`, async () => {})).rejects.toThrow(
        'Failed to subscribe to topic',
      );
    } finally {
      await transport.flush();
    }
  });

  it('delivers the unscoped adapter control independently of the agent facade', async () => {
    const transport = new GoogleCloudPubSub(config);
    const topic = `agent.control.baseline-${randomUUID()}`;
    let delivered = false;
    const callback: EventCallback = async (_event, ack) => {
      delivered = true;
      await ack?.();
    };
    try {
      await transport.subscribe(topic, callback);
      await transport.publish(topic, { type: 'control', runId: 'baseline', data: {} });
      await expect.poll(() => delivered).toBe(true);
    } finally {
      await transport.unsubscribe(topic, callback);
      await transport.flush();
    }
  });
});
