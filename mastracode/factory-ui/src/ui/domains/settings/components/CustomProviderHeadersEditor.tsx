import { Button } from '@mastra/playground-ui/components/Button';
import { Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconEyeOpen } from '@mastra/playground-ui/icons/central/IconEyeOpen';
import { IconEyeSlash } from '@mastra/playground-ui/icons/central/IconEyeSlash';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

import { MAX_CUSTOM_HEADERS, hasSavedSecret, newHeaderDraft } from './custom-provider-draft';
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
    <li className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto_auto] items-center gap-1.5">
      <Input
        aria-label={`${label} name`}
        placeholder="Name"
        autoComplete="off"
        spellCheck={false}
        value={header.name}
        onChange={event => onChange({ ...header, name: event.target.value })}
      />
      <Input
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
        aria-label={`${label} is secret`}
        aria-pressed={header.secret}
        tooltip={header.secret ? 'Secret: hidden and never shown again' : 'Plain: shown when you edit'}
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

/** Extra HTTP headers sent on every call to the endpoint, each secret (write-only) or plain. */
export function CustomProviderHeadersEditor({
  headers,
  onChange,
}: {
  headers: HeaderDraft[];
  onChange: (headers: HeaderDraft[]) => void;
}) {
  return (
    <Fieldset className="gap-2">
      <FieldsetLegend>Custom headers</FieldsetLegend>
      <Txt as="p" variant="caption" tone="muted" className="-mt-1">
        Sent on every call to this endpoint. Secret values cannot be read back after saving.
      </Txt>
      {headers.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {headers.map((header, index) => (
            <HeaderRow
              key={header.key}
              header={header}
              index={index}
              onChange={next => onChange(headers.map(current => (current.key === header.key ? next : current)))}
              onRemove={() => onChange(headers.filter(current => current.key !== header.key))}
            />
          ))}
        </ul>
      )}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<IconPlusMedium />}
          disabled={headers.length >= MAX_CUSTOM_HEADERS}
          onClick={() => onChange([...headers, newHeaderDraft()])}
        >
          Add header
        </Button>
      </div>
    </Fieldset>
  );
}
