import { useTools } from '@mastra/react/hooks/tools';
import type { SpanRecord } from '../../types';
import { SpanPayloadList, SpanPayloadListName } from './span-payload-primitives';
import { getDelegatedToolHref, getSpanTools } from './span-payload-registry';
import type { SpanTool } from './span-payload-registry';
import { SpanPayloadSection } from './span-payload-section';
import type { SpanPayloadSectionProps } from './span-payload-section';
import { Txt } from '@/ds/components/Txt';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { useLinkComponent } from '@/lib/framework';

/**
 * Registered tool ids by the names a span may record them under: the tool id,
 * or the key it is registered with (what model spans pass to the provider).
 */
function useRegisteredToolIds(): Map<string, string> {
  const { data: tools = {} } = useTools();
  const ids = new Map<string, string>();
  for (const [key, tool] of Object.entries(tools)) {
    ids.set(key, tool.id);
    ids.set(tool.id, tool.id);
  }
  return ids;
}

function SpanToolList({ tools }: { tools: SpanTool[] }) {
  const { Link, paths } = useLinkComponent();
  const registered = useRegisteredToolIds();

  return (
    <SpanPayloadList
      slot="span-tools"
      items={tools.map(tool => {
        const registeredId = registered.get(tool.id);
        // Workspace, skill and agent-only tools are not in the registry, so they have no page to open.
        const href = getDelegatedToolHref(paths, tool.id) || (registeredId ? paths.toolLink(registeredId) : '');
        return {
          key: tool.id,
          description: tool.description,
          name: href ? (
            <Link href={href} className="w-fit max-w-full truncate text-foreground hover:underline">
              <Txt as="span" variant="label">
                {tool.id}
              </Txt>
            </Link>
          ) : (
            <SpanPayloadListName>{tool.id}</SpanPayloadListName>
          ),
        };
      })}
    />
  );
}

export interface SpanToolsSectionProps {
  span: SpanRecord;
  layout?: SpanPayloadSectionProps['layout'];
}

/** The tools the span offered the model. */
export function SpanToolsSection({ span, layout }: SpanToolsSectionProps) {
  const spanTools = getSpanTools(span);
  if (!spanTools) return null;

  return (
    <SpanPayloadSection
      title={`Available tools (${spanTools.tools.length})`}
      icon={<ToolsIcon />}
      raw={spanTools.raw}
      layout={layout}
    >
      <SpanToolList tools={spanTools.tools} />
    </SpanPayloadSection>
  );
}
