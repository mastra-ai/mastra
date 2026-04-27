// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { UseFormReturn } from 'react-hook-form';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { SkillsDetail } from '../skills-detail';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4112';

let formMethodsRef: UseFormReturn<AgentBuilderEditFormValues> | null = null;

const FormWrapper = ({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<AgentBuilderEditFormValues>;
}) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      name: '',
      instructions: '',
      tools: {},
      agents: {},
      workflows: {},
      skills: {},
      ...defaultValues,
    },
  });
  formMethodsRef = methods;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <FormProvider {...methods}>{children}</FormProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const skillsFixture = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize text',
    license: 'MIT',
    files: [],
    status: 'published',
    authorId: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    instructions: '',
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text',
    license: 'MIT',
    files: [],
    status: 'published',
    authorId: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    instructions: '',
  },
];

describe('SkillsDetail picker', () => {
  afterEach(() => {
    cleanup();
    formMethodsRef = null;
  });

  it('renders fetched skills and toggles them into the form record', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/skills`, () =>
        HttpResponse.json({
          skills: skillsFixture,
          total: skillsFixture.length,
          page: 1,
          perPage: 50,
          hasMore: false,
        }),
      ),
    );

    render(
      <FormWrapper>
        <SkillsDetail onClose={() => {}} />
      </FormWrapper>,
    );

    await waitFor(() => expect(screen.getByText('Summarize')).toBeTruthy());
    expect(screen.getByText('Translate')).toBeTruthy();

    const summarizeToggle = screen.getByTestId('skills-detail-toggle-summarize');
    fireEvent.click(summarizeToggle);
    expect(formMethodsRef!.getValues('skills')).toEqual({
      summarize: { description: 'Summarize text' },
    });

    fireEvent.click(summarizeToggle);
    expect(formMethodsRef!.getValues('skills')).toEqual({});
  });

  it('renders the empty state when no skills are returned', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/skills`, () =>
        HttpResponse.json({ skills: [], total: 0, page: 1, perPage: 50, hasMore: false }),
      ),
    );

    render(
      <FormWrapper>
        <SkillsDetail onClose={() => {}} />
      </FormWrapper>,
    );

    await waitFor(() => expect(screen.getByText(/No skills in this project yet/i)).toBeTruthy());
  });

  it('disables toggles when editable is false', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/skills`, () =>
        HttpResponse.json({
          skills: skillsFixture,
          total: skillsFixture.length,
          page: 1,
          perPage: 50,
          hasMore: false,
        }),
      ),
    );

    render(
      <FormWrapper>
        <SkillsDetail onClose={() => {}} editable={false} />
      </FormWrapper>,
    );

    await waitFor(() => expect(screen.getByText('Summarize')).toBeTruthy());
    const toggle = screen.getByTestId('skills-detail-toggle-summarize') as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
  });
});
