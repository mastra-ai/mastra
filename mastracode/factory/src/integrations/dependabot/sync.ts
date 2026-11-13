import type { ReconcileRepository } from '../github/rules.js';
import { dependabotLabels } from './rules.js';
import type { DependabotAlertIngress, DependabotRulesIngress } from './rules.js';

export const DEFAULT_DEPENDABOT_SYNC_INTERVAL_MS = 15 * 60_000;

/** The subset of GitHub's Dependabot alert payload Factory reads. */
export interface GithubDependabotAlert {
  number: number;
  state: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  dependency?: { package?: { name?: string; ecosystem?: string } | null; manifest_path?: string | null } | null;
  security_advisory?: {
    ghsa_id?: string;
    cve_id?: string | null;
    summary?: string;
    description?: string | null;
    severity?: string;
  } | null;
  security_vulnerability?: {
    severity?: string;
    vulnerable_version_range?: string | null;
    first_patched_version?: { identifier?: string } | null;
  } | null;
}

/**
 * Lists a repository's Dependabot alerts in the given states. Throws when the alerts
 * can't be read (Dependabot alerts disabled, missing permission, proxy error).
 */
export type DependabotAlertLister = (input: {
  installationId: number;
  repository: string;
  state: 'open' | 'closed';
}) => Promise<GithubDependabotAlert[]>;

export interface DependabotSyncSummary {
  repositories: number;
  alerts: number;
  failed: number;
  errors: Array<{ repository: string; error: string }>;
}

export type DependabotSync = (targets: ReconcileRepository[]) => Promise<DependabotSyncSummary>;

function dependabotDescription(alert: GithubDependabotAlert): string | null {
  const advisory = alert.security_advisory;
  const vulnerability = alert.security_vulnerability;
  const facts = [
    alert.dependency?.package?.name &&
      `**Package:** \`${alert.dependency.package.name}\`${alert.dependency.package.ecosystem ? ` (${alert.dependency.package.ecosystem})` : ''}`,
    alert.dependency?.manifest_path && `**Manifest:** \`${alert.dependency.manifest_path}\``,
    (advisory?.severity ?? vulnerability?.severity) && `**Severity:** ${advisory?.severity ?? vulnerability?.severity}`,
    vulnerability?.vulnerable_version_range && `**Vulnerable versions:** \`${vulnerability.vulnerable_version_range}\``,
    vulnerability?.first_patched_version?.identifier &&
      `**Patched in:** \`${vulnerability.first_patched_version.identifier}\``,
    [advisory?.ghsa_id, advisory?.cve_id].filter(Boolean).length > 0 &&
      `**Advisory:** ${[advisory?.ghsa_id, advisory?.cve_id].filter(Boolean).join(', ')}`,
  ].filter((fact): fact is string => typeof fact === 'string');
  const parts = [
    advisory?.summary?.trim(),
    facts.map(fact => `- ${fact}`).join('\n'),
    advisory?.description?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? truncateDescription(parts.join('\n\n')) : null;
}

const MAX_DESCRIPTION_LENGTH = 8000;

export function truncateDescription(text: string): string {
  return text.length <= MAX_DESCRIPTION_LENGTH ? text : `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

export function toDependabotIngress(repository: string, alert: GithubDependabotAlert): DependabotAlertIngress {
  const severity = alert.security_advisory?.severity ?? alert.security_vulnerability?.severity ?? null;
  const packageName = alert.dependency?.package?.name ?? null;
  const summary = alert.security_advisory?.summary ?? `Dependabot alert #${alert.number}`;
  const createdAt = alert.created_at ?? new Date(0).toISOString();
  return {
    id: `${repository}#dependabot-${alert.number}`,
    number: alert.number,
    repository,
    title: packageName ? `${packageName}: ${summary}` : summary,
    url: alert.html_url ?? `https://github.com/${repository}/security/dependabot/${alert.number}`,
    state: alert.state,
    severity,
    packageName,
    ecosystem: alert.dependency?.package?.ecosystem ?? null,
    manifestPath: alert.dependency?.manifest_path ?? null,
    description: dependabotDescription(alert),
    ghsaId: alert.security_advisory?.ghsa_id ?? null,
    cveId: alert.security_advisory?.cve_id ?? null,
    labels: dependabotLabels(severity),
    createdAt,
    updatedAt: alert.updated_at ?? createdAt,
  };
}

/**
 * Reads each linked repository's open and recently closed Dependabot alerts and hands them to
 * every Factory project the repository is linked to. A repository whose alerts can't be read is
 * counted as failed and skipped; the rest of the sweep carries on.
 */
export function createDependabotSync(options: {
  listAlerts: DependabotAlertLister;
  listProjects: (input: {
    installationExternalId: string;
    repositoryExternalId: string;
  }) => Promise<ReadonlyArray<{ orgId: string; factoryProjectId: string }>>;
  /** Opt-in gate: whether the org chose to sync Dependabot alerts for this repository. */
  repositoryEnabled: (input: { orgId: string; repository: string }) => Promise<boolean>;
  ingest: (input: DependabotRulesIngress) => Promise<unknown>;
  userId: string;
}): DependabotSync {
  return async targets => {
    const summary: DependabotSyncSummary = { repositories: 0, alerts: 0, failed: 0, errors: [] };
    for (const target of targets) {
      try {
        const linked = await options.listProjects({
          installationExternalId: String(target.installationId),
          repositoryExternalId: String(target.id),
        });
        const projects = [];
        for (const project of linked) {
          if (await options.repositoryEnabled({ orgId: project.orgId, repository: target.fullName })) {
            projects.push(project);
          }
        }
        if (projects.length === 0) continue;
        const [open, closed] = await Promise.all([
          options.listAlerts({ installationId: target.installationId, repository: target.fullName, state: 'open' }),
          options.listAlerts({ installationId: target.installationId, repository: target.fullName, state: 'closed' }),
        ]);
        const alerts = [...open, ...closed].map(alert => toDependabotIngress(target.fullName, alert));
        // One project's failed ingest is reported without starving the others linked to the repo.
        for (const project of projects) {
          try {
            await options.ingest({
              orgId: project.orgId,
              userId: options.userId,
              factoryProjectId: project.factoryProjectId,
              alerts,
            });
          } catch (error) {
            summary.errors.push({
              repository: target.fullName,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        summary.repositories += 1;
        summary.alerts += alerts.length;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          repository: target.fullName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return summary;
  };
}
