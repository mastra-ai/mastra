/**
 * Signal vocabulary returned by x402station's preflight + forensics
 * endpoints. Critical signals (the ones that flip `ok` to `false`) are
 * marked in the inline comments. Full reference:
 * https://x402station.io/.well-known/x402.
 */
export type Signal =
  | 'unknown_endpoint'
  | 'no_history'
  | 'dead' // critical
  | 'zombie' // critical
  | 'decoy_price_extreme' // critical
  | 'suspicious_high_price'
  | 'slow'
  | 'new_provider'
  | 'dead_7d' // critical (forensics-only)
  | 'mostly_dead' // critical (forensics-only)
  | 'slow_p99'
  | 'price_outlier_high'
  | 'high_concentration';

/**
 * Settled-payment receipt. Returned alongside every paid tool response
 * so the agent can audit on-chain spend. Decoded from the
 * `x-payment-response` (or `payment-response`) header that x402's
 * facilitator attaches once a 402 challenge has been settled.
 *
 * If the header is present but the body fails base64 / JSON decode (e.g.
 * a misconfigured proxy stripped the encoding) the client surfaces
 * `{ raw, malformed: true }` rather than silently returning a stub —
 * spend-auditing branches can detect the mismatch instead of silently
 * consuming a stub object that satisfies the type but lacks
 * `transaction` / `network` / `payer`.
 */
export interface PaymentReceipt {
  transaction?: string;
  network?: string;
  payer?: string;
  /** Raw header value, populated only when decode failed. */
  raw?: string;
  /** True when the receipt header was present but couldn't be decoded. */
  malformed?: boolean;
  [key: string]: unknown;
}

export interface EndpointMetadata {
  url: string;
  service?: string;
  service_id?: string;
  provider?: string | null;
  price_usdc?: string | null;
  currency?: string | null;
  is_active?: boolean;
  uptime_1h_pct?: number | null;
  avg_latency_ms?: number | null;
  endpoint_first_seen?: string;
  service_first_seen?: string;
  [key: string]: unknown;
}

export interface PreflightResponse {
  ok: boolean;
  warnings: Signal[];
  metadata: EndpointMetadata;
  [key: string]: unknown;
}

export interface ForensicsHourBucket {
  bucket: string;
  probes: number;
  healthy: number;
  avg_latency_ms: number | null;
}

export interface ForensicsResponse {
  ok: boolean;
  warnings: Signal[];
  decoy_probability: number;
  metadata: EndpointMetadata;
  uptime: {
    probes_7d: number;
    healthy_7d: number;
    errors_7d: number;
    uptime_7d_pct: number;
    uptime_1h_pct: number;
    avg_latency_1h_ms: number | null;
    hourly: ForensicsHourBucket[];
  };
  latency: {
    p50_ms: number | null;
    p90_ms: number | null;
    p99_ms: number | null;
    max_ms: number | null;
  };
  status_codes: Record<string, number>;
  concentration: {
    group_size: number;
    catalog_total: number;
    concentration_pct: number;
    group_median_price_usdc: string | null;
    group_p90_price_usdc: string | null;
    price_ratio_to_median: number | null;
  };
  [key: string]: unknown;
}

export interface CatalogDecoyEntry {
  url: string;
  service_id: string;
  service_name: string;
  provider: string | null;
  price_usdc: string | null;
  currency: string | null;
  reasons: Array<'decoy_price_extreme' | 'zombie' | 'dead_7d' | 'mostly_dead'>;
  probes_7d: number;
  healthy_7d: number;
  uptime_7d_pct: number | null;
  last_probe_at: string | null;
}

export interface CatalogDecoysResponse {
  generated_at: string;
  counts: {
    total: number;
    by_reason: Record<string, number>;
  };
  truncated: boolean;
  entries: CatalogDecoyEntry[];
  [key: string]: unknown;
}

export interface WatchSubscribeResponse {
  watchId: string;
  /** 64-char hex secret. Returned ONCE — store it. HMAC seed for verifying delivery payloads. */
  secret: string;
  expiresAt: string;
  signals: Signal[];
  alertsPaid: number;
  alertsRemaining: number;
  endpointKnown: boolean;
  deliveryFormat: {
    method: string;
    headers: Record<string, string>;
    signatureScheme: string;
    retryPolicy: string;
    examplePayload: unknown;
  };
  statusUrl: string;
  unsubscribeUrl: string;
  [key: string]: unknown;
}

export interface WatchAlertSnapshot {
  id: string;
  firedSignals: Signal[];
  clearedSignals: Signal[];
  currentState: unknown;
  createdAt: string;
  deliveredAt: string | null;
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'skipped_quota_exceeded';
  deliveryAttempts: number;
  deliveryResponseCode: number | null;
}

export interface WatchStatusResponse {
  watchId: string;
  endpointUrl: string;
  webhookUrl: string;
  signals: Signal[];
  createdAt: string;
  expiresAt: string;
  alertsPaid: number;
  alertsSent: number;
  alertsRemaining: number;
  lastState: unknown;
  isActive: boolean;
  expired: boolean;
  recentAlerts: WatchAlertSnapshot[];
  [key: string]: unknown;
}

export interface WatchUnsubscribeResponse {
  watchId: string;
  isActive: false;
  message: string;
}

/** Wraps a paid response with its payment receipt for spend auditing. */
export interface PaidResponse<T> {
  result: T;
  paymentReceipt: PaymentReceipt | null;
}
