import type { KnowledgeImporterRoot } from '@mastra/client-js';
import { FieldContent, FieldDescription, FieldItem, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { rootLabel } from '../roots';

export interface RootControlProps {
  /** Declared roots, in the server's display order. */
  roots: KnowledgeImporterRoot[];
  value: string;
  /** The saved root id the server no longer declares, when `value` is standing in for it. */
  fallbackFrom: string | undefined;
  readOnly: boolean;
  disabled: boolean;
  onChange: (root: string) => void;
}

/** Which top-level area under the organization this connection's pages land in. */
export function RootControl({ roots, value, fallbackFrom, readOnly, disabled, onChange }: RootControlProps) {
  const label = rootLabel(roots, value);
  return (
    <div className="flex flex-col gap-3">
      {fallbackFrom === undefined ? null : (
        <Notice variant="warning" title="Saved area removed">
          <Notice.Message>
            The area this connection was saved to no longer exists, so its pages land in {label} until you choose
            another.
          </Notice.Message>
        </Notice>
      )}
      {readOnly ? (
        <Txt variant="body">Lands in {label}.</Txt>
      ) : (
        <RadioGroup aria-label="Where it lands" value={value} disabled={disabled} onValueChange={onChange}>
          {roots.map(root => (
            <FieldItem key={root.id}>
              <RadioGroupItem value={root.id} />
              <FieldContent>
                <FieldLabel>{root.displayLabel}</FieldLabel>
                {root.description ? <FieldDescription>{root.description}</FieldDescription> : null}
              </FieldContent>
            </FieldItem>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}
