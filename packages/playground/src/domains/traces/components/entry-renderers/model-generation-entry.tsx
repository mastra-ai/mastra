import { spanSubject } from '../../lib/humanize-span-name';
import { promptMessages } from '../../lib/prompt-messages';
import type { EntryRendererProps } from './types';

/**
 * The model id, then the prompt it was given. The turn's final answer gets its own row at the
 * bottom of the timeline, so the output is deliberately not echoed here.
 */
export function ModelGenerationEntry({ span }: EntryRendererProps) {
  const messages = promptMessages(span);
  const provider = typeof span.attributes?.provider === 'string' ? span.attributes.provider : undefined;
  const label = `Called model ${spanSubject(span)}${provider ? ` on ${provider}` : ''}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-neutral6 text-ui-smd">{label}</p>

      {messages.length > 0 && (
        <ul className="border-border2 flex flex-col gap-2 border-l pl-3">
          {messages.map((message, index) => (
            <li key={index} className="flex flex-col gap-0.5">
              <span className="text-neutral4 text-ui-sm font-mono uppercase">{message.role}</span>
              <span className="text-neutral6 text-ui-sm whitespace-pre-wrap">{message.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
