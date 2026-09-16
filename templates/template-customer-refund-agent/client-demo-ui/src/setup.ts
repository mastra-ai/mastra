import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  realpath,
  rename,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { seedCustomers, type Seed } from "./seed.js";
import {
  appMode,
  assertDatabaseIsolation,
  hasExplicitExternalMode,
} from "../../config/app-mode.mjs";
import {
  isInside,
  privateDirectoryConfiguration,
} from "./private-directory.js";

const STRIPE_VERSION = "2026-08-26.dahlia";
const INTERCOM_VERSION = "2.16";
const stripeOrigin = "https://api.stripe.com";
const intercomOrigin = "https://api.intercom.io";
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1_000;
const GIVEN_NAMES = [
  "Avery",
  "Cameron",
  "Devon",
  "Emery",
  "Harper",
  "Jules",
  "Kai",
  "Lena",
  "Marlowe",
  "Noor",
  "Quinn",
  "Rowan",
] as const;
const FAMILY_NAMES = [
  "Bennett",
  "Caldwell",
  "Dawson",
  "Ellis",
  "Foster",
  "Garcia",
  "Hale",
  "Irving",
  "Jensen",
  "Kim",
  "Linden",
  "Morgan",
] as const;

export function displayName(run: string, scenario: string) {
  const digest = createHash("sha256").update(`${run}:${scenario}`).digest();
  return `${GIVEN_NAMES[digest[0]! % GIVEN_NAMES.length]} ${FAMILY_NAMES[digest[1]! % FAMILY_NAMES.length]}`;
}

type Manifest = {
  run: string;
  createdAt: string;
  stripeAccount?: string;
  intercomApp?: string;
  complete?: boolean;
  customers: Record<
    string,
    Seed & Record<string, string | boolean | undefined>
  >;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for demo:setup.`);
  return value;
}

function runId() {
  const index = process.argv.indexOf("--run");
  if (index !== -1) return process.argv[index + 1] || "";
  return `${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex")}`;
}

function password() {
  return randomBytes(18).toString("base64url");
}

async function json(
  fetchImpl: typeof fetch,
  origin: string,
  path: string,
  init: RequestInit,
  headers: Record<string, string>,
) {
  const target = new URL(path, `${origin}/`);
  if (target.origin !== origin)
    throw new Error("Provider destination is invalid.");
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetchImpl(target, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", ...headers, ...init.headers },
  });
  if (!response.ok)
    throw new Error(
      `${origin === stripeOrigin ? "Stripe" : "Intercom"} ${method} ${target.pathname} failed with HTTP ${response.status}.`,
    );
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Provider setup response is malformed.");
  return value as Record<string, unknown>;
}

function id(value: Record<string, unknown>, kind: string) {
  if (typeof value.id !== "string" || !value.id)
    throw new Error(`${kind} response has no id.`);
  return value.id;
}

function verifiedTimestamp(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} has no verified provider timestamp.`);
  return new Date(value * 1_000).toISOString();
}

function paidInvoiceTimestamp(invoice: Record<string, unknown>, label: string) {
  const transitions = invoice.status_transitions;
  if (!transitions || typeof transitions !== "object")
    throw new Error(`${label} has no verified provider timestamp.`);
  return verifiedTimestamp(
    (transitions as Record<string, unknown>).paid_at,
    label,
  );
}

function form(fields: Record<string, string | number | boolean | undefined>) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(fields))
    if (value !== undefined) result.set(key, String(value));
  return result;
}

function setupConfig() {
  if (appMode() === "local")
    throw new Error("demo:setup is unavailable when APP_MODE=local.");
  // Validate the selected external profile before creating a manifest,
  // directory, database, or provider resource. APP_MODE is authoritative;
  // legacy external opt-ins retain their existing source selection only when
  // APP_MODE is absent.
  assertDatabaseIsolation();
  const explicitExternal = hasExplicitExternalMode();
  const stripeKey = required("STRIPE_RESTRICTED_API_KEY");
  if (
    process.env.STRIPE_SANDBOX_ENABLED !== "true" ||
    (!explicitExternal && process.env.COMMERCE_SOURCE !== "stripe") ||
    !stripeKey.startsWith("rk_test_") ||
    required("STRIPE_TENANT_ID") !== "local-demo" ||
    (process.env.STRIPE_API_BASE_URL &&
      process.env.STRIPE_API_BASE_URL !== stripeOrigin)
  )
    throw new Error("demo:setup requires the configured Stripe test sandbox.");
  if (
    process.env.INTERCOM_DEVELOPMENT_ENABLED !== "true" ||
    (!explicitExternal && process.env.SUPPORT_SOURCE !== "intercom") ||
    required("INTERCOM_TENANT_ID") !== "local-demo" ||
    (process.env.INTERCOM_API_BASE_URL &&
      process.env.INTERCOM_API_BASE_URL !== intercomOrigin)
  )
    throw new Error(
      "demo:setup requires the configured Intercom development account.",
    );
  required("INTERCOM_MESSENGER_JWT_SECRET");
  required("DEMO_AUTH_BRIDGE_SIGNING_KEY");
  required("LOCAL_AUTH_SIGNING_KEY");
  return {
    stripeKey,
    stripeAccount: required("STRIPE_ACCOUNT_ID"),
    intercomToken: required("INTERCOM_ACCESS_TOKEN"),
    intercomApp: required("INTERCOM_APP_ID"),
  };
}

async function readManifest(path: string, run: string): Promise<Manifest> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Manifest;
    if (value.run !== run || !value.customers)
      throw new Error("Invalid manifest.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { run, createdAt: new Date().toISOString(), customers: {} };
    throw error;
  }
}

async function saveManifest(path: string, manifest: Manifest) {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function runSetup({ fetchImpl = fetch } = {}) {
  const config = setupConfig();
  const run = runId();
  if (!/^[a-zA-Z0-9-]{6,80}$/.test(run))
    throw new Error("--run must contain 6-80 letters, numbers, or hyphens.");
  const { repository, requested: requestedPrivateDirectory } =
    await privateDirectoryConfiguration({
      templateRoot: resolve(import.meta.dirname, "../.."),
      requestedDirectory: process.env.DEMO_PRIVATE_DIR,
    });
  await mkdir(requestedPrivateDirectory, { recursive: true, mode: 0o700 });
  const privateDirectory = await realpath(requestedPrivateDirectory);
  if (isInside(repository, privateDirectory))
    throw new Error("DEMO_PRIVATE_DIR must be outside the Git repository.");
  await chmod(privateDirectory, 0o700);
  const manifestPath = resolve(privateDirectory, `demo-round-${run}.json`);
  const manifest = await readManifest(manifestPath, run);
  if (
    !manifest.complete &&
    Date.now() - Date.parse(manifest.createdAt) > RETRY_WINDOW_MS
  )
    throw new Error(
      "An incomplete --run is older than Stripe idempotency safety window; use a new run.",
    );
  if (
    (manifest.stripeAccount &&
      manifest.stripeAccount !== config.stripeAccount) ||
    (manifest.intercomApp && manifest.intercomApp !== config.intercomApp)
  )
    throw new Error(
      "This --run belongs to a different configured sandbox account.",
    );
  const stripeHeaders = {
    Authorization: `Bearer ${config.stripeKey}`,
    "Stripe-Version": STRIPE_VERSION,
  };
  const intercomHeaders = {
    Authorization: `Bearer ${config.intercomToken}`,
    "Intercom-Version": INTERCOM_VERSION,
    "Content-Type": "application/json",
  };
  const account = await json(
    fetchImpl,
    stripeOrigin,
    "/v1/account",
    {},
    stripeHeaders,
  );
  if (
    id(account, "Stripe account") !== config.stripeAccount ||
    account.livemode === true
  )
    throw new Error(
      "Stripe credential account is not the configured test account.",
    );
  const intercomMe = await json(
    fetchImpl,
    intercomOrigin,
    "/me",
    {},
    intercomHeaders,
  );
  const app = intercomMe.app;
  if (
    !app ||
    typeof app !== "object" ||
    (app as Record<string, unknown>).id_code !== config.intercomApp
  )
    throw new Error(
      "Intercom token is not for the configured development app.",
    );
  manifest.stripeAccount = config.stripeAccount;
  manifest.intercomApp = config.intercomApp;
  await saveManifest(manifestPath, manifest);

  async function stripe(path: string, data?: URLSearchParams, key?: string) {
    return json(
      fetchImpl,
      stripeOrigin,
      path,
      data
        ? {
            method: "POST",
            body: data,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              ...(key ? { "Idempotency-Key": `${run}:${key}` } : {}),
            },
          }
        : {},
      stripeHeaders,
    );
  }
  async function customer(person: string, email: string, name: string) {
    const current = manifest.customers[person];
    if (current?.stripeCustomerId) return current.stripeCustomerId;
    const listed = await stripe(`/v1/customers?${form({ email }).toString()}`);
    const matches = Array.isArray(listed.data)
      ? listed.data.filter(
          (value) =>
            value &&
            typeof value === "object" &&
            (value as Record<string, unknown>).email === email,
        )
      : [];
    if (matches.length > 1)
      throw new Error(`Stripe customer lookup is ambiguous for ${person}.`);
    const resource =
      (matches[0] as Record<string, unknown> | undefined) ??
      (await stripe(
        "/v1/customers",
        form({
          email,
          name,
          "metadata[demo_run]": run,
          "metadata[demo_id]": `demo-${run}-${person}`,
        }),
        `${person}:customer`,
      ));
    if (resource.livemode !== false)
      throw new Error("Stripe customer is not a test-mode resource.");
    return id(resource, "Stripe customer");
  }
  async function contact(
    person: string,
    entry: Seed & Record<string, string | boolean | undefined>,
  ) {
    if (entry.intercomContactId) return entry.intercomContactId;
    const externalId = entry.id;
    const found = await json(
      fetchImpl,
      intercomOrigin,
      "/contacts/search",
      {
        method: "POST",
        body: JSON.stringify({
          query: {
            operator: "AND",
            value: [{ field: "external_id", operator: "=", value: externalId }],
          },
        }),
      },
      intercomHeaders,
    );
    const matches = Array.isArray(found.data) ? found.data : [];
    if (matches.length > 1)
      throw new Error(`Intercom contact lookup is ambiguous for ${person}.`);
    const resource =
      matches[0] && typeof matches[0] === "object"
        ? (matches[0] as Record<string, unknown>)
        : await json(
            fetchImpl,
            intercomOrigin,
            "/contacts",
            {
              method: "POST",
              body: JSON.stringify({
                role: "user",
                external_id: externalId,
                email: entry.email,
                name: entry.name,
              }),
            },
            intercomHeaders,
          );
    return id(resource, "Intercom contact");
  }
  async function paymentMethod(person: string, customerId: string) {
    const current = manifest.customers[person];
    if (current?.paymentMethodId) return current.paymentMethodId;
    const payment = await stripe(
      "/v1/payment_methods",
      form({ type: "card", "card[token]": "tok_visa" }),
      `${person}:payment-method`,
    );
    const paymentId = id(payment, "Stripe payment method");
    await stripe(
      `/v1/payment_methods/${encodeURIComponent(paymentId)}/attach`,
      form({ customer: customerId }),
      `${person}:attach-payment-method`,
    );
    await stripe(
      `/v1/customers/${encodeURIComponent(customerId)}`,
      form({ "invoice_settings[default_payment_method]": paymentId }),
      `${person}:default-payment-method`,
    );
    return paymentId;
  }
  async function person(
    name: string,
    scenario: Seed["scenario"],
    paid = false,
  ) {
    const current = manifest.customers[name];
    const entry = current ?? {
      id: `demo-${run}-${name}`,
      // Persist this immediately with the rest of the manifest. A resumed
      // --run reads the same entry and cannot rename a provider identity.
      name: displayName(run, name),
      email: `${name}.${run}@example.test`,
      password: password(),
      scenario,
      tenantId: "local-demo",
      stripeCustomerId: "",
      intercomContactId: "",
      purchasePaid: paid,
    };
    entry.stripeCustomerId = await customer(name, entry.email, entry.name);
    entry.intercomContactId = await contact(name, entry);
    manifest.customers[name] = entry;
    await saveManifest(manifestPath, manifest);
    return entry;
  }

  const alex = await person("alex", "refund");
  const alexPayment = await paymentMethod("alex", alex.stripeCustomerId);
  if (!alex.invoiceId) {
    const invoice = await stripe(
      "/v1/invoices",
      form({
        customer: alex.stripeCustomerId,
        auto_advance: false,
        collection_method: "charge_automatically",
        description: "API Credits",
        "metadata[demo_run]": run,
        "metadata[demo_id]": alex.id,
      }),
      "alex:invoice",
    );
    alex.invoiceId = id(invoice, "Alex invoice");
    await stripe(
      "/v1/invoiceitems",
      form({
        customer: alex.stripeCustomerId,
        invoice: alex.invoiceId,
        amount: 500,
        currency: "usd",
        description: "API Credits",
      }),
      "alex:invoice-item",
    );
    const finalized = await stripe(
      `/v1/invoices/${encodeURIComponent(alex.invoiceId)}/finalize`,
      form({}),
      "alex:finalize-invoice",
    );
    const paid = await stripe(
      `/v1/invoices/${encodeURIComponent(id(finalized, "Alex invoice"))}/pay`,
      form({}),
      "alex:pay-invoice",
    );
    if (
      paid.livemode !== false ||
      !(paid.status === "paid" || paid.paid === true) ||
      paid.amount_paid !== 500 ||
      paid.currency !== "usd"
    )
      throw new Error("Alex invoice is not a paid USD 5 test-mode purchase.");
    alex.paymentIntentId =
      typeof paid.payment_intent === "string" ? paid.payment_intent : undefined;
    alex.purchase = {
      product: "API Credits",
      amountMinor: 500,
      currency: "USD",
      purchasedAt: paidInvoiceTimestamp(paid, "Alex invoice"),
    };
    alex.paymentMethodId = alexPayment;
    alex.purchasePaid = true;
    await saveManifest(manifestPath, manifest);
  }

  const jordan = await person("jordan", "credit");
  const jordanPayment = await paymentMethod("jordan", jordan.stripeCustomerId);
  if (!jordan.subscriptionId) {
    const product = await stripe(
      "/v1/products",
      form({
        name: "Workspace",
        "metadata[demo_run]": run,
      }),
      "jordan:product",
    );
    const price = await stripe(
      "/v1/prices",
      form({
        product: id(product, "Jordan product"),
        unit_amount: 4900,
        currency: "usd",
        "recurring[interval]": "month",
        "metadata[demo_run]": run,
      }),
      "jordan:price",
    );
    const subscription = await stripe(
      "/v1/subscriptions",
      form({
        customer: jordan.stripeCustomerId,
        "items[0][price]": id(price, "Jordan price"),
        "items[0][quantity]": 1,
        default_payment_method: jordanPayment,
        payment_behavior: "error_if_incomplete",
        "metadata[demo_run]": run,
      }),
      "jordan:subscription",
    );
    if (subscription.status !== "active" || subscription.livemode !== false)
      throw new Error(
        "Jordan subscription is not an active test-mode subscription.",
      );
    jordan.subscriptionId = id(subscription, "Jordan subscription");
    if (typeof subscription.latest_invoice !== "string")
      throw new Error("Jordan subscription has no latest invoice.");
    const latestInvoice = await stripe(
      `/v1/invoices/${encodeURIComponent(subscription.latest_invoice)}`,
    );
    if (
      latestInvoice.livemode !== false ||
      !(latestInvoice.status === "paid" || latestInvoice.paid === true) ||
      latestInvoice.amount_paid !== 4900 ||
      latestInvoice.currency !== "usd"
    )
      throw new Error(
        "Jordan subscription is not paid at USD 49 in test mode.",
      );
    jordan.invoiceId = id(latestInvoice, "Jordan invoice");
    jordan.paymentIntentId =
      typeof latestInvoice.payment_intent === "string"
        ? latestInvoice.payment_intent
        : undefined;
    const subscriptionItems = subscription.items;
    const itemData =
      subscriptionItems && typeof subscriptionItems === "object"
        ? (subscriptionItems as Record<string, unknown>).data
        : undefined;
    if (
      !Array.isArray(itemData) ||
      itemData.length !== 1 ||
      !itemData[0] ||
      typeof itemData[0] !== "object"
    )
      throw new Error("Jordan subscription has no unambiguous billing period.");
    const subscriptionItem = itemData[0] as Record<string, unknown>;
    jordan.subscription = {
      plan: "Workspace",
      amountMinor: 4900,
      currency: "USD",
      interval: "month",
      startedAt: verifiedTimestamp(
        subscriptionItem.current_period_start,
        "Jordan subscription start",
      ),
      renewsAt: verifiedTimestamp(
        subscriptionItem.current_period_end,
        "Jordan subscription renewal",
      ),
    };
    jordan.paymentMethodId = jordanPayment;
    await saveManifest(manifestPath, manifest);
  }
  await person("sam", "knowledge");
  await seedCustomers(Object.values(manifest.customers));
  manifest.complete = true;
  await saveManifest(manifestPath, manifest);
  console.log(
    `Demo setup completed. Private credentials and provider mappings: ${manifestPath}`,
  );
}

if (process.argv[1]?.endsWith("setup.js")) await runSetup();
