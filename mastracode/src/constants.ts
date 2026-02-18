// Default OM model - using gemini-2.5-flash for efficiency
export const DEFAULT_OM_MODEL_ID = process.env.DEFAULT_OM_MODEL_ID ?? "google/gemini-2.5-flash"

// Default OM thresholds — per-thread overrides are loaded from thread metadata
export const DEFAULT_OBS_THRESHOLD = 40_000
export const DEFAULT_REF_THRESHOLD = 50_000