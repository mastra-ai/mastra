import { useHistory } from "@docusaurus/router";
import {
  useVersions,
  useActiveDocContext,
  useDocsVersionCandidates,
  useDocsPreferredVersion,
} from "@docusaurus/plugin-content-docs/client";
import { useHistorySelector } from "@docusaurus/theme-common";
import type {
  GlobalVersion,
  GlobalDoc,
  ActiveDocContext,
} from "@docusaurus/plugin-content-docs/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@site/src/components/ui/select";
import type { ReactNode } from "react";

type VersionItem = {
  version: GlobalVersion;
  label: string;
};

type Props = {
  readonly className?: string;
  readonly size?: "sm" | "default";
  readonly docsPluginId?: string;
};

function getVersionMainDoc(version: GlobalVersion): GlobalDoc {
  const mainDoc = version.docs.find((doc) => doc.id === version.mainDocId);
  if (!mainDoc) {
    throw new Error(
      `Main doc not found for version ${version.name} (mainDocId: ${version.mainDocId})`,
    );
  }
  return mainDoc;
}

function getVersionTargetDoc(
  version: GlobalVersion,
  activeDocContext: ActiveDocContext,
): GlobalDoc {
  // Try to link to the same doc in another version
  // When not possible, fallback to the "main doc" of the version
  return (
    activeDocContext.alternateDocVersions[version.name] ??
    getVersionMainDoc(version)
  );
}

export default function VersionControlSmart({
  className,
  size = "default",
  docsPluginId,
}: Props): ReactNode {
  const history = useHistory();
  const search = useHistorySelector((h) => h.location.search);
  const hash = useHistorySelector((h) => h.location.hash);
  const activeDocContext = useActiveDocContext(docsPluginId);
  const { savePreferredVersionName } = useDocsPreferredVersion(docsPluginId);
  const versions = useVersions(docsPluginId);

  // Convert versions to items with labels
  const versionItems: VersionItem[] = versions.map((version) => ({
    version,
    label: version.label,
  }));

  // Get the displayed version (current active version)
  const candidates: readonly GlobalVersion[] =
    useDocsVersionCandidates(docsPluginId);
  const candidateItems: VersionItem[] = candidates
    .map((candidate) => versionItems.find((vi) => vi.version === candidate))
    .filter((vi): vi is VersionItem => vi !== undefined);
  const displayedVersionItem: VersionItem | undefined =
    candidateItems[0] ?? versionItems[0];

  // Don't render if no versions or only 1 version
  if (!displayedVersionItem || versionItems.length <= 1) {
    return null;
  }

  const handleVersionChange = (versionName: string): void => {
    const selectedVersionItem = versionItems.find(
      (vi) => vi.version.name === versionName,
    );
    if (!selectedVersionItem) return;

    const targetDoc = getVersionTargetDoc(
      selectedVersionItem.version,
      activeDocContext,
    );

    // Save user preference
    savePreferredVersionName(selectedVersionItem.version.name);

    // Navigate to target doc, preserving search and hash
    history.push(`${targetDoc.path}${search}${hash}`);
  };

  return (
    <Select
      value={displayedVersionItem.version.name}
      onValueChange={handleVersionChange}
    >
      <SelectTrigger
        aria-label="Switch documentation version"
        size={size}
        className={className}
      >
        <SelectValue>{displayedVersionItem.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {versionItems.map((item) => (
          <SelectItem key={item.version.name} value={item.version.name}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
