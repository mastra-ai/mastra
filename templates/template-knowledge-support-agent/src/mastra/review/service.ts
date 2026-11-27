import { confirmationMetadataSchema, confirmationText } from './confirmation.ts';
import type { Mastra } from '@mastra/core/mastra';
import { randomUUID } from 'node:crypto';
import {
  KnowledgeConflictError,
  knowledgeScopeAddress,
  type Knowledge,
  type KnowledgeNote,
  type KnowledgePage,
} from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { knowledgeScopeReadable } from '@mastra/core/storage';
import type { Memory } from '@mastra/memory';
import { PostgresStore, type DbClient } from '@mastra/pg';
import { supportConfiguration } from '../../examples/support.ts';
import { createCuratorAgent } from '../agents/curator-agent.ts';
import { resourceId, type Profile } from '../identity.ts';
import { hasSeededHttpsSource } from '../knowledge/seed-manifest.ts';
import { withWriterLock } from '../knowledge/writer-lock.ts';
import { createKnowledge, createPostgresWriterKnowledge } from '../knowledge/index.ts';
import { upsertPageAtRevision } from '../knowledge/versioned-page.ts';
import type { LocalProfile } from '../server/access.ts';
import { hasDuplicatePage, matchingNoteIds } from './duplicate.ts';
import { withPublicationReceipt } from './publication-receipt.ts';
import {
  candidateSchema,
  digest,
  proposalDraftSchema,
  proposalSchema,
  publishedText,
  reviewStartInputSchema,
  ReviewConflict,
  targetBinding,
  type Approval,
  type Candidate,
  type Proposal,
  type ReviewInput,
  type ReviewStartRequest,
} from './contracts.ts';

export type ReviewerAuthority = (profile: Profile) => LocalProfile | null;
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

  async function confirmation(profile: Profile, input: ReviewInput, structured = false) {
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
    const metadata = confirmationMetadataSchema.safeParse(message.content.metadata?.supportConfirmation);
    if (metadata.success) {
      requireReview(
        metadata.data.threadId === input.threadId &&
          metadata.data.sourceActorId === input.sourceActorId &&
          text === confirmationText(metadata.data),
        'Structured confirmation attribution mismatch',
      );
    } else {
      requireReview(
        !structured &&
          !message.content.metadata?.supportConfirmation &&
          text.length >= 30 &&
          text.length <= 4000 &&
          /^(?:Confirmed:|I confirm\b|I confirmed\b)/iu.test(text),
        'Selected user turn must explicitly confirm an outcome',
      );
    }
    return {
      confirmation: text,
      curatorConfirmation: metadata.success
        ? { observation: metadata.data.observation, outcome: metadata.data.outcome }
        : text,
      digest: digest({
        id: message.id,
        owner,
        threadId: input.threadId,
        text,
        ...(metadata.success ? { metadata: metadata.data } : {}),
      }),
    };
  }

  async function page(ref: string, allowed: string[], activeKnowledge = knowledge) {
    const split = ref.indexOf('#');
    const scope = ref.slice(0, split),
      path = ref.slice(split + 1);
    requireReview(allowed.includes(scope), 'Evidence is outside the permitted scope');
    const read = await activeKnowledge.readScopeFor(allowed);
    const store = await activeKnowledge.getStorage();
    const [home] = await store.getScopesByAddress([scope]);
    const result = home && (await store.getPageByPath({ scopeId: home.id, path: path.split('/'), read }));
    requireReview(result, 'Evidence or target is missing');
    return result;
  }

  async function validate(proposal: Proposal, authenticated?: Profile, activeKnowledge = knowledge) {
    const identity = (kind: Proposal['bindings'][number]['kind'], ref: string, current: KnowledgePage) => {
      const binding = proposal.bindings.find(item => item.kind === kind && item.ref === ref);
      requireReview(
        binding &&
          binding.id === current.id &&
          binding.version === current.version &&
          binding.digest === pageDigest(current),
        'Bound evidence or target changed',
      );
      return binding;
    };
    reviewer(authenticated ?? proposal.reviewer);
    const selected = await confirmation(proposal.reviewer, proposal.source);
    requireReview(
      selected.digest === proposal.source.digest && selected.confirmation === proposal.source.confirmation,
      'Source confirmation changed',
    );
    for (const evidence of proposal.candidate.evidence) {
      const current = await page(evidence.ref, [customer(proposal.reviewer)], activeKnowledge);
      requireReview(current.version === evidence.version, 'Evidence revision changed');
      identity('evidence', evidence.ref, current);
    }
    if (proposal.source.audience === 'tenant' && ['page', 'note', 'update'].includes(proposal.candidate.action)) {
      const source = proposal.candidate.publicSource!;
      const current = await page(
        source.ref,
        [
          knowledgeScopeAddress('tenant:$tenantId', proposal.reviewer),
          knowledgeScopeAddress('docs:$tenantId', proposal.reviewer),
        ],
        activeKnowledge,
      );
      identity('public', source.ref, current);
      requireReview(
        current.version === source.version && hasSeededHttpsSource(current),
        'Public source must be a current existing HTTPS source-backed page',
      );
    }
    if (proposal.candidate.target) {
      const targetRef = `${proposal.destination.scope}#${proposal.destination.path}`;
      const current = await page(targetRef, [proposal.destination.scope], activeKnowledge);
      requireReview(current.version === proposal.candidate.target.expectedVersion, 'Target revision changed');
      const binding = identity('target', targetRef, current);
      if (proposal.candidate.action === 'update')
        requireReview(
          current.createdBy.author?.startsWith('review:') && current.body?.startsWith('<!-- knowledge-review:'),
          'Only review-owned findings may be updated',
        );
      return binding;
    }
  }

  async function duplicate(proposal: Proposal, activeKnowledge = knowledge, postgres?: DbClient) {
    const store = await activeKnowledge.getStorage();
    const read = await activeKnowledge.readScopeFor([proposal.destination.scope]);
    const [home] = await store.getScopesByAddress([proposal.destination.scope]);
    if (!home || !knowledgeScopeReadable(home, read)) return false;
    const targetId =
      proposal.candidate.action === 'update'
        ? proposal.bindings.find(binding => binding.kind === 'target')?.id
        : undefined;
    const storage = memory.storage;
    const database = postgres ?? (storage instanceof PostgresStore ? storage.db : undefined);
    const { action, content } = proposal.candidate;
    const pageExists = await hasDuplicatePage(home.id, content, targetId, database);
    if (pageExists || action !== 'note') return pageExists;
    return (await matchingNoteIds(targetBinding(proposal)!.id, content, 'live-content', database)).length > 0;
  }

  async function prepare(
    profile: Profile | undefined,
    request: ReviewStartRequest,
    mastra?: Mastra,
  ): Promise<Proposal> {
    const current = reviewer(profile);
    const received = reviewStartInputSchema.parse(request);
    const structured = 'confirmationReference' in received;
    const input: ReviewInput = structured
      ? { ...received.confirmationReference, audience: received.audience }
      : received;
    const { curatorConfirmation, ...selected } = await confirmation(current, input, structured);
    const customerScope = customer(current);
    const tenantScope =
      input.audience === 'tenant' ? knowledgeScopeAddress('tenant:$tenantId', { ...plainProfile(current) }) : undefined;
    const curator = createCuratorAgent(knowledge, tenantScope ? [customerScope, tenantScope] : [customerScope]);
    if (mastra) curator.__registerMastra(mastra);
    const maxSteps = 8;
    const response = await curator.generate(
      JSON.stringify({
        audience: input.audience,
        confirmation: curatorConfirmation,
        customerScope,
        tenantScope,
      }),
      {
        requestContext: new RequestContext(),
        structuredOutput: { schema: candidateSchema },
        maxSteps,
        // Reserve the final model call for the proposal after the evidence checks.
        prepareStep: ({ stepNumber }) => (stepNumber === maxSteps - 1 ? { toolChoice: 'none' } : undefined),
      },
    );
    const candidate = candidateSchema.parse(response.object);
    const id = randomUUID();
    const draft = proposalDraftSchema.parse({
      id,
      owner: resourceId(current),
      reviewer: plainProfile(current),
      source: { ...input, ...selected },
      candidate,
      bindings: [],
      destination: {
        scope: tenantScope ?? customerScope,
        path:
          candidate.target?.path ??
          `${input.audience === 'private' ? supportConfiguration.customerRoots[0] : supportConfiguration.sharedRoot}/review-${id}`,
      },
    });
    const bind = async (kind: Proposal['bindings'][number]['kind'], ref: string, allowed: string[]) => {
      const current = await page(ref, allowed);
      draft.bindings.push({ kind, ref, id: current.id, version: current.version, digest: pageDigest(current) });
    };
    for (const evidence of candidate.evidence) await bind('evidence', evidence.ref, [customer(current)]);
    if (input.audience === 'tenant' && candidate.publicSource && ['page', 'note', 'update'].includes(candidate.action))
      await bind('public', candidate.publicSource.ref, [
        knowledgeScopeAddress('tenant:$tenantId', draft.reviewer),
        knowledgeScopeAddress('docs:$tenantId', draft.reviewer),
      ]);
    if (candidate.target)
      await bind('target', `${draft.destination.scope}#${draft.destination.path}`, [draft.destination.scope]);
    const proposal = proposalSchema.parse({ ...draft, revision: digest(draft) });
    await validate(proposal, current);
    if (['page', 'note', 'update'].includes(candidate.action) && (await duplicate(proposal))) {
      proposal.candidate = { ...candidate, action: 'duplicate', target: null };
      proposal.revision = digest({ ...proposal, revision: undefined });
    }
    return proposal;
  }

  async function publish(approval: Approval, authenticated?: Profile) {
    const { proposal, decision, reviewerId } = approval;
    const result = (
      status: 'published' | 'rejected' | 'duplicate' | 'contradiction' | 'insufficient-evidence',
      reference: string | null = null,
    ) => ({ proposalId: proposal.id, status, revision: proposal.revision, reference, decision, reviewerId });
    const currentReviewer = reviewer(authenticated ?? proposal.reviewer);
    requireReview(
      currentReviewer.id === proposal.reviewer.id &&
        currentReviewer.actorId === proposal.reviewer.actorId &&
        currentReviewer.actorId === reviewerId &&
        resourceId(currentReviewer) === proposal.owner,
      'Reviewer does not own this approval',
    );
    if (decision.decision === 'reject') return result('rejected');
    if (['duplicate', 'contradiction', 'insufficient-evidence'].includes(proposal.candidate.action))
      return result(proposal.candidate.action as 'duplicate' | 'contradiction' | 'insufficient-evidence');
    return withWriterLock(async writerContext => {
      const { postgres } = writerContext;
      if (postgres) await knowledge.getStorage();
      const activeKnowledge = postgres ? createPostgresWriterKnowledge(postgres) : knowledge;
      const store = await activeKnowledge.getStorage();
      const currentPage = async () => {
        const [home] = await store.getScopesByAddress([proposal.destination.scope]);
        return (
          home &&
          (await store.getPageByPath({ scopeId: home.id, path: proposal.destination.path.split('/'), read: 'all' }))
        );
      };
      const body = publishedText(proposal),
        marker = `<!-- knowledge-review:${proposal.id}:`;
      const author = `review:${reviewerId}`;
      const reference = `${proposal.destination.scope}#${proposal.destination.path}`;
      if (proposal.candidate.action === 'note') {
        // The proposal schema requires a binding for the note's destination.
        const target = targetBinding(proposal)!;
        const mentions = [
          ...new Set(
            proposal.bindings
              .filter(binding => binding.kind === (proposal.source.audience === 'private' ? 'evidence' : 'public'))
              .map(binding => binding.id),
          ),
        ].sort();
        const priorEffect = async (note: KnowledgeNote) => {
          const [home] = await store.getScopesByAddress([proposal.destination.scope]);
          const bound = await store.getPage({ id: target.id, read: 'all' });
          requireReview(
            home && bound?.scopeId === home.id && note.pageId === bound.id,
            'Prior note effect does not match the bound target',
          );
          requireReview(
            !note.deletedAt &&
              note.text === body &&
              note.provenance.author === author &&
              !note.when &&
              JSON.stringify([...note.mentions].sort()) === JSON.stringify(mentions) &&
              note.stampScopeIds.length === 1 &&
              note.stampScopeIds[0] === bound.scopeId,
            'Conflicting prior note effect',
          );
          reviewer(authenticated ?? proposal.reviewer);
          return result('published', `${reference}?note=${note.id}`);
        };
        const prior = await store.getNote({ id: proposal.id, read: 'all', includeDeleted: true });
        if (prior) return priorEffect(prior);

        const legacyIds = await matchingNoteIds(target.id, marker, 'legacy-marker', postgres);
        requireReview(legacyIds.length <= 1, 'Conflicting prior note effect');
        if (legacyIds[0]) {
          const legacy = await store.getNote({ id: legacyIds[0], read: 'all', includeDeleted: true });
          requireReview(legacy, 'Prior note effect is missing');
          return priorEffect(legacy);
        }
        const current = await currentPage();
        requireReview(current, 'Note target is missing');
        requireReview(current.id === target.id, 'Note target changed; reevaluate');
        await validate(proposal, authenticated, activeKnowledge);
        requireReview(
          !(await duplicate(proposal, activeKnowledge, postgres)),
          'A duplicate note or finding now exists; reevaluate',
        );
        reviewer(authenticated ?? proposal.reviewer);
        const note = await store.addNote({
          id: proposal.id,
          pageId: current.id,
          text: body,
          stampScopeIds: [current.scopeId],
          mentions,
          provenance: { author },
        });
        return result('published', `${reference}?note=${note.id}`);
      }
      return withPublicationReceipt(
        writerContext,
        { proposalId: proposal.id, revision: proposal.revision, reviewerId, reference },
        async receipts => {
          const receipt = await receipts.find();
          if (receipt) {
            requireReview(
              receipt.reviewer_id === reviewerId && receipt.reference === reference,
              'Conflicting prior publication receipt',
            );
            reviewer(authenticated ?? proposal.reviewer);
            return result('published', receipt.reference);
          }
          const current = await currentPage();
          // Approvals written before receipts were introduced can still reconcile an exact current effect.
          if (current?.body?.startsWith(marker)) {
            requireReview(
              current.body === body &&
                current.name === proposal.candidate.title &&
                current.description === proposal.candidate.record.summary &&
                current.updatedBy.author === author,
              'Conflicting prior page effect',
            );
            if (proposal.candidate.action === 'update') {
              const target = targetBinding(proposal);
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
            reviewer(authenticated ?? proposal.reviewer);
            await receipts.record();
            return result('published', reference);
          }
          if (proposal.candidate.action === 'page') requireReview(!current, 'Page destination already exists');
          const expected = await validate(proposal, authenticated, activeKnowledge);
          requireReview(
            !(await duplicate(proposal, activeKnowledge, postgres)),
            'A duplicate finding now exists; reevaluate',
          );
          reviewer(authenticated ?? proposal.reviewer);
          const writer = postgres ? activeKnowledge : createKnowledge(memory.storage);
          try {
            await receipts.write(mutations =>
              upsertPageAtRevision(
                writer,
                store,
                {
                  ...proposal.destination,
                  name: proposal.candidate.title,
                  description: proposal.candidate.record.summary,
                  body,
                  author,
                },
                expected ?? null,
                mutations,
                postgres,
              ),
            );
          } catch (error) {
            if (error instanceof KnowledgeConflictError)
              throw new ReviewConflict('Page destination changed; reevaluate', { cause: error });
            throw error;
          }
          return result('published', reference);
        },
      );
    });
  }
  return { reviewer, prepare, publish };
}
export type ReviewService = ReturnType<typeof createReviewService>;
