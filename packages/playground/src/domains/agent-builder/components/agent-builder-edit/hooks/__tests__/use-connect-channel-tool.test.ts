// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CONNECT_CHANNEL_TOOL_NAME, useConnectChannelTool } from '../use-connect-channel-tool';

describe('useConnectChannelTool', () => {
  it('returns a tool with the connectChannel id', () => {
    const { result } = renderHook(() => useConnectChannelTool());
    expect(result.current.id).toBe(CONNECT_CHANNEL_TOOL_NAME);
  });

  it('execute resolves to { success: true } without side effects', async () => {
    const { result } = renderHook(() => useConnectChannelTool());
    const tool = result.current as unknown as {
      execute: (input: { context: { platform: 'slack' } }) => Promise<{ success: boolean }>;
    };
    await expect(tool.execute({ context: { platform: 'slack' } })).resolves.toEqual({ success: true });
  });

  it('rejects unknown platforms via the input schema', () => {
    const { result } = renderHook(() => useConnectChannelTool());
    const tool = result.current as unknown as {
      inputSchema: { safeParse: (v: unknown) => { success: boolean } };
    };
    expect(tool.inputSchema.safeParse({ platform: 'discord' }).success).toBe(false);
    expect(tool.inputSchema.safeParse({ platform: 'slack' }).success).toBe(true);
  });
});
