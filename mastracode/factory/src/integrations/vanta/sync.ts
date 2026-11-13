import type { IssueReconcileSummary } from '../issue-reconciler.js';
import { vantaLabels } from './rules.js';
import type { VantaRulesIngress, VantaVulnerabilityIngress } from './rules.js';

export const VANTA_VULNERABILITIES_SOURCE_ID = 'vanta:vulnerabilities';
export const DEFAULT_VANTA_SYNC_INTERVAL_MS = 15 * 60_000;

/** The subset of Vanta's `GET /v1/vulnerabilities` item Factory reads. */
export interface VantaVulnerability {
  id: string;
  name: string;
  description?: string | null;
  packageIdentifier?: string | null;
  severity?: string | null;
  isFixable?: boolean | null;
  remediateByDate?: string | null;
  firstDetectedDate?: string | null;
  externalURL?: string | null;
}

/** Lists every active Vanta vulnerability. Throws when Vanta can't be read. */
export type VantaVulnerabilityLister = () => Promise<VantaVulnerability[]>;

export function toVantaIngress(vulnerability: VantaVulnerability): VantaVulnerabilityIngress {
  const severity = vulnerability.severity?.toLowerCase() ?? null;
  const packageIdentifier = vulnerability.packageIdentifier ?? null;
  return {
    id: vulnerability.id,
    name: vulnerability.name,
    title: packageIdentifier ? `${packageIdentifier}: ${vulnerability.name}` : vulnerability.name,
    description:
      vulnerability.description && vulnerability.description !== vulnerability.name ? vulnerability.description : null,
    url: vulnerability.externalURL ?? null,
    state: 'open',
    severity,
    packageIdentifier,
    fixable: vulnerability.isFixable ?? null,
    remediateBy: vulnerability.remediateByDate ?? null,
    labels: vantaLabels(severity),
    createdAt: vulnerability.firstDetectedDate ?? new Date(0).toISOString(),
  };
}

/**
 * Reads Vanta's active vulnerabilities once and hands them to every Factory project that takes
 * Vanta intake. A project takes it when its org has Vanta intake enabled and either binds the
 * vulnerabilities source to it or binds it to no project at all.
 */
export function createVantaSync(options: {
  /**
   * Whether any Vanta connection is active. Without one the vulnerability list
   * is empty, which would read as every filed vulnerability being resolved.
   */
  connected: () => Promise<boolean>;
  listVulnerabilities: VantaVulnerabilityLister;
  listProjects: () => Promise<ReadonlyArray<{ orgId: string; id: string }>>;
  intakeEnabled: (orgId: string) => Promise<boolean>;
  boundProjectIds: (orgId: string) => Promise<string[]>;
  ingest: (input: VantaRulesIngress) => Promise<unknown>;
  userId: string;
}): () => Promise<IssueReconcileSummary> {
  return async () => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };
    if (!(await options.connected())) return summary;
    const projects = await options.listProjects();
    if (projects.length === 0) return summary;
    const vulnerabilities = (await options.listVulnerabilities()).map(toVantaIngress);
    const orgTargets = new Map<string, { enabled: boolean; bound: string[] }>();
    for (const project of projects) {
      try {
        let target = orgTargets.get(project.orgId);
        if (!target) {
          target = {
            enabled: await options.intakeEnabled(project.orgId),
            bound: await options.boundProjectIds(project.orgId),
          };
          orgTargets.set(project.orgId, target);
        }
        if (!target.enabled || (target.bound.length > 0 && !target.bound.includes(project.id))) continue;
        await options.ingest({
          orgId: project.orgId,
          userId: options.userId,
          factoryProjectId: project.id,
          vulnerabilities,
        });
        summary.projects += 1;
        summary.checked += vulnerabilities.length;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ projectId: project.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return summary;
  };
}
