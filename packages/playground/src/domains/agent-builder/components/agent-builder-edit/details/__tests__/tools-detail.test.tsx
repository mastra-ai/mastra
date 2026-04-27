// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { UseFormReturn } from 'react-hook-form';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { ToolsDetail } from '../tools-detail';

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({ children }: { children: React.ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      instructions: '',
      tools: {},
      agents: {},
      workflows: {},
      skills: [],
    },
  });
  formMethodsRef = methods;
  return (
    <TooltipProvider>
      <FormProvider {...methods}>{children}</FormProvider>
    </TooltipProvider>
  );
};

const renderTools = (availableAgentTools: AgentTool[]) =>
  render(
    <FormWrapper>
      <ToolsDetail onClose={() => {}} availableAgentTools={availableAgentTools} />
    </FormWrapper>,
  );

describe('ToolsDetail toggle routing', () => {
  afterEach(() => {
    cleanup();
    formMethodsRef = null;
  });

  it('routes a tool toggle to form.tools', () => {
    renderTools([{ id: 'tool-a', name: 'Tool A', isChecked: false, type: 'tool' }]);
    fireEvent.click(screen.getByLabelText(/Tool A/i));
    expect(formMethodsRef!.getValues('tools')).toEqual({ 'tool-a': true });
    expect(formMethodsRef!.getValues('agents')).toEqual({});
    expect(formMethodsRef!.getValues('workflows')).toEqual({});
  });

  it('routes an agent toggle to form.agents', () => {
    renderTools([{ id: 'agent-x', name: 'Agent X', isChecked: false, type: 'agent' }]);
    fireEvent.click(screen.getByLabelText(/Agent X/i));
    expect(formMethodsRef!.getValues('agents')).toEqual({ 'agent-x': true });
    expect(formMethodsRef!.getValues('tools')).toEqual({});
    expect(formMethodsRef!.getValues('workflows')).toEqual({});
  });

  it('routes a workflow toggle to form.workflows', () => {
    renderTools([{ id: 'wf-1', name: 'Workflow One', isChecked: false, type: 'workflow' }]);
    fireEvent.click(screen.getByLabelText(/Workflow One/i));
    expect(formMethodsRef!.getValues('workflows')).toEqual({ 'wf-1': true });
    expect(formMethodsRef!.getValues('tools')).toEqual({});
    expect(formMethodsRef!.getValues('agents')).toEqual({});
  });
});
