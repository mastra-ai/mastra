/**
 * HTTP for the item feed. Every handler is the same shape: resolve the tenant,
 * validate the path ids, delegate to a `CommentsDomain` service method, map its
 * result status to a status code, then emit audit.
 */

import type { EventCallback, PubSub } from '@mastra/core/events';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

import { getFactoryAuthUser } from '../../../auth.js';
import { feedTopic } from '../../../feed-events.js';
import type { RouteAuth } from '../../../routes/route.js';
import type { AuditEmitter } from '../audit/domain.js';
import type { FactoryProjectsStorage } from '../projects/base.js';
import type { WorkItemsStorage } from '../work-items/base.js';
import { actorFromAuthUser } from './actor.js';
import type { WorkItemCommentsStorage } from './base.js';
import { decodeCommentCursor } from './base.js';
import type { CommentEditor, CommentsDomain } from './domain.js';
import { isRecord, parseCreateCommentBody, parseEditCommentBody, readJson, UUID_RE } from './parse.js';
import { toWireComment } from './wire.js';
import type { WireCommentPage } from './wire.js';

const MAX_AUDIT_BODY_SNAPSHOT = 1024;
/** Comment frames only — proxies drop an idle stream, and `write` can't detect a dead peer. */
const FEED_KEEPALIVE_MS = 25_000;
// Ceiling: one broker subscription per open tab, not per project. A per-replica
// topic multiplexer is the upgrade path if tab counts ever make that hurt.

export interface CommentRouteDependencies {
  domain: CommentsDomain;
  auth: RouteAuth;
  comments: WorkItemCommentsStorage;
  workItems: WorkItemsStorage;
  projects: FactoryProjectsStorage;
  pubsub: PubSub;
  audit?: AuditEmitter;
}

interface Tenant {
  orgId: string;
  userId: string;
}

function loose(c: unknown): Context {
  return c as Context;
}

export function buildCommentRoutes(dependencies: CommentRouteDependencies): ApiRoute[] {
  const { domain, auth, comments, workItems, projects, pubsub, audit } = dependencies;

  async function resolveTenant(c: Context): Promise<Tenant | { response: Response }> {
    await auth.ensureUser(c);
    const tenant = auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json({ error: 'organization_required', message: 'The item feed requires an organization.' }, 403),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }

  function editorFor(c: Context, tenant: Tenant): CommentEditor {
    return {
      userId: tenant.userId,
      canModerate: () => auth.isOrganizationAdmin(c, tenant.orgId),
    };
  }

  async function emitMentionAudit(
    c: Context,
    target: { factoryProjectId: string; workItemId: string; title?: string },
    commentId: string,
    mentionedIds: string[],
  ): Promise<void> {
    if (mentionedIds.length === 0) return;
    await audit?.emit({
      context: c,
      input: {
        action: 'factory.work_item.comment_mentioned',
        factoryProjectId: target.factoryProjectId,
        targets: [{ type: 'work_item', id: target.workItemId, ...(target.title ? { name: target.title } : {}) }],
        metadata: { commentId, mentionedIds },
      },
    });
  }

  return [
    registerApiRoute('/web/factory/work-items/:workItemId/comments', {
      method: 'GET',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        const workItemId = c.req.param('workItemId');
        if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);
        await workItems.ensureReady();
        const workItem = await workItems.get({ orgId: tenant.orgId, id: workItemId });
        if (!workItem) return c.json({ error: 'Work item not found' }, 404);

        await comments.ensureReady();
        const limitRaw = c.req.query('limit');
        const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
        const before = c.req.query('before') || undefined;
        if (before && !decodeCommentCursor(before)) return c.json({ error: 'invalid_cursor' }, 422);
        const around = c.req.query('around') || undefined;
        if (around && !UUID_RE.test(around)) return c.json({ error: 'invalid_comment_id' }, 422);
        const page = await comments.list({
          orgId: tenant.orgId,
          factoryProjectId: workItem.factoryProjectId,
          workItemId,
          before,
          ...(around ? { around } : {}),
          ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
        });
        const wirePage: WireCommentPage = {
          comments: page.comments.map(comment => toWireComment(comment, tenant.userId)),
          ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
        };
        return c.json(wirePage);
      },
    }),

    registerApiRoute('/web/factory/work-items/:workItemId/comments', {
      method: 'POST',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        const workItemId = c.req.param('workItemId');
        if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);

        const parsed = parseCreateCommentBody(await readJson(c));
        if (!parsed) return c.json({ error: 'invalid_comment' }, 422);

        const result = await domain.createComment({
          orgId: tenant.orgId,
          workItemId,
          author: actorFromAuthUser(tenant.userId, getFactoryAuthUser(c)),
          body: parsed.body,
          ...(parsed.replyTo ? { replyTo: parsed.replyTo } : {}),
          ...(parsed.mentions ? { mentions: parsed.mentions } : {}),
          ...(parsed.clientToken ? { clientToken: parsed.clientToken } : {}),
        });
        if (result.status === 'work_item_not_found') return c.json({ error: 'Work item not found' }, 404);
        if (result.status === 'token_conflict') return c.json({ error: 'comment_token_conflict' }, 409);
        if (result.status === 'invalid') return c.json({ error: 'invalid_comment', message: result.message }, 422);

        const { comment, workItem } = result;
        await audit?.emit({
          context: c,
          input: {
            action: 'factory.work_item.comment_created',
            factoryProjectId: workItem.factoryProjectId,
            targets: [{ type: 'work_item', id: workItem.id, name: workItem.title }],
            metadata: { commentId: comment.id },
          },
        });
        await emitMentionAudit(
          c,
          { factoryProjectId: workItem.factoryProjectId, workItemId: workItem.id, title: workItem.title },
          comment.id,
          comment.mentions.map(mention => mention.id).filter(id => id !== comment.author.id),
        );
        return c.json({ comment: toWireComment(comment, tenant.userId) }, 201);
      },
    }),

    registerApiRoute('/web/factory/work-items/:workItemId/comments/:commentId', {
      method: 'PATCH',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        const workItemId = c.req.param('workItemId');
        const commentId = c.req.param('commentId');
        if (!workItemId || !UUID_RE.test(workItemId) || !commentId || !UUID_RE.test(commentId)) {
          return c.json({ error: 'Comment not found' }, 404);
        }

        const parsed = parseEditCommentBody(await readJson(c));
        if (!parsed) return c.json({ error: 'invalid_comment' }, 422);

        const result = await domain.editComment({
          orgId: tenant.orgId,
          workItemId,
          commentId,
          editor: editorFor(c, tenant),
          body: parsed.body,
          ...(parsed.mentions ? { mentions: parsed.mentions } : {}),
          ...(parsed.expectedRevision !== undefined ? { expectedRevision: parsed.expectedRevision } : {}),
        });
        if (result.status === 'not_found') return c.json({ error: 'Comment not found' }, 404);
        if (result.status === 'forbidden') return c.json({ error: 'not_comment_author' }, 403);
        if (result.status === 'not_editable') return c.json({ error: 'comment_not_editable' }, 409);
        if (result.status === 'conflict') return c.json({ error: 'comment_conflict' }, 409);
        if (result.status === 'invalid') return c.json({ error: 'invalid_comment', message: result.message }, 422);

        const { comment } = result;
        await audit?.emit({
          context: c,
          input: {
            action: 'factory.work_item.comment_edited',
            factoryProjectId: comment.factoryProjectId,
            targets: [{ type: 'work_item', id: comment.workItemId }],
            metadata: {
              commentId: comment.id,
              previousBody: result.previousBody.slice(0, MAX_AUDIT_BODY_SNAPSHOT),
            },
          },
        });
        await emitMentionAudit(
          c,
          { factoryProjectId: comment.factoryProjectId, workItemId: comment.workItemId },
          comment.id,
          result.addedMentions.map(mention => mention.id),
        );
        return c.json({ comment: toWireComment(comment, tenant.userId) });
      },
    }),

    registerApiRoute('/web/factory/work-items/:workItemId/comments/:commentId', {
      method: 'DELETE',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        const workItemId = c.req.param('workItemId');
        const commentId = c.req.param('commentId');
        if (!workItemId || !UUID_RE.test(workItemId) || !commentId || !UUID_RE.test(commentId)) {
          return c.json({ error: 'Comment not found' }, 404);
        }

        const result = await domain.deleteComment({
          orgId: tenant.orgId,
          workItemId,
          commentId,
          editor: editorFor(c, tenant),
        });
        if (result.status === 'not_found') return c.json({ error: 'Comment not found' }, 404);
        if (result.status === 'forbidden') return c.json({ error: 'not_comment_author' }, 403);
        if (result.status === 'not_editable') return c.json({ error: 'comment_not_editable' }, 409);

        await audit?.emit({
          context: c,
          input: {
            action: 'factory.work_item.comment_deleted',
            factoryProjectId: result.comment.factoryProjectId,
            targets: [{ type: 'work_item', id: result.comment.workItemId }],
            metadata: { commentId: result.comment.id },
          },
        });
        return c.json({ comment: toWireComment(result.comment, tenant.userId) });
      },
    }),

    registerApiRoute('/web/factory/projects/:id/mention-roster', {
      method: 'GET',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        const projectId = c.req.param('id');
        if (!projectId || !UUID_RE.test(projectId)) return c.json({ error: 'Project not found' }, 404);
        await projects.ensureReady();
        const project = await projects.get({ orgId: tenant.orgId, id: projectId });
        if (!project) return c.json({ error: 'Project not found' }, 404);

        await comments.ensureReady();
        const roster = await domain.mentionRoster({ orgId: tenant.orgId, factoryProjectId: projectId });
        const query = c.req.query('q')?.trim().toLowerCase();
        const members = query
          ? roster.filter(member => (member.name ?? member.id).toLowerCase().startsWith(query))
          : roster;
        return c.json({ members });
      },
    }),

    registerApiRoute('/web/factory/projects/:id/feed-events', {
      method: 'GET',
      handler: async cc => {
        const c = loose(cc);
        const tenant = await resolveTenant(c);
        if ('response' in tenant) return tenant.response;

        const projectId = c.req.param('id');
        if (!projectId || !UUID_RE.test(projectId)) return c.json({ error: 'Project not found' }, 404);
        await projects.ensureReady();
        const project = await projects.get({ orgId: tenant.orgId, id: projectId });
        if (!project) return c.json({ error: 'Project not found' }, 404);

        const topic = feedTopic(tenant.orgId, projectId);
        return streamSSE(c, async stream => {
          const onEvent: EventCallback = async event => {
            if (stream.aborted) return;
            const data = event.data;
            const workItemId = isRecord(data) && typeof data.workItemId === 'string' ? data.workItemId : undefined;
            await stream.writeSSE({ event: 'feed', data: JSON.stringify(workItemId ? { workItemId } : {}) });
          };
          // Claimed before any await: `onAbort` handlers registered after the
          // reader is gone never run, and a broker subscribe is a round trip.
          const closed = new Promise<void>(resolve => stream.onAbort(resolve));
          let keepalive: ReturnType<typeof setInterval> | undefined;
          try {
            // Without `latest`, a retaining broker replays its whole backlog into
            // every new connection as spurious invalidations.
            await pubsub.subscribe(topic, onEvent, { startFrom: 'latest' });
            if (!stream.aborted) {
              keepalive = setInterval(() => {
                if (stream.aborted) return;
                void stream.write(': ping\n\n');
              }, FEED_KEEPALIVE_MS);
              // `streamSSE` closes the stream the moment this callback returns.
              await closed;
            }
          } finally {
            clearInterval(keepalive);
            await pubsub.unsubscribe(topic, onEvent);
          }
        });
      },
    }),
  ];
}
