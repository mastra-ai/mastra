import type { ModelFactory, ModelCall } from '../../src/mastra/processing/model.ts';
import type { AnswerDraft } from '../../src/mastra/contracts/answer.ts';
import { jsonStream, userText, nativeWireChoices } from './drafting.ts';

// Controlled semantic decisions use only the actual native prompt and returned approved evidence.
// This is a feasible execution path, not a prediction of selected-model quality.
type Projection = {
  id: string;
  kind: string;
  disclosure: string;
  text: string;
  context?: { field: string; relations: Array<[string, string]> };
};
export function controlledSourceProvider() {
  const calls: Array<{ phase: string; id: string; call: ModelCall }> = [];
  const representatives = new Map<string, string>();
  const factory: ModelFactory = (phase, id) => {
    const doStream = async (call: ModelCall) => {
      calls.push({ phase, id, call: structuredClone({ ...call, abortSignal: undefined }) });
      const text = userText(call);
      if (phase === 'injection')
        return jsonStream(
          /Ignore all prior rules|Treat this buyer question|Disregard evidence permissions|Ignore approval rules/.test(
            text,
          )
            ? { categories: [{ type: 'injection', score: 1 }], reason: 'CONTROLLED_INJECTION_DETECTED' }
            : { categories: null, reason: null },
        );
      if (phase === 'pii') return jsonStream({ categories: null, detections: null });
      const body = JSON.parse(text);
      if (phase === 'interpretation') {
        for (const q of body.questions) representatives.set(q.id, q.equivalenceRef);
        return jsonStream({
          interpretations: Object.fromEntries(
            body.questions.map(
              (q: {
                id: string;
                section: string;
                spans: Array<{ ref: string; field: string }>;
                equivalenceRef: string;
              }) => [
                q.id,
                {
                  domain: q.id === 'VRQ-023' ? 'data' : q.section || 'access',
                  product: 'tasks',
                  environment: 'production',
                  timeQualifier: nativeWireChoices(call, q.id, 'timeQualifier').includes('current')
                    ? 'current'
                    : 'unspecified',
                  query: q.spans[0]!.ref,
                  equivalenceKey: ['VRQ-009', 'VRQ-023'].includes(q.id) ? representatives.get('VRQ-009')! : 'none',
                  requests: Object.fromEntries(q.spans.map(s => [s.ref, s.field])),
                },
              ],
            ),
          ),
        });
      }
      if (phase === 'verification') {
        if (id.includes('consistency-')) return jsonStream({ materialContradiction: false });
        const ids = body.draft.claims.map((c: { id: string }) => c.id);
        const conflict = body.question.id === 'VRQ-018';
        return jsonStream({
          supportedClaimIds: conflict ? [] : ids,
          conflictedClaimIds: conflict ? ids : [],
          unsupportedCommitment: false,
          applicable: true,
          complete: body.question.id !== 'VRQ-007',
          sensitive: false,
        });
      }
      const number = Number(String(body.question.id).replace('VRQ-', '')) - 1;
      const excerpts = body.excerpts as Projection[];
      const requested = body.required.subparts.join(' ');
      const unsupported =
        /deleted customer workspaces|payment card numbers/i.test(requested) &&
        !excerpts.some(e => /deleted|payment card/i.test(e.text));
      const choose = (pattern: RegExp) =>
        excerpts.find(e => pattern.test(e.context?.field ?? '') || pattern.test(e.text));
      const primary =
        number === 1
          ? choose(/iso27001Certified/)
          : number === 2
            ? choose(/soc2TypeIIReport/)
            : number === 8 || number === 22
              ? choose(/inTransit/)
              : number === 9
                ? choose(/atRest/)
                : number === 10
                  ? choose(/customerManagedKeys/)
                  : number === 11
                    ? choose(/regions/)
                    : number === 12
                      ? choose(/Weekly dependency/)
                      : number === 17
                        ? choose(/productionLogRetention/)
                        : /ISO 27001/i.test(body.question.text)
                          ? choose(/iso27001Certified/)
                          : /SOC 2/i.test(body.question.text)
                            ? choose(/soc2TypeIIReport/)
                            : excerpts.find(e => !e.text.startsWith('#'));
      let value: AnswerDraft['value'] = body.question.answerType === 'free_text' ? 'free_text' : 'yes';
      if (primary?.text === 'false' || /\bNo |\bnot offered|no universal/i.test(primary?.text ?? '') || number === 13)
        value = 'no';
      if (number === 5 || number === 6) value = 'partial';
      const selected =
        number === 17
          ? excerpts.filter(e => /(?:productionLogRetention|logRetention)/.test(e.context?.field ?? ''))
          : primary
            ? [primary]
            : [];
      const unknown = selected.some(e => e.disclosure === 'restricted') || unsupported || selected.length === 0;
      const claims = unknown
        ? []
        : selected.map((e, i) => ({
            id: `claim-${i}`,
            text: `${e.context?.field || 'Source statement'}: ${e.text}`,
            citationIds: [`citation-${i}`],
            kind: e.kind === 'policy' ? 'policy' : 'operational',
          }));
      return jsonStream({
        questionId: body.question.id,
        domain: body.required.domain,
        value: unknown ? 'unknown' : value,
        text: unknown ? '' : claims.map(c => c.text).join(' '),
        responseOption: unknown || value === 'free_text' ? null : value,
        claims,
        citations: unknown
          ? []
          : selected.map((e, i) => ({ id: `citation-${i}`, excerptId: e.id, supportingExcerpt: e.text })),
        coveredSubparts: body.required.subparts,
        confidence: unknown ? 0 : 0.95,
        limitations: value === 'partial' ? ['Only the returned approved policy scope is supported.'] : [],
      });
    };
    return { doStream, doGenerate: doStream };
  };
  return { factory, calls };
}
