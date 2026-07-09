/**
 * chat-sdk plumbing for tools-only usage with a Slack USER token.
 *
 * The Slack adapter's `botToken` accepts a per-use async function, which is
 * exactly the seam `SlackUserAuth.getToken()` needs (transparent refresh on
 * every call). We never receive webhooks, but the adapter requires webhook
 * verification config and `Chat` requires a `StateAdapter` at construction
 * time — so we pass a deny-all verifier and a throwaway in-memory state.
 */
import type { SlackUserAuth } from '@mastra/slack';
import { createSlackAdapter } from '@chat-adapter/slack';
import type { Lock, QueueEntry, StateAdapter } from 'chat';
import { Chat } from 'chat';

function memoryState(): StateAdapter {
  const kv = new Map<string, unknown>();
  const lists = new Map<string, unknown[]>();
  const locks = new Map<string, Lock>();
  const queues = new Map<string, QueueEntry[]>();
  const subs = new Set<string>();
  return {
    async connect() {},
    async disconnect() {},
    async get<T>(key: string) {
      return (kv.get(key) as T) ?? null;
    },
    async set(key, value) {
      kv.set(key, value);
    },
    async delete(key) {
      kv.delete(key);
    },
    async setIfNotExists(key, value) {
      if (kv.has(key)) return false;
      kv.set(key, value);
      return true;
    },
    async appendToList(key, value, options) {
      const list = lists.get(key) ?? [];
      list.push(value);
      if (options?.maxLength && list.length > options.maxLength) {
        list.splice(0, list.length - options.maxLength);
      }
      lists.set(key, list);
    },
    async getList<T>(key: string) {
      return (lists.get(key) as T[]) ?? [];
    },
    async acquireLock(threadId) {
      if (locks.has(threadId)) return null;
      const lock = { threadId, token: Math.random().toString(36).slice(2) } as Lock;
      locks.set(threadId, lock);
      return lock;
    },
    async releaseLock(lock) {
      locks.delete(lock.threadId);
    },
    async extendLock() {
      return true;
    },
    async forceReleaseLock(threadId) {
      locks.delete(threadId);
    },
    async enqueue(threadId, entry, max) {
      const queue = queues.get(threadId) ?? [];
      queue.push(entry);
      if (queue.length > max) queue.shift();
      queues.set(threadId, queue);
      return queue.length;
    },
    async dequeue(threadId) {
      return queues.get(threadId)?.shift() ?? null;
    },
    async queueDepth(threadId) {
      return queues.get(threadId)?.length ?? 0;
    },
    async subscribe(threadId) {
      subs.add(threadId);
    },
    async unsubscribe(threadId) {
      subs.delete(threadId);
    },
    async isSubscribed(threadId) {
      return subs.has(threadId);
    },
  };
}

export function createUserTokenChat(auth: SlackUserAuth): Chat<Record<'slack', ReturnType<typeof createSlackAdapter>>> {
  const adapter = createSlackAdapter({
    botToken: () => auth.getToken(),
    userName: 'mastracode',
    // Tools-only: no inbound webhooks are ever processed.
    webhookVerifier: () => false,
  });
  return new Chat({
    adapters: { slack: adapter },
    state: memoryState(),
    userName: 'mastracode',
    logger: 'silent',
  });
}
