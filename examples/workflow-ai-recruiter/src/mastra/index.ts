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

const evaluateTechnicalSkills = new Step({
  id: 'evaluateTechnicalSkills',
  outputSchema: z.object({
    skillAssessment: z.object({
      technicalScore: z.number(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
    }),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }
    const candidateInfo = context.machineContext?.getStepPayload<CandidateInfo>('gatherCandidateInfo');

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
      You are a technical recruiter. Given the resume below, evaluate the candidate's technical skills.
      Provide a technical score from 0-100, and list their key strengths and areas for improvement.
      Resume: ${candidateInfo?.resumeText}
    `;
    const res = await llm.generate(prompt, {
      output: z.object({
        technicalScore: z.number(),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
      }),
    });

    return { skillAssessment: res.object };
  },
});

const assessCulturalFit = new Step({
  id: 'assessCulturalFit',
  outputSchema: z.object({
    culturalAssessment: z.object({
      fitScore: z.number(),
      notes: z.string(),
    }),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }
    const candidateInfo = context.machineContext?.getStepPayload<CandidateInfo>('gatherCandidateInfo');

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
      You are a recruiter evaluating cultural fit. Given the resume below, assess how well the candidate might
      fit into a collaborative, fast-paced tech company. Consider factors like teamwork, communication, and adaptability.
      Provide a fit score from 0-100 and detailed notes.
      Resume: ${candidateInfo?.resumeText}
    `;
    const res = await llm.generate(prompt, {
      output: z.object({
        fitScore: z.number(),
        notes: z.string(),
      }),
    });

    return { culturalAssessment: res.object };
  },
});

const makeRecommendation = new Step({
  id: 'makeRecommendation',
  outputSchema: z.object({
    recommendation: z.object({
      proceed: z.boolean(),
      reasoning: z.string(),
      nextSteps: z.string(),
    }),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.llm) {
      throw new Error('Mastra instance is required to run this step');
    }
    const technicalEval = context.machineContext?.getStepPayload<any>('evaluateTechnicalSkills')?.skillAssessment;
    const culturalEval = context.machineContext?.getStepPayload<any>('assessCulturalFit')?.culturalAssessment;

    const llm = mastra.llm({ provider: 'OPEN_AI', name: 'gpt-4o' });
    const prompt = `
      You are a senior recruiter making a final recommendation. Consider:
      1. Technical Score: ${technicalEval?.technicalScore}/100
      2. Cultural Fit Score: ${culturalEval?.fitScore}/100
      3. Technical Strengths: ${technicalEval?.strengths.join(', ')}
      4. Areas for Improvement: ${technicalEval?.weaknesses.join(', ')}
      5. Cultural Fit Notes: ${culturalEval?.notes}

      Make a recommendation on whether to proceed with the candidate and explain why.
      Also suggest next steps in the recruitment process.
    `;
    const res = await llm.generate(prompt, {
      output: z.object({
        proceed: z.boolean(),
        reasoning: z.string(),
        nextSteps: z.string(),
      }),
    });

    return { recommendation: res.object };
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
  .then(evaluateTechnicalSkills)
  .then(assessCulturalFit)
  .then(makeRecommendation)
  .after(gatherCandidateInfo)
  .step(askAboutRole, {
    when: { 'gatherCandidateInfo.isTechnical': false },
  })
  .then(assessCulturalFit)
  .then(makeRecommendation);

candidateWorkflow.commit();

export const mastra = new Mastra({
  workflows: {
    candidateWorkflow,
  },
});

// (async () => {
//   const { runId, start } = mastra.getWorkflow('candidateWorkflow').createRun();

//   console.log('Run', runId);

//   const runResult = await start({
//     triggerData: { resumeText: 'Simulated resume content...' },
//   });

//   console.log('Final output:', runResult.results);
// })();
