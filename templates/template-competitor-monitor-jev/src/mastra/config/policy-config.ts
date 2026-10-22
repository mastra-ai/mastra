// Calibration seeds, not measured accuracy claims. No environment overrides;
// policy changes must be versioned and persisted with the effective run settings.
export const POLICY_DEFAULTS = {
  // P(substantive=true) in [0, 1]; minimum for substantive routing.
  minimumSubstantiveProbability: 0.7,
  // P(breaking=true) in [0, 1]; minimum for breaking-change routing.
  minimumBreakingProbability: 0.65,
  // Native Choice confidence in [0, 1]; below this requires review.
  minimumChoiceConfidence: 0.6,
  // Native Score confidence in [0, 1]; below this requires review.
  minimumScoreConfidence: 0.6,
  // Relevance rubric level in [0, 4]; minimum for an alert, without rounding answers.
  alertFromRelevanceLevel: 2,
  // Impact rubric level in [0, 4]; minimum for an alert, without rounding answers.
  alertFromImpactLevel: 2,
  // P(cosmetic=true) in [0, 1]; minimum for cosmetic routing.
  minimumCosmeticProbability: 0.7,
  // Probability difference in [0, 1] between the top two choices; below this requires review.
  minimumChoiceMargin: 0.1,
} as const;

// Fixed classifier contract boundaries; no overrides.
export const RUBRIC = {
  // Inclusive probability/confidence lower bound (dimensionless).
  minProbability: 0,
  // Inclusive probability/confidence upper bound (dimensionless).
  maxProbability: 1,
  // Inclusive score lower bound; scores represent ordered rubric levels.
  minScore: 0,
  // Inclusive score upper bound; fractional answers remain fractional.
  maxScore: 4,
} as const;

export const INPUT_LIMITS = {
  // Characters/identifier; bounds stable public monitor and source identities.
  maxIdentifierChars: 160,
  // Characters/human-readable source label or profile name; bounds workflow state.
  maxLabelChars: 300,
  // Characters/operator organization context; bounds untrusted workflow input and later model state.
  maxOrganizationContextChars: 4_000,
  // Characters/URL and CSS selector; bounds validation work before network access.
  maxUrlChars: 2_048,
  maxSelectorChars: 500,
  // Array lengths; bounds untrusted invocation metadata.
  maxSelectors: 30,
  maxSignals: 50,
  maxInterests: 9,
} as const;
