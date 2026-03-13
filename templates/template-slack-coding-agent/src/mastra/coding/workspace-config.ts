import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { E2BFilesystem } from './e2b-filesystem';

export interface CodingWorkspaceConfig {
  repoUrl: string;
  branch?: string;
  githubToken: string;
  gitUserName: string;
  gitUserEmail: string;
  sandboxId: string;
}

/**
 * Create an E2B sandbox with a repo pre-cloned via template.
 *
 * Uses E2B's TemplateBuilder.gitClone() to bake the repo into
 * the sandbox template at build time. Subsequent sandboxes for
 * the same repo start from that snapshot instantly.
 */
// Install gh CLI: download the pre-built binary to avoid apt repo setup issues in E2B template builds
const INSTALL_GH_CLI = [
  'curl -fsSL https://github.com/cli/cli/releases/download/v2.74.1/gh_2.74.1_linux_amd64.tar.gz -o /tmp/gh.tar.gz',
  'tar -xzf /tmp/gh.tar.gz -C /tmp',
  'mv /tmp/gh_2.74.1_linux_amd64/bin/gh /usr/local/bin/gh',
  'chmod +x /usr/local/bin/gh',
  'rm -rf /tmp/gh.tar.gz /tmp/gh_2.74.1_linux_amd64',
].join(' && ');

export function createCodingSandbox(config: CodingWorkspaceConfig): E2BSandbox {
  const authUrl = config.repoUrl.replace(
    'https://',
    `https://x-access-token:${config.githubToken}@`,
  );

  return new E2BSandbox({
    id: config.sandboxId,
    template: base =>
      base
        .aptInstall(['git', 'curl', 'wget', 'jq', 'ripgrep', 'tree', 'gnupg'])
        .runCmd(INSTALL_GH_CLI)
        .runCmd('curl -fsSL https://get.pnpm.io/install.sh | sh -')
        .runCmd('echo "export PNPM_HOME=\"$HOME/.local/share/pnpm\"" >> ~/.bashrc && echo "export PATH=\"$PNPM_HOME:$PATH\"" >> ~/.bashrc')
        .gitClone(authUrl, '/home/user/project', {
          branch: config.branch ?? 'main',
          depth: 1,
        })
        .setWorkdir('/home/user/project'),
    timeout: 1_800_000, // 30 min
    env: {
      GITHUB_TOKEN: config.githubToken,
      GH_TOKEN: config.githubToken,
      GIT_AUTHOR_NAME: config.gitUserName,
      GIT_AUTHOR_EMAIL: config.gitUserEmail,
      FORCE_COLOR: '1',
      CLICOLOR_FORCE: '1',
      TERM: 'xterm-256color',
      CI: 'true',
      NONINTERACTIVE: '1',
      DEBIAN_FRONTEND: 'noninteractive',
    },
    onStart: async ({ sandbox }) => {
      await sandbox.executeCommand?.(
        `git config --global user.name "${config.gitUserName}"`,
      );
      await sandbox.executeCommand?.(
        `git config --global user.email "${config.gitUserEmail}"`,
      );
      // Credential helper that uses GITHUB_TOKEN env var for push/PR
      await sandbox.executeCommand?.(
        'git config --global credential.helper "!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f"',
      );
      // Configure gh CLI to use git protocol https (needed for push via token)
      await sandbox.executeCommand?.('gh auth setup-git');
      // Install dependencies and build the project
      await sandbox.executeCommand?.(
        'export PNPM_HOME="$HOME/.local/share/pnpm" && export PATH="$PNPM_HOME:$PATH" && pnpm install && pnpm build',
      );
      // Create a working branch for this coding session
      await sandbox.executeCommand?.(
        `git checkout -b slack-session-${Date.now()}`,
      );
    },
  });
}

/**
 * Create a bare E2B sandbox without a pre-cloned repo.
 * The agent can clone a repo later via execute_command.
 */
export function createBareSandbox(config: {
  sandboxId: string;
  githubToken: string;
  gitUserName: string;
  gitUserEmail: string;
}): E2BSandbox {
  return new E2BSandbox({
    id: config.sandboxId,
    template: base =>
      base
        .aptInstall(['git', 'curl', 'wget', 'jq', 'ripgrep', 'tree', 'gnupg'])
        .runCmd(INSTALL_GH_CLI)
        .runCmd('curl -fsSL https://get.pnpm.io/install.sh | sh -')
        .runCmd('echo "export PNPM_HOME=\"$HOME/.local/share/pnpm\"" >> ~/.bashrc && echo "export PATH=\"$PNPM_HOME:$PATH\"" >> ~/.bashrc'),
    timeout: 1_800_000,
    env: {
      GITHUB_TOKEN: config.githubToken,
      GH_TOKEN: config.githubToken,
      GIT_AUTHOR_NAME: config.gitUserName,
      GIT_AUTHOR_EMAIL: config.gitUserEmail,
      FORCE_COLOR: '1',
      CLICOLOR_FORCE: '1',
      TERM: 'xterm-256color',
      CI: 'true',
      NONINTERACTIVE: '1',
      DEBIAN_FRONTEND: 'noninteractive',
    },
    onStart: async ({ sandbox }) => {
      await sandbox.executeCommand?.(
        `git config --global user.name "${config.gitUserName}"`,
      );
      await sandbox.executeCommand?.(
        `git config --global user.email "${config.gitUserEmail}"`,
      );
      await sandbox.executeCommand?.(
        'git config --global credential.helper "!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f"',
      );
      // Configure gh CLI to use git protocol https
      await sandbox.executeCommand?.('gh auth setup-git');
    },
  });
}

/**
 * Create a Workspace wrapping an E2B sandbox with filesystem tools.
 *
 * The E2BFilesystem bridges the E2B SDK's file API to MastraFilesystem,
 * enabling the agent to use read_file, write_file, list_files, etc.
 */
export function createCodingWorkspace(sandbox: E2BSandbox): Workspace {
  return new Workspace({
    sandbox,
    filesystem: new E2BFilesystem(sandbox),
  });
}
