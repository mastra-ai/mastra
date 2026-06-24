// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LogsErrorContent } from './logs-error-content';

describe('LogsErrorContent', () => {
  it('renders an unavailable state when the storage provider cannot list logs', () => {
    render(
      <LogsErrorContent
        error={new Error('This storage provider does not support listing logs')}
        resource="logs"
        errorTitle="Failed to load logs"
      />,
    );

    expect(screen.getByText('Logs are not available with your current storage')).toBeTruthy();
    expect(screen.queryByText('Failed to load logs')).toBeNull();
  });
});
