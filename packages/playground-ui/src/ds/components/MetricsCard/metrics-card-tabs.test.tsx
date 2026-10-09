// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricsCard } from './metrics-card';

afterEach(cleanup);

function Lenses({ onChange }: { onChange: (value: string) => void }) {
  const [lens, setLens] = useState('busiest');
  return (
    <MetricsCard.Tabs
      value={lens}
      onValueChange={next => {
        setLens(next);
        onChange(next);
      }}
    >
      <MetricsCard.Tab value="busiest">Busiest</MetricsCard.Tab>
      <MetricsCard.Tab value="failing">Failing</MetricsCard.Tab>
    </MetricsCard.Tabs>
  );
}

describe('MetricsCard.Tabs', () => {
  it('switches the card view and marks the chosen tab selected', () => {
    const onChange = vi.fn();
    render(<Lenses onChange={onChange} />);

    expect(screen.getByRole('tab', { name: 'Busiest' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Failing' }));

    expect(onChange).toHaveBeenCalledWith('failing');
    expect(screen.getByRole('tab', { name: 'Failing' }).getAttribute('aria-selected')).toBe('true');
  });
});
