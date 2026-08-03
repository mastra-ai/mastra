export class GithubInstallationBrokenError extends Error {
  readonly code = 'github_installation_broken';
  readonly installationId: number;
  readonly accountLogin: string | null;
  readonly orgId: string;

  constructor(args: { installationId: number; accountLogin: string | null; orgId: string }) {
    super(
      args.accountLogin
        ? `GitHub installation for @${args.accountLogin} is unavailable. Reconnect GitHub to continue.`
        : 'GitHub installation is unavailable. Reconnect GitHub to continue.',
    );
    this.name = 'GithubInstallationBrokenError';
    this.installationId = args.installationId;
    this.accountLogin = args.accountLogin;
    this.orgId = args.orgId;
  }
}
