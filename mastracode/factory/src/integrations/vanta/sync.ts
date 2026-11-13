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

/** Lists a complete snapshot for one org, or null when its connections cannot be reconciled safely. */
export type VantaVulnerabilityLister = (orgId: string) => Promise<VantaVulnerability[] | null>;

export function toVantaIngress(vulnerability: VantaVulnerability): VantaVulnerabilityIngress {
  const severity = vulnerability.severity?.toLowerCase() ?? null;
  const packageIdentifier = vulnerability.packageIdentifier ?? null;
  return {
    id: vulnerability.id,
    name: vulnerability.name,
    title: packageIdentifier ? `${packageIdentifier}: ${vulnerability.name}` : vulnerability.name,
    description: vulnerability.description && vulnerability.description !== vulnerability.name ? vulnerability.description : null,
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
 * Reads a complete snapshot for each organization and hands it to that organization's
 * Factory projects taking Vanta intake. Unavailable snapshots are never reconciled.
 */
export function createVantaSync(options: {
  listVulnerabilities: VantaVulnerabilityLister;
  listProjects: () => Promise<ReadonlyArray<{ orgId: string; id: string }>>;
  intakeEnabled: (orgId: string) => Promise<boolean>;
  boundProjectIds: (orgId: string) => Promise<string[]>;
  ingest: (input: VantaRulesIngress) => Promise<unknown>;
  userId: string;
}): () => Promise<IssueReconcileSummary> {
  return async () => {
    const summary: IssueReconcileSummary = { projects: 0, checked: 0, updated: 0, closed: 0, missing: 0, failed: 0, errors: [] };
    const projects = await options.listProjects();
    if (projects.length === 0) return summary;
    const orgTargets = new Map<string, { enabled: boolean; bound: string[]; loaded: boolean; vulnerabilities: VantaVulnerabilityIngress[] | null }>();
    for (const project of projects) {
      try {
        let target = orgTargets.get(project.orgId);
        if (!target) {
          const enabled = await options.intakeEnabled(project.orgId);
          target = {
            enabled,
            bound: enabled ? await options.boundProjectIds(project.orgId) : [],
            loaded: false,
            vulnerabilities: null,
          };
          orgTargets.set(project.orgId, target);
        }
        if (!target.enabled || (target.bound.length > 0 && !target.bound.includes(project.id))) continue;
        if (!target.loaded) {
          const snapshot = await options.listVulnerabilities(project.orgId);
          target.vulnerabilities = snapshot?.map(toVantaIngress) ?? null;
          target.loaded = true;
        }
        if (target.vulnerabilities === null) continue;
        await options.ingest({
          orgId: project.orgId,
          userId: options.userId,
          factoryProjectId: project.id,
          vulnerabilities: target.vulnerabilities,
        });
        summary.projects += 1;
        summary.checked += target.vulnerabilities.length;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ projectId: project.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return summary;
  };
}
