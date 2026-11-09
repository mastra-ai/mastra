import { createFactoryUserSession, listFactoryProjects } from '@mastra/code-sdk/factory/client';
import { loadSettings, saveSettings } from '@mastra/code-sdk/onboarding/settings';
import {
  fetchPlatformEnvironments,
  fetchPlatformOrgs,
  fetchPlatformProjects,
  getPlatformSession,
  loginToPlatform,
  resolveFactoryUrl,
} from '@mastra/code-sdk/platform/index';
import type { PlatformSession } from '@mastra/code-sdk/platform/index';
import { promptSelect } from '../components/simple-select.js';
import type { SlashCommandContext } from './types.js';

const USAGE = 'Usage: /factory [connect|status|local|disconnect]';

/**
 * `/factory` switches into the saved Factory (connecting first if there is none);
 * `/factory local` (or `/local`) switches back without forgetting the connection.
 */
export async function handleFactoryCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const sub = args[0];
  if (sub === 'status') return showStatus(ctx);
  if (sub === 'disconnect') return disconnect(ctx);
  if (sub === 'local') return switchToLocal(ctx);
  if (sub === 'connect') return connect(ctx);
  if (sub !== undefined) return ctx.showError(USAGE);
  if (!loadSettings().factory) return connect(ctx);
  if (inFactoryMode(ctx)) return showStatus(ctx);
  return switchToFactory(ctx);
}

export async function handleLocalCommand(ctx: SlashCommandContext): Promise<void> {
  return switchToLocal(ctx);
}

function inFactoryMode(ctx: SlashCommandContext): boolean {
  return !ctx.state.local;
}

function showStatus(ctx: SlashCommandContext): void {
  const factory = loadSettings().factory;
  if (!factory) return ctx.showInfo('Not connected to a Factory. Run /factory to connect.');
  const where = `${factory.factoryProjectName} / ${factory.repositorySlug} on ${factory.branch} (${factory.projectName} · ${factory.environmentName}, ${factory.url})`;
  ctx.showInfo(
    inFactoryMode(ctx)
      ? `Factory mode: ${where}. Run /local to work locally.`
      : `Local mode. Saved Factory: ${where}. Run /factory to switch to it.`,
  );
}

function setActive(active: boolean): void {
  const settings = loadSettings();
  if (!settings.factory) return;
  settings.factory = { ...settings.factory, active };
  saveSettings(settings);
}

/** Restart into the mode settings now select, or tell the user to restart when that isn't possible. */
async function restartInto(ctx: SlashCommandContext, mode: string): Promise<void> {
  const relaunch = ctx.state.options.relaunch;
  if (!relaunch) return ctx.showInfo(`Restart Mastra Code to switch to ${mode}.`);
  ctx.showInfo(`Switching to ${mode}…`);
  await relaunch();
}

async function switchToFactory(ctx: SlashCommandContext): Promise<void> {
  setActive(true);
  await restartInto(ctx, 'Factory mode');
}

async function switchToLocal(ctx: SlashCommandContext): Promise<void> {
  if (!inFactoryMode(ctx)) {
    setActive(false);
    return ctx.showInfo('Already in local mode.');
  }
  setActive(false);
  await restartInto(ctx, 'local mode');
}

async function disconnect(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  if (!settings.factory) return ctx.showInfo('Not connected to a Factory.');
  settings.factory = null;
  saveSettings(settings);
  if (inFactoryMode(ctx)) return restartInto(ctx, 'local mode');
  ctx.showInfo('Disconnected from Factory.');
}

async function ensureSession(ctx: SlashCommandContext): Promise<PlatformSession | null> {
  const existing = await getPlatformSession();
  if (existing) return existing;

  ctx.showInfo('Opening your browser to sign in to Mastra Platform…');
  try {
    const creds = await loginToPlatform({ onUrl: url => ctx.showInfo(`If the browser did not open, visit: ${url}`) });
    ctx.showInfo(`Signed in as ${creds.user.email}`);
    return { token: creds.token, orgId: creds.currentOrgId ?? creds.organizationId };
  } catch (error) {
    ctx.showError(`Mastra Platform login failed: ${(error as Error).message}`);
    return null;
  }
}

async function connect(ctx: SlashCommandContext): Promise<void> {
  const ui = ctx.state.ui;
  let session = await ensureSession(ctx);
  if (!session) return;

  try {
    const orgs = await fetchPlatformOrgs(session);
    if (orgs.length > 1) {
      const orgId = await promptSelect(
        ui,
        'Select organization:',
        orgs.map(org => ({
          value: org.id,
          label: `  ${org.name}`,
          description: org.id === session!.orgId ? 'current' : undefined,
        })),
      );
      if (!orgId) return;
      session = { ...session, orgId };
    } else if (orgs.length === 1 && orgs[0]!.id !== session.orgId) {
      session = { ...session, orgId: orgs[0]!.id };
    }

    const projects = await fetchPlatformProjects(session);
    if (projects.length === 0) return ctx.showError('No projects found in this organization.');
    const projectId = await promptSelect(
      ui,
      'Select project:',
      projects.map(project => ({ value: project.id, label: `  ${project.name}` })),
    );
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const environments = (await fetchPlatformEnvironments(session, project.id)).filter(resolveFactoryUrl);
    if (environments.length === 0) {
      return ctx.showError(`${project.name} has no deployed environments. Deploy it with \`mastra deploy\` first.`);
    }
    const environmentId =
      environments.length === 1
        ? environments[0]!.id
        : await promptSelect(
            ui,
            'Select environment:',
            environments.map(env => ({ value: env.id, label: `  ${env.name}`, description: resolveFactoryUrl(env)! })),
          );
    const environment = environments.find(env => env.id === environmentId);
    if (!environment) return;

    const address = { url: resolveFactoryUrl(environment)!, session };
    const factoryProjects = (await listFactoryProjects(address)).filter(p => p.repositories.length > 0);
    if (factoryProjects.length === 0) {
      return ctx.showError('This Factory has no projects with linked repositories. Link one in the Factory UI first.');
    }
    const factoryProjectId =
      factoryProjects.length === 1
        ? factoryProjects[0]!.id
        : await promptSelect(
            ui,
            'Select Factory project:',
            factoryProjects.map(p => ({ value: p.id, label: `  ${p.name}` })),
          );
    const factoryProject = factoryProjects.find(p => p.id === factoryProjectId);
    if (!factoryProject) return;

    const repositories = factoryProject.repositories;
    const projectRepositoryId =
      repositories.length === 1
        ? repositories[0]!.projectRepositoryId
        : await promptSelect(
            ui,
            'Select repository:',
            repositories.map(r => ({ value: r.projectRepositoryId, label: `  ${r.slug}`, description: r.branch })),
          );
    const repository = repositories.find(r => r.projectRepositoryId === projectRepositoryId);
    if (!repository) return;

    const userSession = await createFactoryUserSession(address, repository.projectRepositoryId);

    const settings = loadSettings();
    settings.factory = {
      url: address.url,
      orgId: session.orgId,
      projectId: project.id,
      projectName: project.name,
      environmentId: environment.id,
      environmentName: environment.name,
      factoryProjectId: factoryProject.id,
      factoryProjectName: factoryProject.name,
      projectRepositoryId: repository.projectRepositoryId,
      repositorySlug: repository.slug,
      sessionId: userSession.sessionId,
      branch: userSession.branch,
      active: true,
    };
    saveSettings(settings);
    ctx.showInfo(
      `Connected to Factory ${factoryProject.name} / ${repository.slug} — new session on ${userSession.branch} (${address.url}).`,
    );
    await restartInto(ctx, 'Factory mode');
  } catch (error) {
    ctx.showError(`Failed to connect to Factory: ${(error as Error).message}`);
  }
}
