import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useAvailableModelsQuery } from '../../../../../../shared/hooks/useAvailableModels';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatModels } from '../../context/useChatModels';
import { useIsRouteThreadSwitching } from '../../hooks/useIsRouteThreadSwitching';

function titleCase(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function lastSegment(id: string): string {
  const parts = id.trim().split('/');
  return parts[parts.length - 1] || id;
}

function formatModelName(id: string): string {
  const slug = lastSegment(id);
  const claudeMatch = slug.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/i);
  const claudeFamily = claudeMatch?.[1];
  const claudeMajor = claudeMatch?.[2];
  const claudeMinor = claudeMatch?.[3];
  if (claudeFamily && claudeMajor && claudeMinor) {
    return `Claude ${titleCase(claudeFamily)} ${claudeMajor}.${claudeMinor}`;
  }

  const gptDetails = slug.match(/^gpt-(.+)$/i)?.[1];
  if (gptDetails) {
    const [version, ...qualifiers] = gptDetails.split('-');
    return [`GPT-${version}`, ...qualifiers.map(titleCase)].join(' ');
  }

  return slug.split(/[-_]+/).filter(Boolean).map(titleCase).join(' ');
}

/** Current model id and whether its provider has usable credentials. */
export function ActiveModel() {
  const { activeModelId } = useChatModels();
  const { status } = useChatConnection();
  const isSwitchingThread = useIsRouteThreadSwitching();
  const modelsQuery = useAvailableModelsQuery();

  // Never label a new route with the previously-bound thread's model. While an
  // initial connection is resolving there is no model id yet either.
  if (isSwitchingThread || (!activeModelId && status === 'connecting')) {
    return <Skeleton aria-label="Loading model" className="h-3.5 w-24" />;
  }

  const label = activeModelId ? formatModelName(activeModelId) : 'No model';
  const notConfigured =
    Boolean(activeModelId) && modelsQuery.isSuccess && !modelsQuery.data.some(model => model.id === activeModelId);

  return (
    <span
      className={notConfigured ? 'text-accent2' : 'text-neutral3'}
      aria-label={notConfigured ? `${label} is not configured` : undefined}
      title={activeModelId}
    >
      {label}
      {notConfigured ? ' · not configured' : null}
    </span>
  );
}
