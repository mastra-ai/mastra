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
    specialty: z.string(),
    resumeText: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }
    const resumeText = context.machineContext?.getStepPayload<{ resumeText: string }>('trigger')?.resumeText;

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });

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

interface CandidateInfo {
  candidateName: string;
  isTechnical: boolean;
  specialty: string;
  resumeText: string;
}

const askAboutSpecialty = new Step({
  id: 'askAboutSpecialty',
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }

    const candidateInfo = context.machineContext?.getStepPayload<CandidateInfo>('gatherCandidateInfo');

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
          You are a recruiter. Given the resume below, craft a short question
          for ${candidateInfo?.candidateName} about how they got into "${candidateInfo?.specialty}".
          Resume: ${candidateInfo?.resumeText}
        `;
    const res = await llm.generate(prompt);
    return { question: res?.text?.trim() || '' };
  },
});

const askAboutRole = new Step({
  id: 'askAboutRole',
  outputSchema: z.object({
    question: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }
    const candidateInfo = context.machineContext?.getStepPayload<CandidateInfo>('gatherCandidateInfo');

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
          You are a recruiter. Given the resume below, craft a short question
          for ${candidateInfo?.candidateName} asking what interests them most about this role.
          Resume: ${candidateInfo?.resumeText}
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
  .step(gatherCandidateInfo)
  .then(askAboutSpecialty, {
    when: { 'gatherCandidateInfo.isTechnical': true },
  })
  .after(gatherCandidateInfo)
  .step(askAboutRole, {
    when: { 'gatherCandidateInfo.isTechnical': false },
  });

candidateWorkflow.commit();

const mastra = new Mastra({
  workflows: {
    candidateWorkflow,
  },
});

(async () => {
  const { runId, start } = mastra.getWorkflow('candidateWorkflow').createRun();

  console.log('Run', runId);

  const runResult = await start({
    triggerData: { resumeText: 'Simulated resume content...' },
  });

  console.log('Final output:', runResult.results);
})();
