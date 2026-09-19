import type { ChannelHandler } from '@mastra/core/channels';

import type { FactoryProject } from '../../storage/domains/projects/base.js';
import type { FactoryReferenceResolver } from '../base.js';

type HandlerThread = Parameters<ChannelHandler>[0];
type HandlerMessage = Parameters<ChannelHandler>[1];

export type ContextFactoryRoute =
  | { status: 'resolved'; factory: FactoryProject; via: 'explicit' | 'reference' }
  | { status: 'ambiguous'; factoryProjectIds: string[] }
  | { status: 'none' };

export function matchExplicitFactory(text: string, factories: readonly FactoryProject[]): FactoryProject | undefined {
  const byLongestName = [...factories].sort((a, b) => b.name.length - a.name.length);
  for (const factory of byLongestName) {
    const name = escapeRegExp(factory.name.trim());
    if (!name) continue;
    const pattern = new RegExp(
      `(?:^|\\s)\\[${name}\\](?=$|\\s|[.,!?:])|\\bfactory:\\s*${name}(?=$|\\s|[.,!?])|\\bin\\s+(?:the\\s+)?${name}\\s+factory\\b`,
      'i',
    );
    if (pattern.test(text)) return factory;
  }
  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const RAW_URL_RE = /https?:\/\/[^\s"\\<>|]+/g;

export function searchableMessageText(message: Pick<HandlerMessage, 'text' | 'raw'>): string {
  const urls = new Set(JSON.stringify(message.raw ?? null).match(RAW_URL_RE) ?? []);
  return [message.text, ...urls].join('\n');
}

function isThreadReply(thread: Pick<HandlerThread, 'id'>, message: Pick<HandlerMessage, 'id'>): boolean {
  const rootTs = thread.id.split(':').at(-1);
  return Boolean(rootTs) && rootTs !== message.id;
}

async function threadRootText(thread: HandlerThread, message: HandlerMessage): Promise<string> {
  if (!isThreadReply(thread, message)) return '';
  try {
    for await (const root of thread.allMessages) {
      return root.id === message.id ? '' : searchableMessageText(root);
    }
  } catch (error) {
    console.warn('[slack] could not read thread root for factory routing', thread.id, error);
  }
  return '';
}

const routesByMessage = new WeakMap<object, Promise<ContextFactoryRoute>>();

export function resolveFactoryFromContext(args: {
  thread: HandlerThread;
  message: HandlerMessage;
  orgId: string;
  factories: readonly FactoryProject[];
  referenceResolvers?: readonly FactoryReferenceResolver[];
}): Promise<ContextFactoryRoute> {
  const cached = routesByMessage.get(args.message);
  if (cached) return cached;
  const route = resolveUncached(args);
  routesByMessage.set(args.message, route);
  return route;
}

async function resolveUncached({
  thread,
  message,
  orgId,
  factories,
  referenceResolvers = [],
}: Parameters<typeof resolveFactoryFromContext>[0]): Promise<ContextFactoryRoute> {
  if (factories.length === 0) return { status: 'none' };

  const explicit = matchExplicitFactory(message.text, factories);
  if (explicit) return { status: 'resolved', factory: explicit, via: 'explicit' };
  if (referenceResolvers.length === 0) return { status: 'none' };

  const text = [searchableMessageText(message), await threadRootText(thread, message)].join('\n');
  const referenced = await Promise.all(
    referenceResolvers.map(resolver =>
      resolver({ orgId, text }).catch(error => {
        console.warn('[slack] reference resolver failed for factory routing', thread.id, error);
        return [];
      }),
    ),
  );
  const factoryById = new Map(factories.map(factory => [factory.id, factory]));
  const matched = new Set(
    referenced
      .flat()
      .map(reference => reference.factoryProjectId)
      .filter(id => factoryById.has(id)),
  );
  if (matched.size === 1) {
    const [id] = matched;
    return { status: 'resolved', factory: factoryById.get(id!)!, via: 'reference' };
  }
  if (matched.size > 1) return { status: 'ambiguous', factoryProjectIds: [...matched] };
  return { status: 'none' };
}
