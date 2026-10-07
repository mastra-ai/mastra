import { join } from 'node:path';

import * as p from '@clack/prompts';
import { config as loadDotenv } from 'dotenv';
import pc from 'picocolors';

import { getToken, openBrowser } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';
import { resolveProject } from '../env/resolve-project.js';
import type { IntegrationAuthField, IntegrationCatalogEntry, OrgMember, ProjectConnection } from './api.js';
import {
  addConnectionToProject,
  createProjectConnectSession,
  fetchIntegrationCatalog,
  fetchOrgConnections,
  fetchOrgMembers,
  fetchProjectConnections,
  removeProjectConnection,
  updateConnectionDisplayName,
} from './api.js';
import {
  authFieldKey,
  authFieldsFor,
  isAuthFieldVisible,
  isCredentialAuthType,
  isOAuthAuthType,
  oauthConnectUrl,
  splitAuthValues,
  submitCredentialAuth,
} from './nango.js';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 5 * 60 * 1000;

interface ConnectContext {
  token: string;
  orgId: string;
  projectId: string;
  projectName: string;
}

/**
 * Env vars the `mastra connect` commands look at. We intentionally keep this
 * list narrow so loading `.env` can't quietly inject unrelated env into the
 * CLI's process.
 */
const CONNECT_ENV_KEYS = ['MASTRA_PROJECT_ID', 'MASTRA_PLATFORM_ACCESS_TOKEN', 'MASTRA_PLATFORM_SECRET_KEY'] as const;

/**
 * Load `.env` and `.env.local` from the current working directory, but only
 * promote the specific keys in `CONNECT_ENV_KEYS` into `process.env`. The
 * dotenv file may hold anything (database URLs, third-party keys, …); only
 * the three Mastra Connect vars are copied over.
 *
 * Already-exported env vars still win: if the caller already set
 * `MASTRA_PROJECT_ID` in their shell, the value in `.env` is ignored.
 * The loader is a no-op when the files are missing.
 */
function loadConnectEnv(): void {
  const cwd = process.cwd();
  const parsed: Record<string, string> = {};
  loadDotenv({
    path: [join(cwd, '.env'), join(cwd, '.env.local')],
    override: false,
    quiet: true,
    processEnv: parsed,
  });
  for (const key of CONNECT_ENV_KEYS) {
    if (process.env[key] === undefined && parsed[key] !== undefined) {
      process.env[key] = parsed[key];
    }
  }
}

async function resolveConnectContext(projectArg?: string): Promise<ConnectContext> {
  loadConnectEnv();
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, projectArg);
  return { token, orgId, projectId: project.id, projectName: project.name };
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

/**
 * Human name for a connection, mirroring the platform UI: the display name,
 * falling back to the provider account label. Empty when neither is known —
 * callers drop the label instead of ever showing a connection id.
 */
function connectionLabel(connection: ProjectConnection): string {
  return connection.displayName || connection.accountLabel || '';
}

function memberName(member: OrgMember | undefined): string | undefined {
  if (!member) return undefined;
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
  return name || member.email;
}

function formatConnectionDate(connection: ProjectConnection): string {
  const value = connection.connectedAt ?? connection.createdAt;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Aligned rows describing connections, mirroring the platform UI's account
 * picker: the connection's name first, then dimmed detail — the provider
 * account when a display name covers it, who connected it, and when.
 * Padding keeps the columns lined up in clack's select renderer.
 */
function connectionRows(
  connections: ProjectConnection[],
  memberByUserId: Map<string, OrgMember>,
): { id: string; text: string }[] {
  const rows = connections.map(connection => ({
    id: connection.id,
    name: connectionLabel(connection) || 'Account name unavailable',
    account:
      connection.displayName && connection.accountLabel && connection.displayName !== connection.accountLabel
        ? connection.accountLabel
        : '',
    by: `connected by ${memberName(memberByUserId.get(connection.connectedByUserId)) ?? 'a teammate'}`,
    date: formatConnectionDate(connection),
  }));
  const nameWidth = Math.max(...rows.map(row => row.name.length));
  const accountWidth = Math.max(...rows.map(row => row.account.length));
  const byWidth = Math.max(...rows.map(row => row.by.length));
  return rows.map(row => {
    const detail = [accountWidth > 0 ? row.account.padEnd(accountWidth) : '', row.by.padEnd(byWidth), row.date]
      .filter(Boolean)
      .join('  ')
      .trimEnd();
    return { id: row.id, text: `${row.name.padEnd(nameWidth)}  ${pc.dim(detail)}` };
  });
}

function connectionChoices(
  connections: ProjectConnection[],
  memberByUserId: Map<string, OrgMember>,
): { value: string; label: string }[] {
  return connectionRows(connections, memberByUserId).map(row => ({ value: row.id, label: row.text }));
}

/** Org member lookup for attributing connections to whoever connected them. */
async function fetchMemberMap(ctx: ConnectContext): Promise<Map<string, OrgMember>> {
  const members = await fetchOrgMembers(ctx.token, ctx.orgId).catch(() => [] as OrgMember[]);
  return new Map(members.map(member => [member.userId, member]));
}

// ---- mastra connect list ----

export async function listProvidersAction(options?: { project?: string }): Promise<void> {
  const ctx = await resolveConnectContext(options?.project);
  const spinner = p.spinner();
  spinner.start(`Fetching providers for ${ctx.projectName}`);
  let catalog: IntegrationCatalogEntry[];
  let connections: ProjectConnection[];
  let memberByUserId = new Map<string, OrgMember>();
  try {
    [catalog, connections] = await Promise.all([
      fetchIntegrationCatalog(ctx.token, ctx.orgId),
      fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId),
    ]);
    // Connections without an account label are attributed to whoever connected
    // them ("connected by Jane Doe"), which needs the org member list.
    if (connections.some(connection => !connection.displayName && !connection.accountLabel)) {
      memberByUserId = await fetchMemberMap(ctx);
    }
    spinner.stop(`Found ${connections.length} ${connections.length === 1 ? 'connection' : 'connections'}`);
  } catch (error) {
    spinner.stop('Could not load providers');
    throw error;
  }

  const byIntegration = new Map<string, ProjectConnection[]>();
  for (const connection of connections) {
    const list = byIntegration.get(connection.integrationId) ?? [];
    list.push(connection);
    byIntegration.set(connection.integrationId, list);
  }

  const entries = [...catalog].sort((a, b) => {
    const aConnected = byIntegration.has(a.id) ? 0 : 1;
    const bConnected = byIntegration.has(b.id) ? 0 : 1;
    return aConnected - bConnected || a.id.localeCompare(b.id);
  });

  console.info(`\nProviders for ${pc.bold(ctx.projectName)}:\n`);
  for (const entry of entries) {
    const rows = byIntegration.get(entry.id) ?? [];
    const active = rows.filter(row => row.status === 'active');
    const needsReauth = rows.filter(row => row.status === 'needs_reauth');

    if (active.length > 0) {
      const labels = active.map(connectionLabel).filter(Boolean);
      let detail: string;
      if (labels.length > 0) {
        detail = `— connected (${labels.join(', ')})`;
      } else {
        const names = [
          ...new Set(active.map(row => memberName(memberByUserId.get(row.connectedByUserId)) ?? 'a teammate')),
        ];
        detail = `— connected by ${names.join(', ')}`;
      }
      console.info(`  ${pc.green('●')} ${pc.green(entry.id)} ${pc.dim(detail)}`);
    } else if (needsReauth.length > 0) {
      console.info(`  ${pc.yellow('●')} ${pc.yellow(entry.id)} ${pc.dim('— needs reauth')}`);
    } else if (entry.comingSoon) {
      console.info(`  ${pc.gray('○')} ${pc.gray(entry.id)} ${pc.dim('— coming soon')}`);
    } else {
      console.info(`  ${pc.gray('○')} ${pc.gray(entry.id)}`);
    }
  }
  console.info(`\nConnect one with: ${pc.cyan('mastra connect add <provider>')}\n`);
}

// ---- mastra connect add ----

export async function connectProviderAction(
  provider: string,
  options?: { project?: string; yes?: boolean },
): Promise<void> {
  const ctx = await resolveConnectContext(options?.project);
  const preflightSpinner = p.spinner();
  preflightSpinner.start(`Looking up ${provider} in ${ctx.projectName}`);
  let catalog: IntegrationCatalogEntry[];
  let integration: IntegrationCatalogEntry;
  let projectConnections: ProjectConnection[];
  try {
    [catalog, projectConnections] = await Promise.all([
      fetchIntegrationCatalog(ctx.token, ctx.orgId),
      fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId),
    ]);
    integration = findIntegration(catalog, provider);
    preflightSpinner.stop(`Found ${integration.displayName}`);
  } catch (error) {
    preflightSpinner.stop(`Could not look up ${provider}`);
    throw error;
  }
  const existing = projectConnections.filter(
    connection => connection.integrationId === integration.id && connection.status === 'active',
  );
  if (existing.length > 0 && !options?.yes) {
    const accounts = existing.map(connectionLabel).filter(Boolean).join(', ');
    console.info(
      `${integration.displayName} is already connected to ${ctx.projectName}${accounts ? ` (${accounts})` : ''}.`,
    );
    if (!isInteractive()) {
      console.info('Pass --yes to add another connection.');
      return;
    }
    const proceed = await p.confirm({ message: 'Add another connection?' });
    if (p.isCancel(proceed) || !proceed) return;
  }

  // Offer to reuse an org-level connection that isn't attached to this
  // project yet, instead of walking through the provider's auth flow again.
  if (isInteractive() && !options?.yes) {
    const attachedIds = new Set(
      projectConnections.filter(connection => connection.integrationId === integration.id).map(row => row.id),
    );
    let orgConnections: ProjectConnection[] = [];
    const orgSpinner = p.spinner();
    orgSpinner.start(`Checking organization-wide ${integration.displayName} connections`);
    try {
      orgConnections = await fetchOrgConnections(ctx.token, ctx.orgId, integration.id);
      orgSpinner.stop(`Found ${orgConnections.length} ${orgConnections.length === 1 ? 'connection' : 'connections'}`);
    } catch {
      orgSpinner.stop('Could not check for existing connections in your organization. Creating a new one.');
    }
    const reusable = orgConnections.filter(row => row.status === 'active' && !attachedIds.has(row.id));

    if (reusable.length > 0) {
      const memberByUserId = await fetchMemberMap(ctx);

      const CREATE_NEW = '__create_new__';
      const choice = await p.select({
        message: `Your organization already has ${reusable.length === 1 ? 'a' : String(reusable.length)} ${integration.displayName} connection${reusable.length === 1 ? '' : 's'}. Use an existing one?`,
        options: [
          ...connectionChoices(reusable, memberByUserId),
          { value: CREATE_NEW, label: 'Create a new connection' },
        ],
      });
      if (p.isCancel(choice)) return;
      if (choice !== CREATE_NEW) {
        await addConnectionToProject(ctx.token, ctx.orgId, ctx.projectId, choice);
        const chosen = reusable.find(row => row.id === choice);
        const chosenLabel = chosen ? connectionLabel(chosen) : '';
        printConnected(ctx, integration, chosenLabel ? ` (${chosenLabel})` : '');
        return;
      }
    }
  }

  // Only collect fields the chosen auth path actually uses: credential auth
  // sends everything, OAuth only carries `params` into the consent URL, and
  // the hosted Connect UI renders its own forms.
  const allFields = authFieldsFor(integration.authType, integration.authFields);
  const fields = isCredentialAuthType(integration.authType)
    ? allFields
    : isOAuthAuthType(integration.authType)
      ? allFields.filter(field => field.target === 'params')
      : [];
  const needsForm = fields.length > 0;
  if (needsForm && !isInteractive()) {
    throw new Error(
      `${integration.displayName} needs credentials that must be entered interactively. Re-run in a terminal, or connect it from the platform UI.`,
    );
  }

  // Prompt before creating the session, so cancelling the form doesn't
  // leave a pending connection behind.
  const values = needsForm ? await promptAuthFields(integration, fields) : {};
  const { credentials, params } = splitAuthValues(fields, values);

  const session = await createProjectConnectSession(ctx.token, ctx.orgId, ctx.projectId, integration.id);

  if (isCredentialAuthType(integration.authType)) {
    if (!credentials) {
      throw new Error(`${integration.displayName} requires credentials.`);
    }
    const spinner = p.spinner();
    spinner.start('Verifying credentials with the provider');
    try {
      await submitCredentialAuth({
        integrationId: integration.id,
        authType: integration.authType,
        sessionToken: session.sessionToken,
        credentials,
        params,
      });
      spinner.stop('Credentials accepted');
    } catch (error) {
      spinner.stop('Authorization failed');
      // Rejected credentials leave the session's pending connection behind;
      // unlink it so it doesn't pile up in `mastra connect remove`.
      await removeProjectConnection(ctx.token, ctx.orgId, ctx.projectId, session.connectionId).catch(() => {});
      throw error;
    }
  } else {
    // OAuth goes straight to the provider's consent screen; any other auth
    // type falls back to Nango's hosted Connect UI, which renders the
    // provider-specific forms and setup guides.
    const url = isOAuthAuthType(integration.authType)
      ? oauthConnectUrl(integration.id, session.sessionToken, params)
      : session.connectUrl;
    console.info(`\nOpening your browser to authorize ${pc.bold(integration.displayName)}…`);
    console.info(pc.dim(`If it doesn't open, visit:\n  ${url}\n`));
    try {
      openBrowser(url);
    } catch {
      // URL is printed above; the user can open it manually.
    }
  }

  await waitForActiveConnection(ctx, session.connectionId);

  const connection = (await fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId)).find(
    row => row.id === session.connectionId,
  );

  let displayName: string | undefined;
  if (isInteractive() && !options?.yes) {
    displayName = await promptDisplayName(ctx, integration, session.connectionId, connection);
  }

  const label = displayName ?? (connection ? connectionLabel(connection) : '');
  printConnected(ctx, integration, label ? ` (${label})` : '');
}

/**
 * Offer to name the new connection so it can be told apart from other
 * connections to the same provider. Lists the provider's existing
 * connections, pre-fills a suggestion that does not collide with them, and
 * asks for confirmation if the chosen name duplicates another one.
 */
async function promptDisplayName(
  ctx: ConnectContext,
  integration: IntegrationCatalogEntry,
  connectionId: string,
  connection: ProjectConnection | undefined,
): Promise<string | undefined> {
  let others: ProjectConnection[] = [];
  try {
    others = (await fetchOrgConnections(ctx.token, ctx.orgId, integration.id)).filter(row => row.id !== connectionId);
  } catch {
    // Naming is optional polish; keep going without the collision context.
  }

  if (others.length > 0) {
    const memberByUserId = await fetchMemberMap(ctx);
    console.info(`\nYour organization's existing ${integration.displayName} connections:`);
    for (const row of connectionRows(others, memberByUserId)) {
      console.info(`  ${pc.dim('•')} ${row.text}`);
    }
  }

  const taken = new Set(
    others
      .flatMap(row => [row.displayName, row.accountLabel])
      .filter(Boolean)
      .map(value => value!.toLowerCase()),
  );
  const base = connection?.accountLabel || integration.displayName;
  let suggestion = base;
  for (let n = 2; taken.has(suggestion.toLowerCase()); n++) {
    suggestion = `${base} ${n}`;
  }

  for (;;) {
    const answer = await p.text({
      message: 'Set a display name so this connection is easy to tell apart (leave blank to skip)',
      initialValue: suggestion,
      validate: value =>
        value && value.trim().length > 100 ? 'Display names are limited to 100 characters.' : undefined,
    });
    if (p.isCancel(answer) || !answer || !String(answer).trim()) return undefined;
    const name = String(answer).trim();

    const duplicate = others.find(row => row.displayName?.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      const useAnyway = await p.confirm({
        message: `Another ${integration.displayName} connection is already named "${duplicate.displayName}". Use this name anyway?`,
      });
      if (p.isCancel(useAnyway)) return undefined;
      if (!useAnyway) continue;
    }

    // Accepting the suggestion often keeps the name the connection already
    // shows; renaming needs the org admin role, so skip the no-op PATCH.
    if (name === connection?.displayName || (!connection?.displayName && name === connection?.accountLabel)) {
      return name;
    }

    try {
      await updateConnectionDisplayName(ctx.token, ctx.orgId, connectionId, name);
      return name;
    } catch (error) {
      // Renaming needs the org admin role; the connection itself is fine.
      console.warn(pc.yellow(`Could not set the display name: ${error instanceof Error ? error.message : error}`));
      return undefined;
    }
  }
}

function printConnected(ctx: ConnectContext, integration: IntegrationCatalogEntry, account: string): void {
  console.info(`\n${pc.green('✓')} Connected ${pc.bold(integration.displayName)}${account} to ${ctx.projectName}.`);
  console.info(
    pc.dim(
      `\nYour agents pick it up through @mastra/connect:\n\n  import { tools } from '@mastra/connect';\n\n  const agentTools = tools({\n    projectId: process.env.MASTRA_PROJECT_ID,\n    integrations: ['${integration.id}'],\n  });\n`,
    ),
  );
}

function findIntegration(catalog: IntegrationCatalogEntry[], provider: string): IntegrationCatalogEntry {
  const integration = catalog.find(entry => entry.id === provider.toLowerCase());
  if (!integration) {
    const query = provider.toLowerCase();
    const near = catalog.filter(entry => entry.id.includes(query) || query.includes(entry.id)).map(entry => entry.id);
    const hint = near.length > 0 ? ` Did you mean: ${near.join(', ')}?` : '';
    throw new Error(`Unknown provider: ${provider}.${hint} List providers with: mastra connect list`);
  }
  if (integration.comingSoon) {
    throw new Error(`${integration.displayName} is not yet available for connection.`);
  }
  return integration;
}

async function promptAuthFields(
  integration: IntegrationCatalogEntry,
  fields: IntegrationAuthField[],
): Promise<Record<string, string>> {
  console.info(`\n${pc.bold(integration.displayName)} needs a few details:`);
  const values: Record<string, string> = {};

  for (const field of fields) {
    // Visibility can depend on values entered earlier in the loop.
    if (!isAuthFieldVisible(fields, field, values)) continue;
    if (field.documentationUrl) {
      console.info(pc.dim(`  ${field.label}: ${field.documentationUrl}`));
    }

    let answer: string | symbol;
    if (field.options && field.options.length > 0) {
      answer = await p.select({
        message: field.label,
        options: field.options.map(option => ({ value: option, label: option })),
        initialValue: field.defaultValue ?? undefined,
      });
    } else if (field.secret) {
      answer = await p.password({
        message: field.label,
        validate: value => (field.required && !value ? `${field.label} is required` : undefined),
      });
    } else {
      answer = await p.text({
        message: field.label,
        placeholder: field.placeholder ?? undefined,
        defaultValue: field.defaultValue ?? undefined,
        validate: value => (field.required && !value && !field.defaultValue ? `${field.label} is required` : undefined),
      });
    }
    if (p.isCancel(answer)) {
      throw new Error('Cancelled.');
    }
    if (answer) {
      values[authFieldKey(field)] = answer;
    }
  }

  return values;
}

/**
 * The provider reports success to Nango, and the platform flips the
 * connection row to active from Nango's lifecycle webhook — so poll the
 * project's connection list until the new row shows up active. Same
 * poll cadence as the platform UI.
 */
async function waitForActiveConnection(ctx: ConnectContext, connectionId: string): Promise<void> {
  const spinner = p.spinner();
  spinner.start('Waiting for the connection to become active');
  const deadline = Date.now() + POLL_MAX_MS;
  let fetchFailures = 0;
  try {
    for (;;) {
      let connection: ProjectConnection | undefined;
      try {
        const connections = await fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId);
        fetchFailures = 0;
        connection = connections.find(row => row.id === connectionId);
      } catch (error) {
        // Tolerate a transient network blip; give up after repeated failures.
        fetchFailures += 1;
        if (fetchFailures >= 3) throw error;
      }
      if (connection?.status === 'active') {
        spinner.stop('Connection is active');
        return;
      }
      if (connection?.status === 'error') {
        // The provider denied or failed the authorization; no point waiting
        // out the rest of the deadline.
        throw new Error('The provider did not authorize this connection. Try again.');
      }
      if (Date.now() >= deadline) {
        throw new Error('Authorization did not finish in time. Try again.');
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  } catch (error) {
    spinner.stop('Authorization did not complete');
    throw error;
  }
}

// ---- mastra connect remove <provider> ----

export async function removeConnectionAction(
  provider: string,
  options?: { project?: string; yes?: boolean; all?: boolean; connection?: string },
): Promise<void> {
  const ctx = await resolveConnectContext(options?.project);
  const spinner = p.spinner();
  spinner.start(`Loading ${provider.toLowerCase()} connections in ${ctx.projectName}`);
  let connections: ProjectConnection[];
  try {
    const all = await fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId);
    connections = all.filter(connection => connection.integrationId === provider.toLowerCase());
    spinner.stop(`Found ${connections.length} ${connections.length === 1 ? 'connection' : 'connections'}`);
  } catch (error) {
    spinner.stop(`Could not load ${provider.toLowerCase()} connections`);
    throw error;
  }

  if (connections.length === 0) {
    throw new Error(`${provider} is not connected to ${ctx.projectName}.`);
  }

  let targets = connections;
  if (options?.connection) {
    targets = connections.filter(connection => connection.id === options.connection);
    if (targets.length === 0) {
      throw new Error(
        `No ${provider.toLowerCase()} connection with id ${options.connection} is attached to ${ctx.projectName}.`,
      );
    }
  } else if (connections.length > 1) {
    if (options?.all) {
      // Explicit opt-in to removing every connection; skip the picker.
    } else if (options?.yes || !isInteractive()) {
      // Without a picker, make removing several connections at once an
      // explicit choice instead of the default.
      const rows = connections
        .map(connection => `  ${connection.id}  ${connectionLabel(connection) || 'Account name unavailable'}`)
        .join('\n');
      throw new Error(
        `${provider.toLowerCase()} has ${connections.length} connections:\n${rows}\nPass --connection <id> to remove one, or --all to remove all of them.`,
      );
    } else {
      const memberByUserId = await fetchMemberMap(ctx);
      const choice = await p.select({
        message: `${provider} has ${connections.length} connections. Which one should be removed?`,
        options: [...connectionChoices(connections, memberByUserId), { value: 'all', label: 'All connections' }],
      });
      if (p.isCancel(choice)) return;
      if (choice !== 'all') {
        targets = connections.filter(connection => connection.id === choice);
      }
    }
  }

  if (!options?.yes) {
    if (!isInteractive()) {
      throw new Error('Refusing to remove connections without confirmation. Pass --yes to proceed.');
    }
    const labels = targets.map(target => describeConnection(provider, target)).join(', ');
    const confirmed = await p.confirm({
      message: `Unlink ${labels} from ${ctx.projectName}? The org-level connection is kept.`,
    });
    if (p.isCancel(confirmed) || !confirmed) return;
  }

  const removeSpinner = p.spinner();
  const removeLabel =
    targets.length === 1
      ? `Removing ${describeConnection(provider, targets[0]!)}`
      : `Removing ${targets.length} ${provider.toLowerCase()} connections`;
  removeSpinner.start(removeLabel);
  try {
    for (const connection of targets) {
      await removeProjectConnection(ctx.token, ctx.orgId, ctx.projectId, connection.id);
    }
  } catch (error) {
    removeSpinner.stop('Removal failed');
    throw error;
  }
  const removed =
    targets.length === 1
      ? describeConnection(provider, targets[0]!)
      : `${targets.length} ${provider.toLowerCase()} connections`;
  removeSpinner.stop(`${pc.green('✓')} Removed ${removed} from ${ctx.projectName}.`);
}

function describeConnection(provider: string, connection: ProjectConnection): string {
  const label = connectionLabel(connection);
  return label ? `${provider.toLowerCase()} (${label})` : `${provider.toLowerCase()}`;
}
