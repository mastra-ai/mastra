import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { E2BSandbox, createRepoTemplate as createE2BRepoTemplate } from '@mastra/e2b';
import type { FactorySandboxContext } from '@mastra/factory';
import {
  createRepoTemplate as createPlatformRepoTemplate,
  PlatformSandbox,
  type SandboxAddressRegistry,
} from '@mastra/platform-workspace';

interface RemoteFactorySandboxOptions {
  platformAccessToken?: string;
  addressRegistry?: SandboxAddressRegistry;
  resolveRepoHead?: (repoFullName: string) => Promise<string | undefined>;
}

export function createRemoteFactorySandbox(
  ctx: FactorySandboxContext,
  options: RemoteFactorySandboxOptions,
): WorkspaceSandbox | undefined {
  if (options.platformAccessToken) {
    return new PlatformSandbox({
      id: ctx.sessionId,
      accessToken: options.platformAccessToken,
      ...(ctx.actingUserId ? { actingUserId: ctx.actingUserId } : {}),
      ...(options.addressRegistry ? { addressRegistry: options.addressRegistry } : {}),
      ...(ctx.repoFullName
        ? {
            template: createPlatformRepoTemplate({
              repoFullName: ctx.repoFullName,
              ...(ctx.setupCommand ? { setupCommand: ctx.setupCommand } : {}),
              ...(options.resolveRepoHead ? { resolveHead: options.resolveRepoHead } : {}),
            }),
          }
        : {}),
      ...(ctx.onStart ? { onStart: ctx.onStart } : {}),
    });
  }

  if (process.env.E2B_API_KEY?.trim()) {
    return new E2BSandbox({
      id: ctx.sessionId,
      ...(ctx.repoFullName
        ? {
            template: createE2BRepoTemplate({
              repoFullName: ctx.repoFullName,
              ...(ctx.setupCommand ? { setupCommand: ctx.setupCommand } : {}),
              ...(ctx.getGithubToken ? { getAuthToken: ctx.getGithubToken } : {}),
            }),
          }
        : {}),
      ...(ctx.onStart ? { onStart: ctx.onStart } : {}),
    });
  }

  return undefined;
}
