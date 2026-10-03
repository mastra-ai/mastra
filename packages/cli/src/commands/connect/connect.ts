import * as p from '@clack/prompts';
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

async function resolveConnectContext(projectArg?: string): Promise<ConnectContext> {
  const token = await getToken();
  const { orgId } = await resolveCurrentOrg(token);
  const project = await resolveProject(token, orgId, projectArg);
  return { token, orgId, projectId: project.id, projectName: project.name };
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI;
}

function connectionLabel(connection: ProjectConnection): string {
  return connection.displayName || connection.accountLabel || connection.id;
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
 * Aligned select rows for picking one connection among several: account
 * label, who connected it, and when. Padding keeps the columns lined up in
 * clack's select renderer.
 */
function connectionChoices(
  connections: ProjectConnection[],
  memberByUserId: Map<string, OrgMember>,
): { value: string; label: string }[] {
  const rows = connections.map(connection => ({
    value: connection.id,
    account: connection.displayName || connection.accountLabel || '(no label)',
    by: `connected by ${memberName(memberByUserId.get(connection.connectedByUserId)) ?? 'a teammate'}`,
    date: formatConnectionDate(connection),
  }));
  const accountWidth = Math.max(...rows.map(row => row.account.length));
  const byWidth = Math.max(...rows.map(row => row.by.length));
  return rows.map(row => ({
    value: row.value,
    label: `${row.account.padEnd(accountWidth)}  ${pc.dim(`${row.by.padEnd(byWidth)}  ${row.date}`.trimEnd())}`,
  }));
}

/** Org member lookup for attributing connections to whoever connected them. */
async function fetchMemberMap(ctx: ConnectContext): Promise<Map<string, OrgMember>> {
  const members = await fetchOrgMembers(ctx.token, ctx.orgId).catch(() => [] as OrgMember[]);
  return new Map(members.map(member => [member.userId, member]));
}

// ---- mastra connect list ----

export async function listProvidersAction(options?: { project?: string }): Promise<void> {
  const ctx = await resolveConnectContext(options?.project);
  const [catalog, connections] = await Promise.all([
    fetchIntegrationCatalog(ctx.token, ctx.orgId),
    fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId),
  ]);

  // Connections without an account label are attributed to whoever connected
  // them ("connected by Jane Doe"), which needs the org member list.
  let memberByUserId = new Map<string, OrgMember>();
  if (connections.some(connection => !connection.displayName && !connection.accountLabel)) {
    memberByUserId = await fetchMemberMap(ctx);
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
      const labels = active
        .map(row => row.displayName || row.accountLabel)
        .filter((label): label is string => Boolean(label));
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
  const catalog = await fetchIntegrationCatalog(ctx.token, ctx.orgId);
  const integration = findIntegration(catalog, provider);

  const projectConnections = await fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId);
  const existing = projectConnections.filter(
    connection => connection.integrationId === integration.id && connection.status === 'active',
  );
  if (existing.length > 0 && !options?.yes) {
    const accounts = existing.map(connectionLabel).join(', ');
    console.info(`${integration.displayName} is already connected to ${ctx.projectName} (${accounts}).`);
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
    try {
      orgConnections = await fetchOrgConnections(ctx.token, ctx.orgId, integration.id);
    } catch {
      console.warn(pc.yellow('Could not check for existing connections in your organization. Creating a new one.'));
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
        printConnected(ctx, integration, chosen ? ` (${connectionLabel(chosen)})` : '');
        return;
      }
    }
  }

  const fields = authFieldsFor(integration.authType, integration.authFields);
  const needsForm = fields.length > 0;
  if (needsForm && !isInteractive()) {
    throw new Error(
      `${integration.displayName} needs credentials that must be entered interactively. Re-run in a terminal, or connect it from the platform UI.`,
    );
  }

  const session = await createProjectConnectSession(ctx.token, ctx.orgId, ctx.projectId, integration.id);
  const values = needsForm ? await promptAuthFields(integration, fields) : {};
  const { credentials, params } = splitAuthValues(fields, values);

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
  printConnected(ctx, integration, connection ? ` (${connectionLabel(connection)})` : '');
}

function printConnected(ctx: ConnectContext, integration: IntegrationCatalogEntry, account: string): void {
  console.info(`\n${pc.green('✓')} Connected ${pc.bold(integration.displayName)}${account} to ${ctx.projectName}.`);
  console.info(
    pc.dim(
      `\nYour agents pick it up through @mastra/connect:\n\n  import { connect } from '@mastra/connect';\n\n  const tools = connect({\n    projectId: process.env.MASTRA_PROJECT_ID,\n    integrations: ['${integration.id}'],\n  });\n`,
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
  try {
    for (;;) {
      const connections = await fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId);
      const connection = connections.find(row => row.id === connectionId);
      if (connection?.status === 'active') {
        spinner.stop('Connection is active');
        return;
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
  options?: { project?: string; yes?: boolean },
): Promise<void> {
  const ctx = await resolveConnectContext(options?.project);
  const connections = (await fetchProjectConnections(ctx.token, ctx.orgId, ctx.projectId)).filter(
    connection => connection.integrationId === provider.toLowerCase(),
  );

  if (connections.length === 0) {
    throw new Error(`${provider} is not connected to ${ctx.projectName}.`);
  }

  let targets = connections;
  if (connections.length > 1 && isInteractive() && !options?.yes) {
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

  for (const connection of targets) {
    await removeProjectConnection(ctx.token, ctx.orgId, ctx.projectId, connection.id);
  }
  const removed =
    targets.length === 1
      ? describeConnection(provider, targets[0]!)
      : `${targets.length} ${provider.toLowerCase()} connections`;
  console.info(`${pc.green('✓')} Removed ${removed} from ${ctx.projectName}.`);
}

function describeConnection(provider: string, connection: ProjectConnection): string {
  return `${provider.toLowerCase()} (${connectionLabel(connection)})`;
}
