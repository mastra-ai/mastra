import { useAgentSidebarView } from '../context/agent-sidebar-view-context';
import { useAgentVersions } from './use-agent-versions';

/**
 * Resolves which agent version the editor's test chat should run against.
 *
 * When the version editor panel is open, the chat should resolve the latest
 * saved version — the draft you are editing — so a "Save" is immediately
 * testable in the chat WITHOUT publishing it. This mirrors the save/publish
 * split: saving creates a draft (no auto-publish), and the editor previews that
 * draft locally while production keeps using the published version (or code).
 *
 * Resolution order:
 * - An explicit URL version (`/agents/:id/versions/:versionId/...`) always wins.
 * - Otherwise, while the editor is open, use the latest version.
 * - Otherwise (editor closed), return undefined so the chat falls back to its
 *   normal published/code resolution.
 */
export function useEditorPreviewVersionId({
  agentId,
  urlVersionId,
}: {
  agentId: string;
  urlVersionId?: string;
}): string | undefined {
  const { selectedView } = useAgentSidebarView();
  const previewEnabled = selectedView === 'versions' && !urlVersionId;

  const { data } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
    enabled: previewEnabled,
  });

  if (urlVersionId) return urlVersionId;
  if (!previewEnabled) return undefined;
  return data?.versions?.[0]?.id;
}
