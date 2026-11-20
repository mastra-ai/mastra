import type { Mastra } from '@mastra/core/mastra';
import { createHash, randomUUID } from 'node:crypto';
import { knowledgeScopeAddress, type Knowledge, type KnowledgePage } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import type { Memory } from '@mastra/memory';
import { supportConfiguration } from '../../examples/support.ts';
import { createCuratorAgent } from '../agents/curator-agent.ts';
import { resourceId, type Profile } from '../identity.ts';
import { hasSeededHttpsSource } from '../knowledge/seed-manifest.ts';
import { acquireWriterLock } from '../knowledge/writer-lock.ts';
import type { LocalProfile } from '../server/access.ts';
import {
  candidateSchema,
  proposalSchema,
  publishedText,
  ReviewConflict,
  type Approval,
  type Candidate,
  type Proposal,
  type ReviewInput,
} from './contracts.ts';

export type ReviewerAuthority = (profile: Profile) => LocalProfile | null;
export function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function pageDigest(page: KnowledgePage) {
  return digest({
    id: page.id,
    version: page.version,
    name: page.name,
    description: page.description,
    body: page.body,
  });
}
function requireReview(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ReviewConflict(message);
}
function customer(profile: Profile) {
  return knowledgeScopeAddress('customer:$tenantId:$customerId', { ...profile });
}
function plainProfile(profile: Profile): Profile {
  return { id: profile.id, actorId: profile.actorId, tenantId: profile.tenantId, customerId: profile.customerId };
}

export function createReviewService(knowledge: Knowledge, memory: Memory, authority: ReviewerAuthority) {
  function reviewer(profile: Profile | undefined): LocalProfile {
    requireReview(profile, 'Authenticated reviewer required');
    const current = authority(profile);
    requireReview(
      current?.review === true && resourceId(current) === resourceId(profile),
      'Current review grant required',
    );
    return current;
  }

  async function confirmation(profile: Profile, input: ReviewInput) {
    requireReview(profile.actorId !== input.sourceActorId, 'Reviewer must differ from source technician');
    const owner = resourceId({ ...profile, actorId: input.sourceActorId });
    const thread = await memory.getThreadById({ threadId: input.threadId });
    // Check the complete trusted tuple before asking Memory for any message content.
    requireReview(thread?.resourceId === owner, 'Source thread ownership mismatch');
    const memoryStore = await memory.storage.getStore('memory');
    requireReview(memoryStore, 'Memory storage is unavailable');
    const result = await memoryStore.listMessagesById({ messageIds: [input.messageId] });
    const message = result.messages.find(item => item.id === input.messageId);
    requireReview(
      message?.role === 'user' && message.threadId === input.threadId && message.resourceId === owner,
      'Attributable technician turn required',
    );
    const text = message.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n')
      .trim();
    requireReview(
      text.length >= 30 && text.length <= 4000 && /^(?:Confirmed:|I confirm\b|I confirmed\b)/iu.test(text),
      'Selected user turn must explicitly confirm an outcome',
    );
    return { confirmation: text, digest: digest({ id: message.id, owner, threadId: input.threadId, text }) };
  }

  async function page(ref: string, allowed: string[]) {
    const split = ref.indexOf('#');
    requireReview(split > 0 && !ref.includes('#', split + 1), 'Invalid evidence reference');
    const scope = ref.slice(0, split),
      path = ref.slice(split + 1);
    requireReview(
      allowed.includes(scope) && /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/u.test(path),
      'Evidence is outside the permitted scope',
    );
    const read = await knowledge.readScopeFor(allowed);
    const store = await knowledge.getStorage();
    const [home] = await store.getScopesByAddress([scope]);
    const result = home && (await store.getPageByPath({ scopeId: home.id, path: path.split('/'), read }));
    requireReview(result, 'Evidence or target is missing');
    return result;
  }

  function safeShared(proposal: Proposal) {
    const { candidate, reviewer: profile, source } = proposal;
    const text = [
      candidate.title,
      candidate.content,
      candidate.record.summary,
      candidate.record.applicability,
      ...candidate.record.topicTags,
    ].join('\n');
    const forbidden = [
      profile.customerId,
      source.sourceActorId,
      source.threadId,
      source.messageId,
      ...candidate.evidence.map(item => item.ref),
    ];
    requireReview(
      !forbidden.some(value => text.toLowerCase().includes(value.toLowerCase())),
      'Shared text contains private identifiers or references',
    );
    requireReview(
      !/\[\[|\]\(|(?:customer|resource|thread):|https?:\/\/|\b(?:bearer\s+\S+|sk-[a-z0-9]{12,}|(?:api[_ -]?key|password|secret|token)\s*[:=])|(?:\d[ -]?){13,19}/iu.test(
        text,
      ),
      'Shared text contains private links, credentials, or payment-like data',
    );
  }

  async function validate(proposal: Proposal, checkTarget = true, reconciledUpdate?: KnowledgePage) {
    const identity = (kind: Proposal['bindings'][number]['kind'], ref: string, current: KnowledgePage) => {
      const binding = proposal.bindings.find(item => item.kind === kind && item.ref === ref);
      requireReview(
        binding &&
          binding.id === current.id &&
          binding.version === current.version &&
          binding.digest === pageDigest(current),
        'Bound evidence or target changed',
      );
    };
    reviewer(proposal.reviewer);
    requireReview(resourceId(proposal.reviewer) === proposal.owner, 'Proposal ownership mismatch');
    const selected = await confirmation(proposal.reviewer, proposal.source);
    requireReview(
      selected.digest === proposal.source.digest && selected.confirmation === proposal.source.confirmation,
      'Source confirmation changed',
    );
    for (const evidence of proposal.candidate.evidence) {
      const current = await page(evidence.ref, [customer(proposal.reviewer)]);
      if (reconciledUpdate && evidence.ref === `${proposal.destination.scope}#${proposal.destination.path}`) {
        const originalTarget = proposal.bindings.find(
          binding => binding.kind === 'target' && binding.ref === evidence.ref,
        );
        const originalEvidence = proposal.bindings.find(
          binding => binding.kind === 'evidence' && binding.ref === evidence.ref,
        );
        requireReview(
          originalTarget &&
            originalEvidence &&
            originalEvidence.id === originalTarget.id &&
            originalEvidence.version === originalTarget.version &&
            originalEvidence.digest === originalTarget.digest &&
            evidence.version === originalTarget.version &&
            current.id === reconciledUpdate.id &&
            pageDigest(current) === pageDigest(reconciledUpdate),
          'Bound update evidence does not match the reconciled effect',
        );
        continue;
      }
      requireReview(current.version === evidence.version, 'Evidence revision changed');
      identity('evidence', evidence.ref, current);
    }
    if (proposal.source.audience === 'tenant' && ['page', 'note', 'update'].includes(proposal.candidate.action)) {
      safeShared(proposal);
      const source = proposal.candidate.publicSource!;
      requireReview(
        source.ref.startsWith(`${knowledgeScopeAddress('docs:$tenantId', { ...proposal.reviewer })}#`),
        'Public source must be a documentation reference',
      );
      const current = await page(source.ref, [
        knowledgeScopeAddress('tenant:$tenantId', { ...proposal.reviewer }),
        knowledgeScopeAddress('docs:$tenantId', { ...proposal.reviewer }),
      ]);
      identity('public', source.ref, current);
      requireReview(
        current.version === source.version && hasSeededHttpsSource(current),
        'Public source must be a current existing HTTPS source-backed page',
      );
    }
    if (checkTarget && proposal.candidate.target) {
      const current = await page(`${proposal.destination.scope}#${proposal.destination.path}`, [
        proposal.destination.scope,
      ]);
      requireReview(current.version === proposal.candidate.target.expectedVersion, 'Target revision changed');
      identity('target', `${proposal.destination.scope}#${proposal.destination.path}`, current);
      requireReview(
        proposal.destination.path.startsWith(`${supportConfiguration.customerRoots[0]}/`) ||
          (proposal.source.audience === 'tenant' && proposal.destination.path.startsWith('learnings/')),
        'Target must be an allowed finding or case record',
      );
      if (proposal.candidate.action === 'update')
        requireReview(
          current.createdBy.author?.startsWith('review:') && current.body?.startsWith('<!-- knowledge-review:'),
          'Only review-owned findings may be updated',
        );
    }
  }

  async function duplicate(proposal: Proposal) {
    const store = await knowledge.getStorage();
    const read = await knowledge.readScopeFor([proposal.destination.scope]);
    const [home] = await store.getScopesByAddress([proposal.destination.scope]);
    if (!home) return false;
    let cursor: string | undefined,
      count = 0;
    do {
      const batch = await store.listPages({ read, scopeId: home.id, cursor, limit: 100 });
      for (const existing of batch.pages) {
        requireReview(++count <= 1000, 'Duplicate check exceeds its bound');
        if (existing.body?.includes(proposal.candidate.content)) return true;
      }
      cursor = batch.nextCursor;
    } while (cursor);
    return false;
  }

  async function prepare(profile: Profile | undefined, input: ReviewInput, mastra?: Mastra): Promise<Proposal> {
    const current = reviewer(profile);
    const selected = await confirmation(current, input);
    const customerScope = customer(current);
    const curator = createCuratorAgent(knowledge, customerScope);
    if (mastra) curator.__registerMastra(mastra);
    const response = await curator.generate(
      JSON.stringify({
        audience: input.audience,
        confirmation: selected.confirmation,
        customerScope,
      }),
      {
        requestContext: new RequestContext(),
        structuredOutput: { schema: candidateSchema },
        maxSteps: 8,
      },
    );
    const candidate = candidateSchema.parse(response.object);
    const id = randomUUID();
    const proposal: Proposal = {
      id,
      owner: resourceId(current),
      reviewer: plainProfile(current),
      source: { ...input, ...selected },
      candidate,
      bindings: [],
      destination: {
        scope:
          input.audience === 'private'
            ? customer(current)
            : knowledgeScopeAddress('tenant:$tenantId', { ...plainProfile(current) }),
        path:
          candidate.target?.path ??
          `${input.audience === 'private' ? supportConfiguration.customerRoots[0] : 'learnings'}/review-${id}`,
      },
      revision: '',
    };
    const bind = async (kind: Proposal['bindings'][number]['kind'], ref: string, allowed: string[]) => {
      const current = await page(ref, allowed);
      proposal.bindings.push({ kind, ref, id: current.id, version: current.version, digest: pageDigest(current) });
    };
    for (const evidence of candidate.evidence) await bind('evidence', evidence.ref, [customer(current)]);
    if (input.audience === 'tenant' && candidate.publicSource && ['page', 'note', 'update'].includes(candidate.action))
      await bind('public', candidate.publicSource.ref, [
        knowledgeScopeAddress('tenant:$tenantId', { ...plainProfile(current) }),
        knowledgeScopeAddress('docs:$tenantId', { ...plainProfile(current) }),
      ]);
    if (candidate.target)
      await bind('target', `${proposal.destination.scope}#${proposal.destination.path}`, [proposal.destination.scope]);
    proposal.revision = digest({ ...proposal, revision: undefined });
    proposalSchema.parse(proposal);
    await validate(proposal);
    if (['page', 'note', 'update'].includes(candidate.action) && (await duplicate(proposal))) {
      proposal.candidate = { ...candidate, action: 'duplicate', target: null };
      proposal.revision = digest({ ...proposal, revision: undefined });
    }
    return proposal;
  }

  async function publish(approval: Approval) {
    const { proposal, decision, reviewerId } = approval;
    requireReview(digest({ ...proposal, revision: undefined }) === proposal.revision, 'Approved revision mismatch');
    requireReview(reviewerId === proposal.reviewer.actorId, 'Decision reviewer mismatch');
    const result = (
      status: 'published' | 'rejected' | 'duplicate' | 'contradiction' | 'insufficient-evidence',
      reference: string | null = null,
    ) => ({ proposalId: proposal.id, status, revision: proposal.revision, reference, decision, reviewerId });
    reviewer(proposal.reviewer);
    if (decision.decision === 'reject') return result('rejected');
    if (['duplicate', 'contradiction', 'insufficient-evidence'].includes(proposal.candidate.action))
      return result(proposal.candidate.action as 'duplicate' | 'contradiction' | 'insufficient-evidence');
    const lock = await acquireWriterLock();
    try {
      // Reconcile an exact previous effect before checking revisions that this update itself changed.
      const store = await knowledge.getStorage();
      const [home] = await store.getScopesByAddress([proposal.destination.scope]);
      const current =
        home &&
        (await store.getPageByPath({ scopeId: home.id, path: proposal.destination.path.split('/'), read: 'all' }));
      const body = publishedText(proposal),
        marker = `<!-- knowledge-review:${proposal.id}:`;
      const author = `review:${reviewerId}`;
      const reference = `${proposal.destination.scope}#${proposal.destination.path}`;
      if (proposal.candidate.action === 'note') {
        requireReview(current, 'Note target is missing');
        const noteLimit = 1000;
        const notes = [];
        let cursor: string | undefined;
        do {
          // Allow one extra slot to reconcile a publication that started at the scan limit.
          const limit = Math.min(100, noteLimit + 1 - notes.length);
          const batch = await store.listNotes({ pageId: current.id, read: 'all', cursor, limit });
          notes.push(...batch.notes);
          cursor = batch.nextCursor;
          requireReview(!cursor || notes.length <= noteLimit, 'Note reconciliation exceeds its bound');
        } while (cursor);
        await validate(proposal);
        const owned = notes.filter(note => note.text.startsWith(marker));
        if (owned.length) {
          const mentions = [
            ...new Set(
              proposal.bindings
                .filter(binding => binding.kind === (proposal.source.audience === 'private' ? 'evidence' : 'public'))
                .map(binding => binding.id),
            ),
          ].sort();
          requireReview(
            owned.length === 1 &&
              owned[0]!.text === body &&
              owned[0]!.provenance.author === author &&
              !owned[0]!.when &&
              JSON.stringify([...owned[0]!.mentions].sort()) === JSON.stringify(mentions) &&
              owned[0]!.stampScopeIds.length === 1 &&
              owned[0]!.stampScopeIds[0] === current.scopeId,
            'Conflicting prior note effect',
          );
          reviewer(proposal.reviewer);
          return result('published', `${reference}?note=${owned[0]!.id}`);
        }
        requireReview(notes.length <= noteLimit, 'Note reconciliation exceeds its bound');
        requireReview(
          !notes.some(note => note.text.includes(proposal.candidate.content)),
          'A duplicate note now exists; reevaluate',
        );
        reviewer(proposal.reviewer);
        const note = await knowledge.addNote({
          ...proposal.destination,
          text: body,
          stamps: [proposal.destination.scope],
          author,
        });
        return result('published', `${reference}?note=${note.id}`);
      }
      if (current?.body?.startsWith(marker)) {
        requireReview(
          current.body === body &&
            current.name === proposal.candidate.title &&
            current.description === proposal.candidate.record.summary &&
            current.updatedBy.author === author,
          'Conflicting prior page effect',
        );
        if (proposal.candidate.action === 'update') {
          const target = proposal.bindings.find(binding => binding.kind === 'target' && binding.ref === reference);
          requireReview(
            target &&
              target.id === current.id &&
              target.version === proposal.candidate.target?.expectedVersion &&
              current.version === target.version + 1,
            'Prior update effect does not match the bound target successor',
          );
        } else {
          requireReview(
            current.version === 1 && current.createdBy.author === author,
            'Conflicting prior page creation',
          );
        }
        await validate(proposal, false, proposal.candidate.action === 'update' ? current : undefined);
        reviewer(proposal.reviewer);
        return result('published', reference);
      }
      if (proposal.candidate.action === 'page') requireReview(!current, 'Page destination already exists');
      await validate(proposal);
      requireReview(!(await duplicate(proposal)), 'A duplicate finding now exists; reevaluate');
      reviewer(proposal.reviewer);
      await knowledge.upsertPage({
        ...proposal.destination,
        name: proposal.candidate.title,
        description: proposal.candidate.record.summary,
        body,
        author,
      });
      return result('published', reference);
    } finally {
      await lock.release();
    }
  }
  return { reviewer, prepare, validate, publish };
}
export type ReviewService = ReturnType<typeof createReviewService>;
