import { createHash, randomUUID } from 'node:crypto';
import { noopObserve } from '@mastra/core/tools';
import type { NormalizedEvent } from '../contracts';
import type { QualificationStore } from '../persistence/qualification-store';
import { normalizedResearchError, retryWithinBudget } from '../providers/evidence';
import type { EvidenceProvider, ResearchContext } from '../providers/evidence';
import { scoreCompanyTool } from '../tools/score-company';
import {
  assessmentSchema,
  branchResultSchema,
  discoverySchema,
  extractionSchema,
  identitySchema,
  verificationSchema,
  ResearchError,
  candidatePassages,
} from './contracts';
import type { Assessment, BranchResult, Evidence, ResearchBranch, ResearchRound } from './contracts';
import { approvedUrl, PageRetriever } from './page-retrieval';
import { collectFacts, gapReason, missingAttributes } from './facts';
import { createEvidenceBatch, validateCandidates, validateSource } from './evidence-validation';

function resolveIdentity(event: NormalizedEvent) {
  return identitySchema.parse(
    event.lead.domain
      ? {
          status: 'resolved',
          domain: event.lead.domain,
          companyName: null,
          candidates: [event.lead.domain],
          reason:
            'The submitted company domain anchors this assessment; a legal company name has not been independently established.',
        }
      : {
          status: event.lead.email ? 'ambiguous' : 'unresolved',
          domain: null,
          companyName: null,
          candidates: event.lead.email ? [event.lead.email.split('@')[1]!] : [],
          reason: event.lead.email
            ? 'An email domain is a candidate, not a verified company. Submit the confirmed company domain.'
            : 'The CRM reference has no resolved company domain. Resolve the company in the input adapter or submit its domain.',
        },
  );
}
function emptyBranch(branch: ResearchBranch): BranchResult {
  return {
    branch,
    evidence: [],
    candidates: [],
    rejections: [],
    failures: [],
    analysisComplete: false,
    intentCoverageComplete: false,
    identityAmbiguous: false,
    companyName: null,
  };
}
function diagnosticUrl(value: string) {
  const url = new URL(value);
  url.username = url.password = url.search = url.hash = '';
  return url.href;
}
function recordUrl(
  urls: ResearchRound['diagnostic']['urls'],
  source: string,
  outcome: ResearchRound['diagnostic']['urls'][number]['outcome'],
) {
  if (urls.length < 100) urls.push({ url: diagnosticUrl(source), outcome });
}
export class QualificationService {
  constructor(
    private readonly store: QualificationStore,
    private readonly providers: Map<string, EvidenceProvider>,
    private readonly pages = new PageRetriever(),
  ) {}
  private async hasDiscoveryBudget(context: Omit<ResearchContext, 'round'>) {
    const budget = (await this.store.get(context.runId))!.budget;
    const limits = context.snapshot.config.research;
    return (
      Date.now() < context.deadline &&
      budget.searchCalls < limits.maxSearchCalls &&
      budget.pageRequests < limits.maxPageRequests &&
      Math.max(budget.compressedBytes, budget.decodedBytes) < limits.maxTotalPageBytes &&
      limits.maxOutputTokens - budget.outputTokens >= 384
    );
  }
  private async research(branch: ResearchBranch, context: ResearchContext): Promise<BranchResult> {
    const result = emptyBranch(branch);
    const retrievedDigests = new Set<string>();
    for (const providerId of context.snapshot.config.sources.providerIds) {
      if (!(await this.hasDiscoveryBudget(context)) || retrievedDigests.size >= 1) break;
      const provider = this.providers.get(providerId);
      if (!provider) {
        result.failures.push({ branch, providerId, code: 'provider_unavailable', retryable: false });
        continue;
      }
      try {
        const previousMaterial = [...context.round.previousEvidence, ...result.evidence];
        const batch = createEvidenceBatch(previousMaterial);
        const discovered = discoverySchema.safeParse(
          await retryWithinBudget(() => provider.search(branch, context), context),
        );
        if (!discovered.success) throw new ResearchError('provider_discovery_invalid');
        const discovery = discovered.data;
        context.round.counters.discoveredUrls += discovery.sourceUrls.length;
        for (const material of discovery.evidence) {
          const source = validateSource(material, providerId, context.domains, context.snapshot.config.sources);
          if (source) batch.add(source);
          else result.failures.push({ branch, providerId, code: 'unapproved_source', retryable: false });
        }
        const approved: string[] = [];
        for (const source of discovery.sourceUrls) {
          try {
            approved.push(approvedUrl(source, context.domains).href);
          } catch {
            result.failures.push({ branch, providerId, code: 'unapproved_source', retryable: false });
          }
        }
        const priorUrls = new Set([
          ...context.round.consultedUrls,
          ...previousMaterial.filter(source => source.kind === 'website').map(source => diagnosticUrl(source.source)),
        ]);
        const urls = [...new Set(approved)].filter(url => {
          if (!priorUrls.has(diagnosticUrl(url))) return true;
          recordUrl(context.round.counters.urls, url, 'already_consulted');
          return false;
        });
        {
          const target = context.round.target;
          const paths =
            target === 'employeeCount'
              ? /team|about|careers|people|company/i
              : target === 'headquartersCountry'
                ? /about|contact|company|office/i
                : /product|pricing|customer/i;
          const priority = (value: string) => {
            const url = new URL(value);
            return (
              Number(url.hostname === context.domain || url.hostname.endsWith(`.${context.domain}`)) * 2 +
              Number(paths.test(url.pathname))
            );
          };
          urls.sort((a, b) => priority(b) - priority(a));
        }
        for (const sourceUrl of urls) {
          if (retrievedDigests.size >= 1) break;
          try {
            const page = await retryWithinBudget(
              () =>
                this.pages.retrieve({
                  runId: context.runId,
                  sourceUrl,
                  domains: context.domains,
                  providerId,
                  deadline: context.deadline,
                  store: this.store,
                }),
              context,
            );
            recordUrl(context.round.counters.urls, sourceUrl, 'retrieved');
            if (!retrievedDigests.has(page.digest)) {
              retrievedDigests.add(page.digest);
              batch.add(page);
              context.round.counters.retrievedPages++;
            }
          } catch (error) {
            recordUrl(context.round.counters.urls, sourceUrl, 'unavailable');
            const failure = normalizedResearchError(error);
            if (failure.code === 'evidence_id_conflict') throw failure;
            result.failures.push({
              branch,
              providerId,
              code: failure.code,
              retryable: failure.retryable,
              page: failure.page,
            });
            if (['request_budget_exhausted', 'resource_budget_exhausted', 'deadline_exhausted'].includes(failure.code))
              break;
          }
        }
        const prepared = batch.prepare();
        if (!prepared.material.length) {
          result.failures.push({ branch, providerId, code: 'no_source_material', retryable: false });
          continue;
        }
        result.evidence.push(...prepared.stored);
        const { material } = prepared;
        const extraction = extractionSchema.safeParse(
          await retryWithinBudget(() => provider.extract(branch, material, context), context),
        );
        if (!extraction.success) throw new ResearchError('provider_extraction_invalid');
        const extracted = extraction.data;
        result.companyName ??= extracted.companyName;
        result.identityAmbiguous ||= extracted.identityAmbiguous;
        const candidates = extracted.candidates.filter(candidate =>
          branch === 'signals' ? candidate.attribute === 'buyingIntent' : candidate.attribute !== 'buyingIntent',
        );
        {
          context.round.counters.extractedCandidates += extracted.candidates.length;
          context.round.counters.selectedCandidates += candidates.length;
        }
        const verification = verificationSchema.safeParse(
          await retryWithinBudget(() => provider.verify(branch, candidates, material, context), context),
        );
        if (!verification.success) throw new ResearchError('provider_verification_invalid');
        const verified = verification.data;
        const accepted = validateCandidates(candidates, verified.supportedCandidateIds, prepared, {
          providerId,
          branch,
          roundIndex: context.round.index,
          businessModelLabels: context.snapshot.config.policy.rules.businessModel.categories.map(
            category => category.label,
          ),
        });
        result.candidates.push(...accepted.candidates);
        result.rejections.push(...accepted.rejections);
        result.analysisComplete = true;
        result.intentCoverageComplete ||= extracted.intentCoverageComplete && verified.intentCoverageComplete;
      } catch (error) {
        const failure = normalizedResearchError(error);
        result.failures.push({ branch, providerId, code: failure.code, retryable: failure.retryable });
      }
    }
    result.evidence.sort((a, b) => a.id.localeCompare(b.id));
    return branchResultSchema.parse(result);
  }
  private async targetedResearch(context: Omit<ResearchContext, 'round'>, branches: BranchResult[]) {
    const plan = context.snapshot.config.research.targeted;
    const rounds: ResearchRound['diagnostic'][] = [];
    let facts = collectFacts(branches, context.snapshot);
    for (const [index, target] of plan.order.entries()) {
      const saved = await this.store.round(context.runId, index);
      if (saved) {
        branches.push(saved.result);
        facts = collectFacts(branches, context.snapshot);
        rounds.push(saved.diagnostic);
        if (saved.diagnostic.reason === 'budget_exhausted') break;
        continue;
      }
      const before = (await this.store.get(context.runId))!.budget;
      const missingBefore = missingAttributes(facts, context.snapshot);
      const reason = !missingBefore.includes(target)
        ? 'already_supported'
        : !(await this.hasDiscoveryBudget(context))
          ? 'budget_exhausted'
          : 'completed';
      const counters = {
        discoveredUrls: 0,
        retrievedPages: 0,
        extractedCandidates: 0,
        selectedCandidates: 0,
        urls: [] as ResearchRound['diagnostic']['urls'],
      };
      const result =
        reason === 'completed'
          ? await this.research(target === 'buyingIntent' ? 'signals' : 'firmographics', {
              ...context,
              round: {
                index,
                target,
                gap: gapReason(target, facts[target], branches, context.snapshot, false),
                query: plan.queries[target],
                year: new Date(context.snapshot.assessmentTime).getUTCFullYear(),
                searchDomains: before.searchCalls === 0 ? [context.domain] : context.domains,
                consultedUrls: rounds.flatMap(round => round.urls.map(item => item.url)),
                previousEvidence: [
                  ...new Map(branches.flatMap(branch => branch.evidence).map(source => [source.id, source])).values(),
                ],
                missingAttributes: missingBefore,
                supportedFacts: Object.fromEntries(
                  Object.entries(facts).filter(([, fact]) => fact.disposition === 'accepted'),
                ),
                counters,
              },
            })
          : emptyBranch(target === 'buyingIntent' ? 'signals' : 'firmographics');
      if (reason === 'budget_exhausted')
        result.failures.push({
          branch: result.branch,
          providerId: 'round-scheduler',
          code:
            Date.now() >= context.deadline
              ? 'deadline_exhausted'
              : before.searchCalls >= context.snapshot.config.research.maxSearchCalls ||
                  before.pageRequests >= context.snapshot.config.research.maxPageRequests
                ? 'request_budget_exhausted'
                : 'resource_budget_exhausted',
          retryable: false,
        });
      branches.push(result);
      facts = collectFacts(branches, context.snapshot);
      const after = (await this.store.get(context.runId))!.budget;
      const round: ResearchRound = {
        result,
        diagnostic: {
          index,
          target,
          reason,
          missingBefore,
          missingAfter: missingAttributes(facts, context.snapshot),
          gap: gapReason(target, facts[target], branches, context.snapshot, reason === 'budget_exhausted'),
          ...counters,
          acceptedCandidates: result.candidates.length,
          rejectedCandidates: result.rejections.length,
          searchCalls: after.searchCalls - before.searchCalls,
          pageRequests: after.pageRequests - before.pageRequests,
        },
      };
      await this.store.saveRound(context.runId, round);
      rounds.push(round.diagnostic);
      if (reason === 'budget_exhausted') break;
    }
    return { branches, rounds, facts };
  }
  async qualify(runId: string, event: NormalizedEvent): Promise<Assessment | null> {
    const stored = await this.store.get(runId);
    // Accepted pre-upgrade events keep their existing intake-only behavior.
    if (!stored) return null;
    if (stored.assessment) return stored.assessment;
    const { snapshot } = stored;
    const deadline = await this.store.start(runId, snapshot);
    const identity = resolveIdentity(event);
    let branches: BranchResult[] = [];
    let rounds: ResearchRound['diagnostic'][] = [];
    let facts: ReturnType<typeof collectFacts>;
    if (event.lead.inquiry && identity.status === 'resolved') {
      const { inquiry } = event.lead;
      const excerpt = inquiry.text;
      const evidence: Evidence = {
        id: 'submitted-inquiry',
        kind: 'submitted',
        source: `submission:${event.sourceId}:${event.eventId}`,
        title: 'Authenticated inbound inquiry',
        retrievedAt: event.receivedAt,
        publishedAt: inquiry.occurredAt,
        excerpt,
        digest: createHash('sha256').update(excerpt).digest('hex'),
        providerId: event.sourceId,
        retrieval: 'submitted',
      };
      const submitted = emptyBranch('signals');
      submitted.evidence.push(evidence);
      submitted.candidates.push({
        id: 'submitted-inquiry',
        attribute: 'buyingIntent',
        value: { type: inquiry.type, occurredAt: inquiry.occurredAt },
        evidenceId: evidence.id,
        quote: inquiry.text,
        asOf: null,
      });
      branches.push(submitted);
    }
    if (identity.status === 'resolved' && identity.domain) {
      const context: Omit<ResearchContext, 'round'> = {
        runId,
        domain: identity.domain,
        domains: [identity.domain, ...snapshot.config.sources.additionalDomains],
        snapshot,
        deadline,
        store: this.store,
      };
      ({ branches, rounds, facts } = await this.targetedResearch(context, branches));
      if (branches.some(branch => branch.identityAmbiguous)) {
        identity.status = 'ambiguous';
        identity.reason =
          'Retrieved material does not establish a single company identity. Confirm the company domain and legal entity.';
      }
    } else {
      facts = collectFacts(branches, snapshot);
    }
    const result = await scoreCompanyTool.execute!(
      {
        identity,
        facts,
        policy: snapshot.config.policy,
        routing: snapshot.config.routing,
        assessmentTime: snapshot.assessmentTime,
      },
      { observe: noopObserve },
    );
    if (!result || 'error' in result) throw new Error('Scoring contract failed');
    const evidence = [
      ...new Map(branches.flatMap(branch => branch.evidence).map(item => [item.id, item])).values(),
    ].sort((a, b) => a.id.localeCompare(b.id));
    const inferences = branches
      .flatMap(branch => branch.candidates)
      .flatMap(candidate =>
        (candidate.attribute === 'businessModel' || candidate.attribute === 'employeeCount') && candidate.inference
          ? [
              {
                candidateId: candidate.id,
                attribute: candidate.attribute,
                value: candidate.value,
                rationale: candidate.inference.rationale,
                passages: candidatePassages(candidate),
              },
            ]
          : [],
      );
    const summary = [
      `${identity.domain ?? 'Unresolved company'}: ${result.classification}, score ${result.score}/100.`,
      ...result.contributions.map(rule => {
        const references = facts[rule.rule].evidenceIds;
        const id = references[0];
        const source = evidence.find(item => item.id === id);
        const citation = id ? (source?.kind === 'website' ? `[${id}](<${source.source}>)` : `[${id}]`) : '';
        const additional =
          references.length > 1 ? ` ${references.length - 1} additional evidence references in the assessment.` : '';
        return `${rule.rule}: ${rule.reason} ${citation}${additional}`;
      }),
      result.nextAction,
      ...(inferences.length
        ? [
            'Model-generated inference rationale and exact supporting passages are recorded separately in the assessment.',
          ]
        : []),
    ].join('\n');
    const failures = branches.flatMap(branch => branch.failures);
    const processingStatus =
      identity.status === 'resolved' && evidence.length === 0 && failures.length > 0 ? 'failed' : 'completed';
    return this.store.finish(
      assessmentSchema.parse({
        id: randomUUID(),
        runId,
        version: 1,
        processingStatus,
        snapshot,
        identity,
        facts,
        evidence,
        failures,
        rejections: branches.flatMap(branch => branch.rejections),
        inferences,
        rounds,
        result,
        summary,
        completedAt: new Date().toISOString(),
      }),
    );
  }
}
