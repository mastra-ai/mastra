import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
} from "@ai-sdk/provider";

/** Exact-microUSD DEC-016 accounting for one validation execution. */
export type BudgetMode = "ci-eval" | "sandbox";
export const budgetLimitMicros: Record<BudgetMode, bigint> = {
  "ci-eval": 5_000_000n,
  sandbox: 10_000_000n,
};

export interface BudgetReservation {
  id: string;
  estimatedMicros: bigint;
  /** Opaque ledger identity rejects a copied reservation from another run. */
  issuer: string;
}

export class EvalBudgetLedger {
  private reserved = 0n;
  private actual = 0n;
  private readonly reservations = new Map<string, bigint>();
  private readonly issuer = crypto.randomUUID();
  constructor(readonly mode: BudgetMode) {}

  reserve(estimatedMicros: bigint): BudgetReservation {
    if (estimatedMicros <= 0n)
      throw new Error("Model request has unknown or invalid price estimate.");
    if (
      this.actual + this.reserved + estimatedMicros >=
      budgetLimitMicros[this.mode]
    )
      throw new Error(`Evaluation budget exhausted for ${this.mode}.`);
    this.reserved += estimatedMicros;
    const id = crypto.randomUUID();
    this.reservations.set(id, estimatedMicros);
    return { id, estimatedMicros, issuer: this.issuer };
  }

  reconcile(reservation: BudgetReservation, actualMicros: bigint) {
    const reservedMicros = this.reservations.get(reservation.id);
    if (
      reservedMicros === undefined ||
      reservation.estimatedMicros !== reservedMicros ||
      reservation.issuer !== this.issuer
    )
      throw new Error(
        "Unknown, foreign, or already reconciled budget reservation.",
      );
    if (actualMicros < 0n)
      throw new Error("Model request has unknown or invalid actual usage.");
    if (actualMicros > reservedMicros)
      throw new Error("Actual model usage exceeded the pre-call reservation.");
    if (this.actual + actualMicros >= budgetLimitMicros[this.mode])
      throw new Error(`Evaluation budget exhausted for ${this.mode}.`);
    this.actual += actualMicros;
    this.reserved -= reservedMicros;
    this.reservations.delete(reservation.id);
  }

  snapshot() {
    return {
      reservedMicros: this.reserved,
      actualMicros: this.actual,
      limitMicros: budgetLimitMicros[this.mode],
    };
  }
}

/** A ledger is deliberately created per validation run, never per process. */
export class ValidationBudgetExecution {
  readonly ledger: EvalBudgetLedger;
  readonly id = crypto.randomUUID();
  constructor(readonly mode: BudgetMode) {
    this.ledger = new EvalBudgetLedger(mode);
  }
}

export function createValidationBudgetExecution(mode: BudgetMode) {
  return new ValidationBudgetExecution(mode);
}

export async function withReservedModelBudget<T>(input: {
  execution: ValidationBudgetExecution;
  estimatedMicrosUsd: bigint;
  execute: () => Promise<{ value: T; actualMicrosUsd: bigint }>;
}): Promise<T> {
  const reservation = input.execution.ledger.reserve(input.estimatedMicrosUsd);
  const result = await input.execute();
  input.execution.ledger.reconcile(reservation, result.actualMicrosUsd);
  return result.value;
}

type Price =
  | { kind: "zero" }
  | { kind: "input-only"; inputMicrosPerMillion: bigint }
  | {
      kind: "input-output";
      inputMicrosPerMillion: bigint;
      outputMicrosPerMillion: bigint;
    };

const zeroCostValidationProviders = new Set(["phase003-test", "phase004-test"]);

/** Only prices committed here may enable a billable validation transport.
 * Unknown model prices fail before its transport is invoked. */
function priceForEmbedding(model: string): Price | undefined {
  return model === "openai/text-embedding-3-small"
    ? { kind: "input-only", inputMicrosPerMillion: 20_000n }
    : undefined;
}

function priceForLanguage(
  model: Pick<LanguageModelV2, "provider" | "modelId">,
): Price | undefined {
  return zeroCostValidationProviders.has(model.provider)
    ? { kind: "zero" }
    : undefined;
}

function nonnegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function ceilMicros(tokens: number, microsPerMillion: bigint) {
  const tokenCount = BigInt(tokens);
  return (tokenCount * microsPerMillion + 999_999n) / 1_000_000n;
}

function reserveAtLeastOneMicrousd(micros: bigint) {
  // A known deterministic transport is $0, but it still makes a reservation
  // so concurrent validation calls are accounted for atomically.
  return micros === 0n ? 1n : micros;
}

function estimatedInputTokens(options: LanguageModelV2CallOptions) {
  // Every model token contains at least one byte. UTF-8 length is therefore a
  // conservative finite upper bound without pretending to be a tokenizer.
  return Buffer.byteLength(JSON.stringify(options.prompt), "utf8");
}

function languageEstimate(
  model: Pick<LanguageModelV2, "provider" | "modelId">,
  options: LanguageModelV2CallOptions,
) {
  const price = priceForLanguage(model);
  if (!price)
    throw new Error(
      `Validation blocks ${model.provider}/${model.modelId}: unknown model price.`,
    );
  if (price.kind === "zero") return 1n;
  const maxOutput = nonnegativeInteger(options.maxOutputTokens);
  if (maxOutput === undefined)
    throw new Error(
      "Validation blocks a model call without max output tokens.",
    );
  const input = estimatedInputTokens(options);
  const inputCost = ceilMicros(input, price.inputMicrosPerMillion);
  const outputCost =
    price.kind === "input-output"
      ? ceilMicros(maxOutput, price.outputMicrosPerMillion)
      : 0n;
  return reserveAtLeastOneMicrousd(inputCost + outputCost);
}

function languageActual(
  model: Pick<LanguageModelV2, "provider" | "modelId">,
  usage: { inputTokens?: unknown; outputTokens?: unknown } | undefined,
) {
  const price = priceForLanguage(model);
  if (!price)
    throw new Error(
      `Validation blocks ${model.provider}/${model.modelId}: unknown model price.`,
    );
  const input = nonnegativeInteger(usage?.inputTokens);
  const output = nonnegativeInteger(usage?.outputTokens);
  if (input === undefined || output === undefined)
    throw new Error("Model request has unknown or invalid actual usage.");
  if (price.kind === "zero") return 0n;
  const inputCost = ceilMicros(input, price.inputMicrosPerMillion);
  const outputCost =
    price.kind === "input-output"
      ? ceilMicros(output, price.outputMicrosPerMillion)
      : 0n;
  return inputCost + outputCost;
}

/** Wraps the actual registered model instance for a validation-only run.
 * Normal application generation is intentionally not given this wrapper. */
export function budgetedLanguageModel(
  model: LanguageModelV2,
  execution: ValidationBudgetExecution,
): LanguageModelV2 {
  const guarded = Object.create(model) as LanguageModelV2;
  guarded.doGenerate = async (options) =>
    withReservedModelBudget({
      execution,
      estimatedMicrosUsd: languageEstimate(model, options),
      execute: async () => {
        const value = await model.doGenerate(options);
        return {
          value,
          actualMicrosUsd: languageActual(model, value.usage),
        };
      },
    });
  guarded.doStream = async () => {
    throw new Error(
      "Streaming model transports are not enabled for budgeted validation.",
    );
  };
  return guarded;
}

export async function budgetedEmbedding<
  T extends { usage?: { tokens: number } },
>(input: {
  execution?: ValidationBudgetExecution;
  model: string;
  values: string[];
  execute: () => Promise<T>;
}): Promise<T> {
  if (!input.execution) return input.execute();
  const price = priceForEmbedding(input.model);
  if (!price)
    throw new Error(
      `Validation blocks ${input.model}: unknown embedding price.`,
    );
  if (price.kind !== "input-only")
    throw new Error(
      `Validation blocks ${input.model}: invalid embedding price.`,
    );
  const estimatedTokens = input.values.reduce(
    (total, value) => total + Buffer.byteLength(value, "utf8"),
    0,
  );
  const estimatedMicrosUsd = reserveAtLeastOneMicrousd(
    ceilMicros(estimatedTokens, price.inputMicrosPerMillion),
  );
  return withReservedModelBudget({
    execution: input.execution,
    estimatedMicrosUsd,
    execute: async () => {
      const value = await input.execute();
      const tokens = nonnegativeInteger(value.usage?.tokens);
      if (tokens === undefined)
        throw new Error("Model request has unknown or invalid actual usage.");
      return {
        value,
        actualMicrosUsd: ceilMicros(tokens, price.inputMicrosPerMillion),
      };
    },
  });
}

export const validationBudgetRequestContextKey =
  "support.validationBudgetExecution";

export function validationExecutionFromRequestContext(
  requestContext: { getRaw?: (key: string) => unknown } | undefined,
) {
  const value = requestContext?.getRaw?.(validationBudgetRequestContextKey);
  return value instanceof ValidationBudgetExecution ? value : undefined;
}
