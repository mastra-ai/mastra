/**
 * On-demand documents refresh for a factory project.
 *
 * The factory has no persistent checkout, so a refresh needs a live sandbox
 * that already holds the repository: the first memoized session sandbox with
 * a resolved workdir under any repository linked to the project. It fetches
 * the remote default branch (with a short-lived install token that is scrubbed
 * afterwards) and re-runs the same sync the session start path uses. Without
 * a live sandbox the refresh reports `no_active_sandbox`; the index then
 * updates on the next run that materializes the repo.
 */

import { CHECKOUT_COMMAND_TIMEOUT_MS, sh, shellQuote, withInstallToken } from '../../../integrations/github/sandbox.js';
import { requireExec } from '../../../sandbox/materialization.js';
import { peekSessionSandbox } from '../../../sandbox/session-sandbox.js';
import type { SourceControlStorageHandle } from '../source-control/base.js';
import type { FactoryDocumentScope, FactoryDocumentsStorage } from './base.js';
import type { SyncFactoryDocumentsResult } from './sync.js';
import { syncFactoryDocuments } from './sync.js';

export type FactoryDocumentsRefreshResult =
  | { outcome: 'synced' | 'unchanged'; sourceRef: string; sourceSha: string }
  | { outcome: 'no_repository' }
  | { outcome: 'no_active_sandbox' }
  | { outcome: 'ref_unavailable'; reason: string };

export interface FactoryDocumentsRefresherDeps {
  sourceControl: Pick<SourceControlStorageHandle, 'connections' | 'projectRepositories' | 'repositories' | 'sessions'>;
  getRepositoryAccess: (input: {
    orgId: string;
    repositoryId: string;
  }) => Promise<{ authorization?: { token: string } | null }>;
  documents: Pick<FactoryDocumentsStorage, 'replaceSnapshot' | 'syncState'>;
  /** Test seam; defaults to the process-wide session sandbox memo. */
  peekSandbox?: typeof peekSessionSandbox;
}

export type FactoryDocumentsRefresher = (scope: FactoryDocumentScope) => Promise<FactoryDocumentsRefreshResult>;

export function createFactoryDocumentsRefresher(deps: FactoryDocumentsRefresherDeps): FactoryDocumentsRefresher {
  const peek = deps.peekSandbox ?? peekSessionSandbox;
  return async scope => {
    const connections = await deps.sourceControl.connections.list(scope);
    let sawRepository = false;
    for (const connection of connections) {
      const links = await deps.sourceControl.projectRepositories.list({
        orgId: scope.orgId,
        connectionId: connection.id,
      });
      for (const link of links) {
        const repository = await deps.sourceControl.repositories.get({ orgId: scope.orgId, id: link.repositoryId });
        if (!repository) continue;
        sawRepository = true;
        const sessions = await deps.sourceControl.sessions.listByProjectRepository({ projectRepositoryId: link.id });
        for (const session of sessions) {
          const entry = peek(session.id);
          if (!entry?.workdir) continue;
          const sandbox = requireExec(entry.sandbox);
          const workdir = entry.workdir;
          const ref = `origin/${repository.defaultBranch}`;
          const access = await deps.getRepositoryAccess({ orgId: scope.orgId, repositoryId: repository.id });
          const token = access.authorization?.token;
          if (!token) throw new Error('Repository access did not include a bearer token for the documents refresh');
          await withInstallToken(sandbox, workdir, repository.slug, token, async () => {
            const fetch = await sh(
              sandbox,
              `git -C ${shellQuote(workdir)} fetch --depth=1 origin ${shellQuote(repository.defaultBranch)}`,
              { timeoutMs: CHECKOUT_COMMAND_TIMEOUT_MS, phase: 'documents.refresh.fetch' },
            );
            if (fetch.exitCode !== 0) throw new Error(`git fetch failed: ${fetch.stderr.trim()}`);
          });
          const result: SyncFactoryDocumentsResult = await syncFactoryDocuments({
            ...scope,
            sandbox,
            workdir,
            ref,
            storage: deps.documents,
          });
          if (result.outcome === 'ref-unavailable') return { outcome: 'ref_unavailable', reason: result.reason };
          return { outcome: result.outcome, sourceRef: ref, sourceSha: result.sourceSha };
        }
      }
    }
    return sawRepository ? { outcome: 'no_active_sandbox' } : { outcome: 'no_repository' };
  };
}
