import { loadSettings } from '../src/config/settings.js';
import { startControlPlane } from '../src/http/server.js';
import { readExampleBoundary } from '../example-target-api/transport.js';
import type { BolaModels } from '../src/investigation/bola-models.js';

const settings = loadSettings(process.env, process.cwd());
const boundary = await readExampleBoundary(settings);
if (!boundary) throw new Error('OWNED_LAB_REQUIRED');

const models: BolaModels = {
  /** Select the observed order-detail candidate after reserving the local planning allowance. */
  async select(candidates, budget) {
    await budget.reserve('sherlock', 1024, 512);
    const candidate = candidates.find(
      item => item.routeTemplate === '/api/orders/{id}' && item.prerequisite === 'collection_detail',
    );
    if (!candidate) throw new Error('BOLA_CANDIDATE_MISSING');
    return {
      value: {
        checkerId: 'bola_rest_read',
        candidateId: candidate.id,
        evidenceIds: candidate.evidenceIds,
        rationaleCode: 'OBSERVED_OWNER_DETAIL',
        hypothesis: 'alternate_account_reads_owner_object',
        confidence: 'medium',
        limitations: ['single_object', 'two_accounts', 'bounded_get_only'],
      },
      modelId: 'local-deterministic-sherlock',
      usageTokens: 100,
    };
  },
  async interpret() {
    throw new Error('CRASH_CHILD_INTERPRET_UNREACHABLE');
  },
  async review() {
    throw new Error('CRASH_CHILD_REVIEW_UNREACHABLE');
  },
};

const server = await startControlPlane(
  settings,
  0,
  undefined,
  boundary,
  undefined,
  undefined,
  models,
  async () => {
    process.stdout.write('VERIFIER_READY\n');
    await new Promise<void>(() => undefined);
  },
  process.env.BOLA_CRASH_WINDOW === 'post-build'
    ? async (kind, _tag, _imageId) => {
        if (kind === 'gateway') {
          process.stdout.write('IMAGE_BUILT_BEFORE_RECEIPT\n');
          await new Promise<void>(() => undefined);
        }
      }
    : undefined,
);
process.stdout.write(`SERVER_READY ${server.url}\n`);
