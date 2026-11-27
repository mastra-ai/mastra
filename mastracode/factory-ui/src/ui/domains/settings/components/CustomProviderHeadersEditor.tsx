import { Button } from '@mastra/playground-ui/components/Button';
import { Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconEyeOpen } from '@mastra/playground-ui/icons/central/IconEyeOpen';
import { IconEyeSlash } from '@mastra/playground-ui/icons/central/IconEyeSlash';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import { useRef } from 'react';
import { flushSync } from 'react-dom';

import { MAX_CUSTOM_HEADERS, hasSavedSecret, headerInputId, newHeaderDraft } from './custom-provider-draft';
import type { HeaderDraft } from './custom-provider-draft';

/** One header: name, value, whether the value is secret, and remove. */
function HeaderRow({
  header,
  index,
  onChange,
  onRemove,
}: {
  header: HeaderDraft;
  index: number;
  onChange: (header: HeaderDraft) => void;
  onRemove: () => void;
}) {
  const label = `Header ${index + 1}`;
  return (
    // Below `sm` the name takes its own line, so a long name stays readable next to a value and two buttons.
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto_auto]">
      <Input
        id={headerInputId({ key: header.key, input: 'name' })}
        aria-label={`${label} name`}
        placeholder="Name"
        autoComplete="off"
        spellCheck={false}
        className="col-span-3 sm:col-span-1"
        value={header.name}
        onChange={event => onChange({ ...header, name: event.target.value })}
      />
      <Input
        id={headerInputId({ key: header.key, input: 'value' })}
        aria-label={`${label} value`}
        // A secret value is masked while typed, as it is write-only once saved.
        type={header.secret ? 'password' : 'text'}
        // The saved value is never sent to the browser, so an empty field stands for it.
        placeholder={hasSavedSecret(header) ? 'Saved. Type to replace.' : 'Value'}
        autoComplete="off"
        spellCheck={false}
        value={header.value}
        onChange={event => onChange({ ...header, value: event.target.value })}
      />
      <Button
        variant="ghost"
        size="icon-md"
        aria-label={`Keep header ${index + 1} value secret`}
        aria-pressed={header.secret}
        tooltip={header.secret ? 'Secret: not shown again after saving' : 'Plain: shown when you edit'}
        onClick={() => onChange({ ...header, secret: !header.secret })}
      >
        {header.secret ? <IconEyeSlash /> : <IconEyeOpen />}
      </Button>
      <Button variant="ghost" size="icon-md" aria-label={`Remove header ${index + 1}`} onClick={onRemove}>
        <TrashIcon />
      </Button>
    </li>
  );
}

/** Moves focus to a header row's name input. */
function focusHeaderName(key: string) {
  document.getElementById(headerInputId({ key, input: 'name' }))?.focus();
}

/** Extra HTTP headers sent on every call to the endpoint, each secret (write-only) or plain. */
export function CustomProviderHeadersEditor({
  headers,
  onChange,
}: {
  headers: HeaderDraft[];
  onChange: (headers: HeaderDraft[]) => void;
}) {
  const addButton = useRef<HTMLElement>(null);

  /** Adds an empty row and moves focus into it. */
  const add = () => {
    const header = newHeaderDraft();
    // Rendered synchronously so the new input exists to take focus.
    flushSync(() => onChange([...headers, header]));
    focusHeaderName(header.key);
  };

  /**
   * Removes a row. Its remove button goes with it, so focus moves to the row that takes its place, the row above
   * when it was the last one, or Add header when no rows are left.
   */
  const remove = (index: number) => {
    const next = headers.filter((_, position) => position !== index);
    flushSync(() => onChange(next));
    const neighbour = next[index] ?? next[index - 1];
    if (neighbour) focusHeaderName(neighbour.key);
    else addButton.current?.focus();
  };

  return (
    <Fieldset className="gap-2">
      <FieldsetLegend>Custom headers</FieldsetLegend>
      <Txt as="p" variant="caption" tone="muted" className="-mt-1">
        Sent on every call to this endpoint. Secret values cannot be read back after saving.
      </Txt>
      {headers.length > 0 && (
        <ul className="flex flex-col gap-3 sm:gap-1.5">
          {headers.map((header, index) => (
            <HeaderRow
              key={header.key}
              header={header}
              index={index}
              onChange={next => onChange(headers.map(current => (current.key === header.key ? next : current)))}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      )}
      <div>
        <Button
          ref={addButton}
          variant="ghost"
          size="sm"
          icon={<IconPlusMedium />}
          disabled={headers.length >= MAX_CUSTOM_HEADERS}
          onClick={add}
        >
          Add header
        </Button>
      </div>
    </Fieldset>
  );
}
