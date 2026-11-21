import { useSpanQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import {
  ObservabilityCapabilityGate,
  readSpanSelection,
  spanTraceSearch,
  withSpanSelection,
} from '@mastra/playground-ui/domains/observability';
import { SpansExplorerBody } from '@mastra/playground-ui/domains/spans/components/spans-explorer-body';
import { useSpansExplorer } from '@mastra/playground-ui/domains/spans/hooks/use-spans-explorer';
import { useNavigate, useSearchParams } from 'react-router';
import { SpanDetailSidePanel } from './span-detail-side-panel';

function SpansExplorer() {
  const navigate = useNavigate();
  // The open span, time range, filters and sort live in the URL, so they survive a reload and can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const explorer = useSpansExplorer({ searchParams, setSearchParams });

  return (
    <SpansExplorerBody
      {...explorer}
      selection={readSpanSelection(searchParams)}
      onSelectionChange={selection =>
        setSearchParams(current => withSpanSelection(current, selection), { replace: true })
      }
      renderPanel={panel => (
        <SpanDetailSidePanel {...panel} onShowTrace={selection => navigate(`/traces?${spanTraceSearch(selection)}`)} />
      )}
    />
  );
}

export default function SpansPage() {
  const { enabled, isLoading } = useSpanQueryAvailable();

  return (
    <ObservabilityCapabilityGate
      enabled={enabled}
      isLoading={isLoading}
      heading="Spans"
      title="Query spans capability not activated"
      description="Your observability storage does not support span queries. Switch to a store that declares the span-query capability to list spans."
    >
      <SpansExplorer />
    </ObservabilityCapabilityGate>
  );
}
