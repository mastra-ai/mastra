import { Txt } from '@mastra/playground-ui/components/Txt';
import { parseRecordSegments } from './recordText';
export function KnowledgeRecordText({ text, onNodeRef }: { text: string; onNodeRef?: (name: string) => void }) {
  return (
    <span>
      {parseRecordSegments(text).map((segment, index) =>
        segment.type === 'wikilink' ? (
          <button
            key={index}
            type="button"
            className="bg-badge-purple-subtle text-badge-purple-foreground hover:bg-badge-purple-strong rounded px-1"
            onClick={event => {
              event.stopPropagation();
              onNodeRef?.(segment.value);
            }}
          >
            <Txt as="span" variant="label" className="block">
              {segment.value}
            </Txt>
          </button>
        ) : (
          <span key={index}>{segment.value}</span>
        ),
      )}
    </span>
  );
}
