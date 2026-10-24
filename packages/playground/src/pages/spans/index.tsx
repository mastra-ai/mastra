import { useSpanQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import {
  ObservabilityCapabilityGate,
  readSpanSelection,
  spanTraceSearch,
  withSpanSelection,
} from '@mastra/playground-ui/domains/observability';
import { SpansExplorerBody } from '@mastra/playground-ui/domains/spans/components/spans-explorer-body';
import { useNavigate, useSearchParams } from 'react-router';
import { SpanDetailSidePanel } from './span-detail-side-panel';

export default function SpansPage() {
  const { enabled, isLoading } = useSpanQueryAvailable();
  const navigate = useNavigate();
  // The open span lives in the URL, so it survives a reload and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <ObservabilityCapabilityGate
      enabled={enabled}
      isLoading={isLoading}
      heading="Spans"
      title="Query spans capability not activated"
      description="Your observability storage does not support span queries. Switch to a store that declares the span-query capability to list spans."
    >
      <SpansExplorerBody
        selection={readSpanSelection(searchParams)}
        onSelectionChange={selection =>
          setSearchParams(current => withSpanSelection(current, selection), { replace: true })
        }
        renderPanel={panel => (
          <SpanDetailSidePanel
            {...panel}
            onShowTrace={selection => navigate(`/traces?${spanTraceSearch(selection)}`)}
          />
        )}
      />
    </ObservabilityCapabilityGate>
  );
}
