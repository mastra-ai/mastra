import {
  assertDatabaseIsolation,
  databaseProfile,
  hasExplicitExternalMode,
  isLocalMode,
} from "../config/app-mode.mjs";

const profile = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--profile="))
  ?.slice("--profile=".length);
const mode =
  process.argv
    .slice(2)
    .find((argument) => argument.startsWith("--mode="))
    ?.slice("--mode=".length) || "interactive";

if (profile && !["local", "intercom", "stripe", "auto"].includes(profile))
  throw new Error(
    "Unknown environment profile. Use local, intercom, stripe, or auto.",
  );
if (!["interactive", "deterministic"].includes(mode))
  throw new Error(
    "Unknown environment mode. Use interactive or deterministic.",
  );

const errors = [];
const value = (name) => process.env[name]?.trim() || undefined;
let selectedDatabase;
try {
  assertDatabaseIsolation(process.env);
  selectedDatabase = databaseProfile(process.env);
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}
const source = isLocalMode(process.env)
  ? "mock"
  : value("SUPPORT_SOURCE")?.toLowerCase() || "mock";
const commerce = isLocalMode(process.env)
  ? "mock"
  : value("COMMERCE_SOURCE")?.toLowerCase() || "mock";
const selected = {
  intercom:
    source === "intercom" ||
    profile === "intercom" ||
    hasExplicitExternalMode(),
  stripe:
    commerce === "stripe" || profile === "stripe" || hasExplicitExternalMode(),
};

const requireValue = (name, condition, message = `${name} is required.`) => {
  if (condition && !value(name)) errors.push(message);
};
const requireTrue = (name, condition) => {
  if (condition && value(name)?.toLowerCase() !== "true")
    errors.push(`${name} must be true.`);
};
const validateOrigin = (name, allowed, condition) => {
  if (!condition || !value(name)) return;
  try {
    const url = new URL(value(name));
    if (!allowed.has(url.origin) || url.pathname !== "/")
      errors.push(`${name} must use an approved provider API origin.`);
  } catch {
    errors.push(`${name} must be a valid URL.`);
  }
};

if (!["mock", "intercom"].includes(source))
  errors.push('SUPPORT_SOURCE must be "mock" or "intercom".');
if (!["mock", "stripe"].includes(commerce))
  errors.push('COMMERCE_SOURCE must be "mock" or "stripe".');

requireValue(
  "LOCAL_AUTH_SIGNING_KEY",
  true,
  "LOCAL_AUTH_SIGNING_KEY is required for the authenticated local demo.",
);
if (
  value("LOCAL_AUTH_SIGNING_KEY") &&
  value("LOCAL_AUTH_SIGNING_KEY").length < 32
)
  errors.push("LOCAL_AUTH_SIGNING_KEY must be at least 32 characters.");
if (
  isLocalMode(process.env) &&
  selectedDatabase?.backend &&
  !selectedDatabase.backend.startsWith("file:")
)
  errors.push(
    "LOCAL_DEMO_DATABASE_URL must use a file: URL for the local profile.",
  );

requireValue(
  "OPENAI_API_KEY",
  mode === "interactive",
  "OPENAI_API_KEY is required for interactive mode.",
);

for (const [name, maximum] of [
  ["SUPPORT_RETENTION_RAW_PAYLOAD_DAYS", 7],
  ["SUPPORT_RETENTION_CASE_DAYS", 90],
  ["SUPPORT_RETENTION_TRACE_DAYS", 30],
  ["SUPPORT_RETENTION_FINANCIAL_AUDIT_DAYS", 365],
]) {
  const configured = value(name);
  if (
    configured &&
    (!/^\d+$/.test(configured) ||
      Number(configured) < 1 ||
      Number(configured) > maximum)
  )
    errors.push(`${name} must be an integer from 1 through ${maximum}.`);
}
const sweepMs = value("SUPPORT_RETENTION_SWEEP_MS");
if (
  sweepMs &&
  (!/^\d+$/.test(sweepMs) ||
    Number(sweepMs) < 60_000 ||
    Number(sweepMs) > 604_800_000)
)
  errors.push(
    "SUPPORT_RETENTION_SWEEP_MS must be an integer from 60000 through 604800000.",
  );

if (selected.intercom) {
  if (profile === "intercom" && source !== "intercom")
    errors.push('SUPPORT_SOURCE must be "intercom" for the Intercom profile.');
  requireTrue("INTERCOM_DEVELOPMENT_ENABLED", true);
  for (const name of [
    "INTERCOM_TENANT_ID",
    "INTERCOM_APP_ID",
    "INTERCOM_ACCESS_TOKEN",
    "INTERCOM_CLIENT_SECRET",
    "INTERCOM_ADMIN_ID",
  ])
    requireValue(name, true);
  if (
    value("INTERCOM_TENANT_ID") &&
    value("INTERCOM_TENANT_ID") !== "local-demo"
  )
    errors.push("INTERCOM_TENANT_ID must be local-demo.");
  if (value("INTERCOM_TICKET_STATE_ID") && !value("INTERCOM_TICKET_TYPE_ID"))
    errors.push("INTERCOM_TICKET_STATE_ID requires INTERCOM_TICKET_TYPE_ID.");
  validateOrigin(
    "INTERCOM_API_BASE_URL",
    new Set(["https://api.intercom.io", "https://api.eu.intercom.io"]),
    true,
  );
}

if (selected.stripe) {
  if (profile === "stripe" && commerce !== "stripe")
    errors.push('COMMERCE_SOURCE must be "stripe" for the Stripe profile.');
  requireTrue("STRIPE_SANDBOX_ENABLED", true);
  for (const name of [
    "STRIPE_TENANT_ID",
    "STRIPE_ACCOUNT_ID",
    "STRIPE_RESTRICTED_API_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ])
    requireValue(name, true);
  if (value("STRIPE_TENANT_ID") && value("STRIPE_TENANT_ID") !== "local-demo")
    errors.push("STRIPE_TENANT_ID must be local-demo.");
  if (
    value("STRIPE_RESTRICTED_API_KEY") &&
    !value("STRIPE_RESTRICTED_API_KEY").startsWith("rk_test_")
  )
    errors.push(
      "STRIPE_RESTRICTED_API_KEY must be a Stripe test restricted key.",
    );
  validateOrigin(
    "STRIPE_API_BASE_URL",
    new Set(["https://api.stripe.com"]),
    true,
  );
}

if (errors.length)
  throw new Error(`Environment validation failed:\n- ${errors.join("\n- ")}`);
console.log(
  `Environment profile ${profile || "auto"} is valid in ${mode} mode.`,
);
