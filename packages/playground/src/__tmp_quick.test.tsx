// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { MessageRow } from '@/domains/agent-builder/components/chat-primitives/messages';
import { SET_AGENT_TOOLS_TOOL_NAME } from '@/domains/agent-builder/services/tool-constants';

const Wrap = ({ children, defaults }: { children: ReactNode; defaults?: any }) => {
  const methods = useForm({ defaultValues: defaults ?? {} });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('tools none case', () => {
  it('empty tools prop, no form value', () => {
    const { container } = render(
      <Wrap>
        <MessageRow message={{ id: 'm', role: 'assistant', parts: [
          { type: 'dynamic-tool', toolCallId: 'c', toolName: SET_AGENT_TOOLS_TOOL_NAME, state: 'output-available', input: { tools: [] }, output: { ok: true } }
        ] } as any} />
      </Wrap>
    );
    console.log('A:', JSON.stringify(container.textContent));
  });

  it('empty tools prop, form has tools={}', () => {
    const { container } = render(
      <Wrap defaults={{ tools: {} }}>
        <MessageRow message={{ id: 'm', role: 'assistant', parts: [
          { type: 'dynamic-tool', toolCallId: 'c', toolName: SET_AGENT_TOOLS_TOOL_NAME, state: 'output-available', input: { tools: [] }, output: { ok: true } }
        ] } as any} />
      </Wrap>
    );
    console.log('B:', JSON.stringify(container.textContent));
  });

  it('tools prop with items, form has tools={a:false}', () => {
    const { container } = render(
      <Wrap defaults={{ tools: { a: false } }}>
        <MessageRow message={{ id: 'm', role: 'assistant', parts: [
          { type: 'dynamic-tool', toolCallId: 'c', toolName: SET_AGENT_TOOLS_TOOL_NAME, state: 'output-available', input: { tools: [{id:'a', name:'A'}] }, output: { ok: true } }
        ] } as any} />
      </Wrap>
    );
    console.log('C:', JSON.stringify(container.textContent));
  });
});
