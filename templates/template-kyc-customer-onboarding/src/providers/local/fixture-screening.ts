import type {
  PepScreeningProvider,
  SanctionsScreeningProvider,
  ScreeningInput,
  ScreeningProviderResult,
} from '../../contracts/providers/screening.js';
import { screeningInputSchema } from '../../contracts/providers/screening.js';
import type { ProviderExecutionContext } from '../../contracts/shared/execution-context.js';
import type { ProviderCapabilities } from '../../contracts/shared/provider.js';
import type { Clock } from '../../contracts/technical/primitives.js';
import { classifyScreeningScore, loadScreeningPolicy } from '../../config/policies/screening.js';
import { screeningResultSchema } from '../../domain/verification.js';
import { SystemClock } from './deterministic-primitives.js';
import { providerTimestamp } from './provider-time.js';
import { executeProviderOperation, parseProviderBoundary, parseProviderResult } from './provider-validation.js';

const capabilities = (operation: 'SANCTIONS_SCREENING' | 'PEP_SCREENING'): ProviderCapabilities =>
  Object.freeze({
    operations: [operation],
    environments: ['test', 'demo-default', 'demo-strict'],
    externalNetwork: false,
    idempotent: true,
    supportedPiiModes: ['demo-default', 'demo-strict'],
    acceptedPii: ['IDENTITY', 'DATE_OF_BIRTH', 'SCREENING'],
    documentMimeTypes: [],
    jurisdictions: ['US'],
  } satisfies ProviderCapabilities);

const screen = (
  id: string,
  kind: 'SANCTIONS' | 'PEP',
  input: ScreeningInput,
  context: ProviderExecutionContext,
  clock: Clock,
): ScreeningProviderResult => {
  const normalizedName = input.fullName.toUpperCase();
  const syntheticFailure = normalizedName.includes('INCONCLUSIVE')
    ? ('INCONCLUSIVE' as const)
    : normalizedName.includes('ERROR')
      ? ('ERROR' as const)
      : null;
  const appliesToKind =
    (!normalizedName.includes('SANCTIONS') && !normalizedName.includes('PEP')) || normalizedName.includes(kind);
  const score = !appliesToKind
    ? null
    : normalizedName.includes('STRONG')
      ? 0.9
      : normalizedName.includes('CANDIDATE')
        ? 0.75
        : normalizedName.includes('BELOW THRESHOLD')
          ? 0.6
          : null;
  const scope =
    kind === 'SANCTIONS' ? loadScreeningPolicy('demo-default').sanctions : loadScreeningPolicy('demo-default').pep;
  const classification = score === null ? null : classifyScreeningScore(score, scope);
  const materialClassification =
    classification === 'POSSIBLE' || classification === 'STRONG_REVIEW' ? classification : null;
  return {
    kind,
    status:
      syntheticFailure ??
      (materialClassification === 'STRONG_REVIEW'
        ? 'STRONG_CANDIDATE'
        : materialClassification === 'POSSIBLE'
          ? 'POSSIBLE_MATCH'
          : 'CLEAR'),
    candidates:
      materialClassification === null || score === null
        ? []
        : [
            {
              candidateId: `${kind.toLowerCase()}-fixture-1`,
              score,
              classification: materialClassification,
              topics: [...scope.topics],
              datasets: ['synthetic-fixture'],
              evidenceIds: [],
            },
          ],
    reasonCodes: [
      syntheticFailure === 'INCONCLUSIVE'
        ? 'SYNTHETIC_PROVIDER_INCONCLUSIVE'
        : syntheticFailure === 'ERROR'
          ? 'SYNTHETIC_PROVIDER_ERROR'
          : materialClassification === 'STRONG_REVIEW'
            ? 'SYNTHETIC_STRONG_CANDIDATE'
            : materialClassification === 'POSSIBLE'
              ? 'SYNTHETIC_POSSIBLE_MATCH'
              : 'NO_MATERIAL_FIXTURE_MATCH',
    ],
    providerId: id,
    providerVersion: '1.0.0',
    completedAt: providerTimestamp(clock, context, id, kind === 'SANCTIONS' ? 'SANCTIONS_SCREENING' : 'PEP_SCREENING'),
  };
};

export class FixtureSanctionsScreeningProvider implements SanctionsScreeningProvider {
  readonly id = 'fixture-sanctions';
  readonly version = '1.0.0';
  readonly capabilities = capabilities('SANCTIONS_SCREENING');
  constructor(private readonly clock: Clock = new SystemClock()) {}
  async screen(input: ScreeningInput, context: ProviderExecutionContext): Promise<ScreeningProviderResult> {
    const identity = {
      providerId: this.id,
      operation: 'SANCTIONS_SCREENING' as const,
    };
    return executeProviderOperation(identity, () => {
      const boundary = parseProviderBoundary(screeningInputSchema, input, context, identity);
      return parseProviderResult(
        screeningResultSchema,
        screen(this.id, 'SANCTIONS', boundary.input, boundary.context, this.clock),
        identity,
      );
    });
  }
}

export class FixturePepScreeningProvider implements PepScreeningProvider {
  readonly id = 'fixture-pep';
  readonly version = '1.0.0';
  readonly capabilities = capabilities('PEP_SCREENING');
  constructor(private readonly clock: Clock = new SystemClock()) {}
  async screen(input: ScreeningInput, context: ProviderExecutionContext): Promise<ScreeningProviderResult> {
    const identity = {
      providerId: this.id,
      operation: 'PEP_SCREENING' as const,
    };
    return executeProviderOperation(identity, () => {
      const boundary = parseProviderBoundary(screeningInputSchema, input, context, identity);
      return parseProviderResult(
        screeningResultSchema,
        screen(this.id, 'PEP', boundary.input, boundary.context, this.clock),
        identity,
      );
    });
  }
}
