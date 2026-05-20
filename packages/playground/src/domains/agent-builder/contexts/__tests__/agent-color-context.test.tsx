// @vitest-environment jsdom
import { stringToColor } from '@mastra/playground-ui';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { AgentColors } from '../agent-color-context';
import { AgentColorProvider, useAgentColor } from '../agent-color-context';

interface HarnessProps {
  initialName: string;
  /** Captures every color value the consumer observes across renders. */
  observed: AgentColors[];
}

const Consumer = ({ observed }: { observed: AgentColors[] }) => {
  const color = useAgentColor();
  observed.push(color);
  return <div data-testid="consumer" data-bg={color?.background ?? ''} data-fg={color?.foreground ?? ''} />;
};

const Harness = ({ initialName, observed }: HarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: initialName,
    } as AgentBuilderEditFormValues,
  });

  // Expose setValue via a button so we can update the form name from a test.
  const setNameRef = useRef<((value: string) => void) | null>(null);
  useEffect(() => {
    setNameRef.current = (value: string) => methods.setValue('name', value);
  }, [methods]);

  return (
    <FormProvider {...methods}>
      <AgentColorProvider>
        <Consumer observed={observed} />
        <button
          type="button"
          data-testid="set-name"
          onClick={event => {
            const next = (event.currentTarget as HTMLButtonElement).dataset.next ?? '';
            setNameRef.current?.(next);
          }}
        />
      </AgentColorProvider>
    </FormProvider>
  );
};

describe('AgentColorProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null when the form name is empty', () => {
    const observed: AgentColors[] = [];
    const { getByTestId } = render(<Harness initialName="" observed={observed} />);
    const consumer = getByTestId('consumer');
    expect(consumer.getAttribute('data-bg')).toBe('');
    expect(consumer.getAttribute('data-fg')).toBe('');
  });

  it('returns null when the form name is whitespace only', () => {
    const observed: AgentColors[] = [];
    const { getByTestId } = render(<Harness initialName="   " observed={observed} />);
    expect(getByTestId('consumer').getAttribute('data-bg')).toBe('');
  });

  it('derives an hsl background and a darker hsl foreground from the trimmed name', () => {
    const observed: AgentColors[] = [];
    const { getByTestId } = render(<Harness initialName="  Support agent  " observed={observed} />);
    const consumer = getByTestId('consumer');
    expect(consumer.getAttribute('data-bg')).toBe(stringToColor('Support agent'));
    expect(consumer.getAttribute('data-fg')).toBe(stringToColor('Support agent', 20));
    // Background uses lightness 90%, foreground uses lightness 20%.
    expect(consumer.getAttribute('data-bg')).toMatch(/hsl\(-?\d+, 100%, 90%\)/);
    expect(consumer.getAttribute('data-fg')).toMatch(/hsl\(-?\d+, 100%, 20%\)/);
  });

  it('updates the consumer when the form name changes', () => {
    const observed: AgentColors[] = [];
    const { getByTestId } = render(<Harness initialName="alpha" observed={observed} />);
    const consumer = getByTestId('consumer');
    const initialBg = consumer.getAttribute('data-bg');
    expect(initialBg).toBe(stringToColor('alpha'));

    const button = getByTestId('set-name') as HTMLButtonElement;
    button.dataset.next = 'omega';
    fireEvent.click(button);

    expect(consumer.getAttribute('data-bg')).toBe(stringToColor('omega'));
  });

  it('keeps the color object referentially stable when the name does not change', () => {
    const observed: AgentColors[] = [];
    const { getByTestId, rerender } = render(<Harness initialName="stable-name" observed={observed} />);
    const first = observed[observed.length - 1];
    expect(first).not.toBeNull();

    rerender(<Harness initialName="stable-name" observed={observed} />);
    // Force a re-render that does not change the form name.
    const button = getByTestId('set-name') as HTMLButtonElement;
    button.dataset.next = 'stable-name';
    fireEvent.click(button);

    const latest = observed[observed.length - 1];
    expect(latest).toEqual(first);
  });
});

describe('useAgentColor', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null when used outside of an AgentColorProvider', () => {
    const observed: AgentColors[] = [];
    render(<Consumer observed={observed} />);
    expect(observed.at(-1)).toBeNull();
  });
});
