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
import type {
  Assessment,
  BranchResult,
  Evidence,
  ResearchBranch,
  ResearchRound,
  DiscoverySelectionCandidate,
} from './contracts';
import { approvedUrl, PageRetriever, unsupportedPageFormat } from './page-retrieval';
import { selectionDiagnosticUrl } from './selection-diagnostics';
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
        let discovery: ReturnType<typeof discoverySchema.parse> = { sourceUrls: [], evidence: [] };
        try {
          const discovered = discoverySchema.safeParse(
            await retryWithinBudget(() => provider.search(branch, context), context),
          );
          if (!discovered.success) throw new ResearchError('provider_discovery_invalid');
          discovery = discovered.data;
        } catch (error) {
          if (!previousMaterial.length) throw error;
          const failure = normalizedResearchError(error);
          result.failures.push({
            branch,
            providerId,
            code: failure.code,
            retryable: failure.retryable,
            provider: failure.provider,
          });
        }
        context.round.counters.discoveredUrls += discovery.sourceUrls.length;
        for (const material of discovery.evidence) {
          const source = validateSource(material, providerId, context.domains, context.snapshot.config.sources);
          if (source) batch.add(source);
          else result.failures.push({ branch, providerId, code: 'unapproved_source', retryable: false });
        }
        const target = context.round.target;
        const priority = (value: string) => {
          const url = new URL(value);
          const path = url.pathname.toLowerCase();
          const host = url.hostname.toLowerCase();
          let score = host === context.domain ? 4 : host.endsWith(`.${context.domain}`) ? 3 : 0;
          if (/^(?:support|help|docs|developers?|community|academy)\./.test(host)) score -= 12;
          if (target === 'employeeCount') {
            if (/^(?:careers?|jobs?)\./.test(host)) score += 6;
            if (
              /(?:^|[/_-])(?:team|about|who-are-we|qui-sommes-nous|quienes-somos|quem-somos|careers?|people|company|workforce|headcount|employees?)(?:[/_.-]|$)/.test(
                path,
              )
            )
              score += 4;
            if (/\/(?:jobs?|positions?|vacancies)\/[^/]+/.test(path)) score -= 8;
            if (
              /(?:^|[/_-])(?:legal|legales|privacy|confidentialite|terms|conditions|cgu|cgv|privacidade|datenschutz)(?:[/_.-]|$)/.test(
                path,
              )
            )
              score -= 8;
          } else if (target === 'headquartersCountry') {
            if (
              /about|who-are-we|qui-sommes-nous|quienes-somos|quem-somos|contact|company|headquarters|head-office|office|legal|mentions-legales|impressum/.test(
                path,
              )
            )
              score += 4;
          } else if (/product|pricing|customer/.test(path)) score += 4;
          if (
            target !== 'businessModel' &&
            /\/(?:support|help|docs|tutorials?|guides?|customers?|case-studies|customer-stories|podcasts?|archives?|categor(?:y|ies)|tags?)(?:\/|[-_]|$)/.test(
              path,
            )
          )
            score -= 8;
          if (
            target === 'employeeCount' &&
            /\/(?:company-size|employee-count|headcount)\/\d+(?:-\d+)?(?:-employees)?(?:\/|$)/.test(path)
          )
            score -= 8;
          return score;
        };
        const decisions = discovery.sourceUrls.map(source => {
          const url = selectionDiagnosticUrl(source);
          return {
            providerIndex: context.snapshot.config.sources.providerIds.indexOf(providerId),
            url,
            priority: url === null ? null : priority(source),
            rank: null as number | null,
            selectionRank: null as number | null,
            citationPreferred: discovery.preferredSourceUrls?.includes(source) ?? false,
            selected: false,
            reason: 'unapproved_source' as DiscoverySelectionCandidate['reason'],
          };
        });
        const approved: string[] = [];
        const preferred = new Set<string>();
        const approvedDecisions = new Map<string, DiscoverySelectionCandidate>();
        const normalizedSources = new Map<DiscoverySelectionCandidate, string>();
        for (const [index, source] of discovery.sourceUrls.entries()) {
          const decision = decisions[index]!;
          try {
            const url = approvedUrl(source, context.domains).href;
            approved.push(url);
            normalizedSources.set(decision, url);
            if (decision.url !== null) decision.priority = priority(url);
            if (discovery.preferredSourceUrls?.includes(source)) preferred.add(url);
            decision.reason = approvedDecisions.has(url) ? 'duplicate' : 'not_selected';
            if (!approvedDecisions.has(url)) approvedDecisions.set(url, decision);
          } catch {
            result.failures.push({ branch, providerId, code: 'unapproved_source', retryable: false });
          }
        }
        const priorUrls = new Set([
          ...context.round.consultedUrls,
          ...previousMaterial.filter(source => source.kind === 'website').map(source => diagnosticUrl(source.source)),
        ]);
        const urls = [...new Set(approved)].filter(url => {
          if (unsupportedPageFormat(new URL(url))) {
            approvedDecisions.get(url)!.reason = 'unsupported_format';
            recordUrl(context.round.counters.urls, url, 'unsupported_format');
            result.failures.push({ branch, providerId, code: 'unsupported_source_format', retryable: false });
            return false;
          }
          if (!priorUrls.has(diagnosticUrl(url))) return true;
          approvedDecisions.get(url)!.reason = 'already_consulted';
          recordUrl(context.round.counters.urls, url, 'already_consulted');
          return false;
        });
        urls.sort((a, b) => priority(b) - priority(a) || Number(preferred.has(b)) - Number(preferred.has(a)));
        for (const [index, url] of urls.entries()) approvedDecisions.get(url)!.selectionRank = index + 1;
        for (const [decision, url] of normalizedSources) decision.citationPreferred = preferred.has(url);
        const ranked = decisions
          .filter(decision => decision.priority !== null)
          .sort((a, b) => b.priority! - a.priority! || Number(b.citationPreferred) - Number(a.citationPreferred));
        ranked.forEach((decision, index) => {
          decision.rank = index + 1;
        });
        const selection = (context.round.counters.discoverySelection ??= { candidates: [], omittedCount: 0 });
        const available = 32 - selection.candidates.length;
        selection.candidates.push(...decisions.slice(0, available));
        selection.omittedCount += Math.max(0, decisions.length - available);
        for (const sourceUrl of urls) {
          if (retrievedDigests.size >= 1) break;
          const decision = approvedDecisions.get(sourceUrl)!;
          decision.selected = true;
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
            decision.reason = 'retrieved';
            recordUrl(context.round.counters.urls, sourceUrl, 'retrieved');
            if (!retrievedDigests.has(page.digest)) {
              retrievedDigests.add(page.digest);
              batch.add(page);
              context.round.counters.retrievedPages++;
            }
          } catch (error) {
            decision.reason = 'unavailable';
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
            if (
              ['request_budget_exhausted', 'resource_budget_exhausted', 'deadline_exhausted'].includes(failure.code)
            ) {
              for (const candidate of approvedDecisions.values())
                if (candidate.reason === 'not_selected') candidate.reason = 'budget_exhausted';
              break;
            }
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
        // A submitted inquiry cannot contradict the supplied company domain on its own.
        // Validated website or trusted API/CRM research can establish a sticky conflict.
        result.identityAmbiguous ||=
          extracted.identityAmbiguous && material.some(source => source.kind !== 'submitted');
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
        result.failures.push({
          branch,
          providerId,
          code: failure.code,
          retryable: failure.retryable,
          provider: failure.provider,
        });
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
        discoverySelection: { candidates: [] as DiscoverySelectionCandidate[], omittedCount: 0 },
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
                consultedUrls: rounds.flatMap(round =>
                  round.urls.filter(item => item.outcome !== 'unsupported_format').map(item => item.url),
                ),
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
