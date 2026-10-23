import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, hashBytes, type InputProvider } from '../src/mastra/domain/contracts.js';
import type { Extraction, SemanticAssessment } from '../src/mastra/domain/reconciliation-contracts.js';
import type { SavedSource } from '../src/mastra/storage/cases.js';
import type { EvaluationCase } from './evaluation-cases.js';
import { fixtureExtraction, type DocumentFixture } from './reconciliation-fixtures.js';
export async function reportWire(
  documents: DocumentFixture[],
  mode:
    | 'normal'
    | 'long'
    | 'zero'
    | 'partial'
    | 'match'
    | 'invalid-structured-target'
    | 'invalid-grounding-parallel'
    | 'incomplete'
    | 'interrupted' = 'normal',
  evaluation?: EvaluationCase,
) {
  const requests: unknown[] = [];
  const encodedInputUnits: number[] = [];
  const server = createServer(async (incoming, outgoing) => {
    let raw = '';
    for await (const chunk of incoming) raw += chunk;
    encodedInputUnits.push(Buffer.byteLength(raw, 'utf8') + 512);
    if (evaluation?.behavior === 'unavailable') {
      outgoing.writeHead(400, { 'Content-Type': 'application/json' });
      outgoing.end(
        JSON.stringify({ error: { message: 'SENTINEL_PRIVATE_PROVIDER_SECRET', type: 'invalid_request_error' } }),
      );
      return;
    }
    const body = JSON.parse(raw) as { input: { role: string; content: string | { text: string }[] }[] };
    requests.push(body);
    const content = body.input.find(item => item.role === 'user')!.content;
    const { data } = JSON.parse(typeof content === 'string' ? content : content.map(item => item.text).join('')) as {
      data: {
        source?: SavedSource;
        clauses?: { reference: Extraction['terms'][number]; target: Extraction['terms'][number] }[];
      };
    };
    let result: Extraction | SemanticAssessment;
    if (data.source) {
      const source = data.source;
      if (source.kind === 'records') {
        result = {
          sourceId: source.sourceId,
          terms: source.evidence.map(item => ({
            category: 'limit',
            key: item.field,
            label: 'Response assistance',
            scope: 'Professional services',
            value: { type: 'text', value: String(item.value) },
            original: String(item.value),
            evidence: [
              {
                sourceId: source.sourceId,
                version: source.version,
                hash: source.hash,
                physicalPage: null,
                recordId: item.recordId,
                field: item.field,
                excerpt: String(item.value),
              },
            ],
            uncertainty: [],
          })),
          reviewedPages: [],
          reviewedRecords: source.evidence.map(({ recordId, field }) => ({ recordId, field })),
          complete: true,
          limitations: [],
          changes: [],
        };
      } else {
        const fixture = documents.find(d => d.name === source.displayName)!;
        result = fixtureExtraction(
          source,
          mode === 'match' || evaluation?.behavior === 'clean' ? { ...fixture, kind: 'reference' } : fixture,
        );
        if (mode === 'long' && source.pages.length > 4) {
          const page = source.pages[4]!;
          for (let i = 0; i < 12; i++)
            result.terms.push({
              category: 'other',
              key: 'additional-' + i,
              label: `Additional condition ${i + 1}`,
              scope: 'Policy',
              value: { type: 'text', value: page.text },
              original: page.text,
              evidence: [
                {
                  sourceId: source.sourceId,
                  version: source.version,
                  hash: source.hash,
                  physicalPage: 5,
                  recordId: null,
                  field: null,
                  excerpt: page.text,
                },
              ],
              uncertainty: [],
            });
        }
        if (evaluation?.behavior === 'invalid-evidence' && result.terms[0])
          result.terms[0].evidence[0]!.physicalPage = 49;
        if (mode === 'partial' || evaluation?.behavior === 'incomplete') {
          result.complete = false;
          result.limitations = ['The captured comparison scope was not fully evaluated.'];
        }
        if (mode === 'zero') result.terms = [];
        if (mode === 'invalid-structured-target' && fixture.kind === 'target') {
          result.reviewedPages.push(result.reviewedPages[0]!);
          result.limitations.push('SENTINEL_PRIVATE_INVALID_OUTPUT');
        }
        if (mode === 'invalid-grounding-parallel' && fixture.kind === 'reference')
          result.terms[0]!.evidence[0]!.excerpt = 'SENTINEL_PRIVATE_UNGROUNDED_EXCERPT';
        if (mode === 'invalid-grounding-parallel' && fixture.kind === 'target')
          result.terms[0]!.original = 'SENTINEL_PRIVATE_UNGROUNDED_ORIGINAL';
      }
    } else
      result = {
        assessments: (data.clauses ?? []).map(pair => ({
          category: pair.reference.category,
          key: pair.reference.key,
          scope: pair.reference.scope,
          conclusion: mode === 'match' ? 'equivalent' : 'different',
          observation: 'The source clauses contain different exclusions.',
          interpretation: 'Read each clause and its stated qualifications.',
          uncertainty: [],
          evidence: [...pair.reference.evidence, ...pair.target.evidence],
        })),
      };
    outgoing.writeHead(200, { 'Content-Type': 'application/json' });
    const payload = JSON.stringify({
      id: 'resp_report_' + requests.length,
      status: mode === 'incomplete' ? 'incomplete' : 'completed',
      ...(mode === 'incomplete' ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
      output: [
        {
          type: 'message',
          id: 'msg_report',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify(result), annotations: [] }],
        },
      ],
      usage: { input_tokens: 400, output_tokens: 200, total_tokens: 600 },
    });
    if (mode === 'interrupted') {
      outgoing.write(payload.slice(0, 20));
      await new Promise(resolve => setTimeout(resolve, 300));
      outgoing.end(payload.slice(20));
    } else outgoing.end(payload);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Missing test socket');
  return {
    requests,
    encodedInputUnits,
    endpoint: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  };
}
export function reportRecordInput(): InputProvider {
  return {
    id: 'captured-records',
    category: 'input',
    capabilities: ['structured-records'],
    requestSchema: z.object({}).strict(),
    async capture() {
      return {
        sources: ['Reference proposal', 'Target contract'].map((displayName, i) => {
          const records = { policy: { assistance: `USD ${i ? '50000' : '75000'} each occurrence, fixed.` } };
          return {
            sourceId: randomUUID(),
            version: '2026-01',
            hash: hashBytes(canonicalJson(records)),
            role: i ? ('contract' as const) : ('proposal' as const),
            displayName,
            kind: 'records' as const,
            records,
            evidence: [{ recordId: 'policy', field: 'assistance', value: records.policy.assistance }],
            limitations: [],
            provenance: {
              providerId: 'captured-records',
              capturedAt: new Date().toISOString(),
              origin: 'Captured professional-services records',
              sourceVersion: '2026-01',
            },
          };
        }),
      };
    },
  };
}
