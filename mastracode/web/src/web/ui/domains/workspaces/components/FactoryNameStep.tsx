import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

export interface FactoryNameStepProps {
  pending: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
}

/** First step of the `/factories/create` wizard: name the new Factory. */
export function FactoryNameStep({ pending, error, onSubmit }: FactoryNameStepProps) {
  const [name, setName] = useState('');

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col gap-3 text-left"
      onSubmit={event => {
        event.preventDefault();
        const trimmed = name.trim();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Txt as="label" htmlFor="factory-name" variant="ui-sm" className="text-icon4">
          Factory name
        </Txt>
        <Input
          id="factory-name"
          autoFocus
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="e.g. Mastra"
          disabled={pending}
        />
      </div>
      {error && (
        <Txt as="div" role="alert" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}
      <Button variant="primary" type="submit" disabled={!name.trim() || pending}>
        {pending && <Spinner size="sm" aria-label="Creating Factory" />}
        {pending ? 'Creating…' : 'Continue'}
      </Button>
    </form>
  );
}
