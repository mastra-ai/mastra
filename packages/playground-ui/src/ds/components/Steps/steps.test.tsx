// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Steps } from './steps';

afterEach(() => {
  cleanup();
});

describe('Steps', () => {
  it('lists its steps in order, titled at the heading level it is given', () => {
    render(
      <Steps headingLevel={2}>
        <Steps.Step title="Create an API key" />
        <Steps.Step title="Send your first request" />
      </Steps>,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
      'Create an API key',
      'Send your first request',
    ]);
  });

  it('defaults step titles to h3', () => {
    render(
      <Steps>
        <Steps.Step title="Add credits" />
      </Steps>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Add credits' })).toBeTruthy();
  });

  it('marks a done step with a check instead of its number', () => {
    render(
      <Steps>
        <Steps.Step title="Create an API key" done />
        <Steps.Step title="Add credits" />
      </Steps>,
    );

    expect(screen.getAllByLabelText('Done')).toHaveLength(1);
  });

  it('renders the description, action and content it is given', () => {
    render(
      <Steps>
        <Steps.Step title="Connect your project" description="Paste the prompt." action={<button>Docs</button>}>
          <pre>pnpm add @mastra/core</pre>
        </Steps.Step>
      </Steps>,
    );

    expect(screen.getByText('Paste the prompt.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Docs' })).toBeTruthy();
    expect(screen.getByText('pnpm add @mastra/core')).toBeTruthy();
  });
});
