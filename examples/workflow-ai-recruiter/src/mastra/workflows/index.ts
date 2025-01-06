import { Step, Workflow, Mastra } from '@mastra/core';
import { z } from 'zod';

const gatherCandidateInfo = new Step({
  id: 'gatherCandidateInfo',
  inputSchema: z.object({
    resumeText: z.string(),
  }),
  outputSchema: z.object({
    candidateName: z.string(),
    isTechnical: z.boolean(),
    specialty: z.string().optional(),
    resumeText: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const resumeText = context.resumeText;
    const prompt = `
          You are given this resume text:
          "${resumeText}"
        `;
    const res = await llm.generate(prompt, {
      output: z.object({
        candidateName: z.string(),
        isTechnical: z.boolean(),
        specialty: z.string(),
        resumeText: z.string(),
      }),
    });

    return res.object;
  },
});

const askAboutSpecialty = new Step({
  id: 'askAboutSpecialty',
  inputSchema: z.object({
    candidateInfo: z.object({
      candidateName: z.string(),
      isTechnical: z.boolean(),
      specialty: z.string().optional(),
      resumeText: z.string(),
    }),
  }),
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
          You are a recruiter. Given the resume below, craft a short question
          for ${context.candidateInfo.candidateName} about how they got into "${context.candidateInfo.specialty}".
          Resume: ${context.candidateInfo.resumeText}
        `;
    const res = await llm.generate(prompt);
    return { question: res?.text?.trim() || '' };
  },
});

const askAboutRole = new Step({
  id: 'askAboutRole',
  inputSchema: z.object({
    candidateInfo: z.object({
      candidateName: z.string(),
      isTechnical: z.boolean(),
      specialty: z.string().optional(),
      resumeText: z.string(),
    }),
  }),
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
          You are a recruiter. Given the resume below, craft a short question
          for ${context.candidateInfo.candidateName} asking what interests them most about this role.
          Resume: ${context.candidateInfo.resumeText}
        `;
    const res = await llm.generate(prompt);
    return { question: res?.text?.trim() || '' };
  },
});

const candidateWorkflow = new Workflow({
  name: 'candidate-workflow',
  triggerSchema: z.object({
    resumeText: z.string(),
  }),
});

candidateWorkflow
  .step(gatherCandidateInfo, {
    variables: {
      resumeText: {
        step: 'trigger',
        path: 'resumeText',
      },
    },
  })
  .then(askAboutSpecialty, {
    when: { 'gatherCandidateInfo.isTechnical': true },
    variables: {
      candidateInfo: {
        step: gatherCandidateInfo,
        path: '.',
      },
    },
  })
  .then(askAboutRole, {
    when: { 'gatherCandidateInfo.isTechnical': false },
    variables: {
      candidateInfo: {
        step: gatherCandidateInfo,
        path: '.',
      },
    },
  });

candidateWorkflow.commit();

export { candidateWorkflow };
