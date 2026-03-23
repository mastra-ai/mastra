import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const legislationInput = z.object({
  title: z.string().describe('Title of the legislation or policy proposal'),
  text: z.string().describe('Full text or detailed summary of the proposed legislation'),
});

const analysisOutput = z.object({
  domain: z.string(),
  summary: z.string(),
  benefits: z.array(z.string()),
  risks: z.array(z.string()),
  recommendations: z.array(z.string()),
  impactRating: z.string(),
});

const deliberationOutput = z.object({
  domain: z.string(),
  // Original analysis carried forward
  initialAnalysis: analysisOutput,
  // Deliberation responses
  agreements: z.array(z.string()),
  counterArguments: z.array(z.string()),
  revisedRecommendations: z.array(z.string()),
  revisedImpactRating: z.string(),
});

function createCommitteeStep(agentId: string, committeeName: string) {
  return createStep({
    id: `${agentId}-review`,
    description: `${committeeName} reviews the legislation`,
    inputSchema: legislationInput,
    outputSchema: analysisOutput,
    execute: async ({ inputData, mastra }) => {
      const agent = mastra?.getAgent(agentId);
      if (!agent) throw new Error(`Agent ${agentId} not found`);

      const { text } = await agent.generate([
        {
          role: 'user',
          content: `Please analyze the following proposed legislation:

**Title:** ${inputData.title}

**Full Text:**
${inputData.text}

Provide your expert analysis from your domain perspective.`,
        },
      ]);

      return parseAnalysis(text, committeeName);
    },
  });
}

function parseAnalysis(text: string, domain: string) {
  const sections = text.split(/\n(?=\*\*|#{1,3}\s)/);
  const benefits: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];
  let summary = '';
  let impactRating = 'NEUTRAL';

  for (const section of sections) {
    const lower = section.toLowerCase();
    const bullets = section
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[\s\-*]+/, '').trim())
      .filter(Boolean);

    if (lower.includes('summary of impact') || lower.includes('summary')) {
      summary = section.replace(/\*\*.*?\*\*:?\s*/g, '').replace(/#{1,3}\s.*\n/, '').trim();
    } else if (lower.includes('benefit') || lower.includes('positive')) {
      benefits.push(...bullets);
    } else if (lower.includes('risk') || lower.includes('concern') || lower.includes('negative')) {
      risks.push(...bullets);
    } else if (lower.includes('recommend') || lower.includes('amendment')) {
      recommendations.push(...bullets);
    }

    const ratingMatch = section.match(/\b(HIGHLY POSITIVE|HIGHLY NEGATIVE|POSITIVE|NEGATIVE|NEUTRAL)\b/);
    if (ratingMatch) {
      impactRating = ratingMatch[1];
    }
  }

  if (!summary) {
    summary = text.slice(0, 300);
  }

  return {
    domain,
    summary,
    benefits: benefits.length > 0 ? benefits : ['See full analysis'],
    risks: risks.length > 0 ? risks : ['See full analysis'],
    recommendations: recommendations.length > 0 ? recommendations : ['See full analysis'],
    impactRating,
  };
}

const allAnalysesSchema = z.object({
  'fiscalAnalyst-review': analysisOutput,
  'healthAnalyst-review': analysisOutput,
  'defenseAnalyst-review': analysisOutput,
  'technologyAnalyst-review': analysisOutput,
  'civilRightsAnalyst-review': analysisOutput,
  'environmentalAnalyst-review': analysisOutput,
});

function parseDeliberation(text: string, domain: string, initialAnalysis: z.infer<typeof analysisOutput>) {
  const sections = text.split(/\n(?=\*\*|#{1,3}\s)/);
  const agreements: string[] = [];
  const counterArguments: string[] = [];
  const revisedRecommendations: string[] = [];
  let revisedImpactRating = initialAnalysis.impactRating;

  for (const section of sections) {
    const lower = section.toLowerCase();
    const bullets = section
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[\s\-*]+/, '').trim())
      .filter(Boolean);

    if (lower.includes('agree') || lower.includes('concur') || lower.includes('support')) {
      agreements.push(...bullets);
    } else if (lower.includes('counter') || lower.includes('disagree') || lower.includes('challenge') || lower.includes('concern') || lower.includes('rebut')) {
      counterArguments.push(...bullets);
    } else if (lower.includes('revised') || lower.includes('recommend') || lower.includes('amend')) {
      revisedRecommendations.push(...bullets);
    }

    const ratingMatch = section.match(/\b(HIGHLY POSITIVE|HIGHLY NEGATIVE|POSITIVE|NEGATIVE|NEUTRAL)\b/);
    if (ratingMatch) {
      revisedImpactRating = ratingMatch[1];
    }
  }

  return {
    domain,
    initialAnalysis,
    agreements: agreements.length > 0 ? agreements : ['No specific agreements noted'],
    counterArguments: counterArguments.length > 0 ? counterArguments : ['No counter-arguments raised'],
    revisedRecommendations: revisedRecommendations.length > 0 ? revisedRecommendations : ['See initial recommendations'],
    revisedImpactRating,
  };
}

function createDeliberationStep(agentId: string, committeeName: string) {
  return createStep({
    id: `${agentId}-deliberation`,
    description: `${committeeName} reviews other committees' findings and responds`,
    inputSchema: allAnalysesSchema,
    outputSchema: deliberationOutput,
    execute: async ({ inputData, mastra }) => {
      const agent = mastra?.getAgent(agentId);
      if (!agent) throw new Error(`Agent ${agentId} not found`);

      const allAnalyses = Object.values(inputData);
      const ownAnalysis = allAnalyses.find(a => a.domain === committeeName);
      const otherAnalyses = allAnalyses.filter(a => a.domain !== committeeName);

      const otherSummaries = otherAnalyses
        .map(
          a => `### ${a.domain} (Rating: ${a.impactRating})
**Summary:** ${a.summary}
**Benefits:** ${a.benefits.map(b => `- ${b}`).join('\n')}
**Risks:** ${a.risks.map(r => `- ${r}`).join('\n')}
**Recommendations:** ${a.recommendations.map(r => `- ${r}`).join('\n')}`,
        )
        .join('\n\n');

      const { text } = await agent.generate([
        {
          role: 'user',
          content: `You previously analyzed this legislation and provided your assessment. Now the other five expert committees have also completed their analyses.

## Your Initial Assessment (${committeeName})
**Impact Rating:** ${ownAnalysis?.impactRating || 'N/A'}
**Summary:** ${ownAnalysis?.summary || 'N/A'}

## Other Committees' Findings

${otherSummaries}

---

Now, as the ${committeeName} expert, please respond to the other committees' findings. Your deliberation MUST include:

1. **Agreements**: Points from other committees that reinforce or support your analysis (bullet points, cite which committee)
2. **Counter-Arguments**: Points you disagree with or want to challenge from other committees, with your reasoning (bullet points, cite which committee)
3. **Revised Recommendations**: Updated recommendations considering the cross-committee discussion — have any of your initial positions changed? (bullet points)
4. **Revised Impact Rating**: After seeing all perspectives, rate the overall impact on your domain as HIGHLY POSITIVE, POSITIVE, NEUTRAL, NEGATIVE, or HIGHLY NEGATIVE (this may or may not differ from your initial rating)

Be specific and reference other committees by name when agreeing or disagreeing.`,
        },
      ]);

      return parseDeliberation(text, committeeName, ownAnalysis!);
    },
  });
}

const fiscalReview = createCommitteeStep('fiscalAnalyst', 'Fiscal & Economic Policy');
const healthReview = createCommitteeStep('healthAnalyst', 'Public Health & Human Services');
const defenseReview = createCommitteeStep('defenseAnalyst', 'National Security & Defense');
const technologyReview = createCommitteeStep('technologyAnalyst', 'Technology & Innovation');
const civilRightsReview = createCommitteeStep('civilRightsAnalyst', 'Civil Rights & Social Impact');
const environmentalReview = createCommitteeStep('environmentalAnalyst', 'Environmental & Energy Policy');

const fiscalDeliberation = createDeliberationStep('fiscalAnalyst', 'Fiscal & Economic Policy');
const healthDeliberation = createDeliberationStep('healthAnalyst', 'Public Health & Human Services');
const defenseDeliberation = createDeliberationStep('defenseAnalyst', 'National Security & Defense');
const technologyDeliberation = createDeliberationStep('technologyAnalyst', 'Technology & Innovation');
const civilRightsDeliberation = createDeliberationStep('civilRightsAnalyst', 'Civil Rights & Social Impact');
const environmentalDeliberation = createDeliberationStep('environmentalAnalyst', 'Environmental & Energy Policy');

function formatCommitteeSummaries(committees: z.infer<typeof analysisOutput>[]) {
  return committees
    .map(
      c => `## ${c.domain}
**Impact Rating:** ${c.impactRating}

**Summary:** ${c.summary}

**Benefits:**
${c.benefits.map(b => `- ${b}`).join('\n')}

**Risks & Concerns:**
${c.risks.map(r => `- ${r}`).join('\n')}

**Recommendations:**
${c.recommendations.map(r => `- ${r}`).join('\n')}`,
    )
    .join('\n\n---\n\n');
}

const synthesizeReports = createStep({
  id: 'synthesize-reports',
  description: 'CRS synthesizer compiles all committee findings into a unified legislative report',
  inputSchema: allAnalysesSchema,
  outputSchema: z.object({
    report: z.string(),
    committees: z.array(analysisOutput),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('synthesizer');
    if (!agent) throw new Error('Synthesizer agent not found');

    const committees = Object.values(inputData);

    const { text } = await agent.generate([
      {
        role: 'user',
        content: `You have received analyses from six expert policy committees reviewing the same piece of legislation. Please synthesize these into a comprehensive legislative report.

# Committee Reports

${formatCommitteeSummaries(committees)}

Please produce your unified CRS-style legislative analysis report.`,
      },
    ]);

    return { report: text, committees };
  },
});

const synthesizeWithDeliberation = createStep({
  id: 'synthesize-with-deliberation',
  description: 'CRS synthesizer compiles all committee findings and deliberation into a unified legislative report',
  inputSchema: z.object({
    'fiscalAnalyst-deliberation': deliberationOutput,
    'healthAnalyst-deliberation': deliberationOutput,
    'defenseAnalyst-deliberation': deliberationOutput,
    'technologyAnalyst-deliberation': deliberationOutput,
    'civilRightsAnalyst-deliberation': deliberationOutput,
    'environmentalAnalyst-deliberation': deliberationOutput,
  }),
  outputSchema: z.object({
    report: z.string(),
    committees: z.array(analysisOutput),
    deliberations: z.array(deliberationOutput),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra?.getAgent('synthesizer');
    if (!agent) throw new Error('Synthesizer agent not found');

    const deliberations = Object.values(inputData);
    const committees = deliberations.map(d => d.initialAnalysis);

    const deliberationSummaries = deliberations
      .map(
        d => `## ${d.domain} — Deliberation Response
**Revised Impact Rating:** ${d.revisedImpactRating}

**Agreements with Other Committees:**
${d.agreements.map(a => `- ${a}`).join('\n')}

**Counter-Arguments:**
${d.counterArguments.map(c => `- ${c}`).join('\n')}

**Revised Recommendations:**
${d.revisedRecommendations.map(r => `- ${r}`).join('\n')}`,
      )
      .join('\n\n---\n\n');

    const { text } = await agent.generate([
      {
        role: 'user',
        content: `You have received analyses from six expert policy committees reviewing the same piece of legislation, followed by a deliberation round where each committee reviewed the others' findings and responded with agreements, counter-arguments, and revised positions.

# Initial Committee Reports

${formatCommitteeSummaries(committees)}

---

# Deliberation Round — Committee Responses

${deliberationSummaries}

---

Please produce your unified CRS-style legislative analysis report. Pay special attention to:
- Where committees changed their positions after deliberation
- Counter-arguments that were raised and whether they were addressed
- Areas where committees reached consensus vs. persistent disagreements
- How the deliberation round refined or changed the overall assessment`,
      },
    ]);

    return { report: text, committees, deliberations };
  },
});

const parallelReviews = [fiscalReview, healthReview, defenseReview, technologyReview, civilRightsReview, environmentalReview] as const;
const parallelDeliberations = [fiscalDeliberation, healthDeliberation, defenseDeliberation, technologyDeliberation, civilRightsDeliberation, environmentalDeliberation] as const;

export const legislativeCouncilWorkflow = createWorkflow({
  id: 'legislative-council',
  description:
    'Council pattern: six expert committees analyze legislation in parallel, then a synthesizer produces a unified report',
  inputSchema: legislationInput,
  outputSchema: z.object({
    report: z.string(),
    committees: z.array(analysisOutput),
  }),
})
  .parallel([...parallelReviews])
  .then(synthesizeReports)
  .commit();

export const legislativeCouncilWithDeliberationWorkflow = createWorkflow({
  id: 'legislative-council-with-deliberation',
  description:
    'Council pattern: six expert committees analyze legislation in parallel, deliberate on each others findings, then a synthesizer produces a unified report',
  inputSchema: legislationInput,
  outputSchema: z.object({
    report: z.string(),
    committees: z.array(analysisOutput),
    deliberations: z.array(deliberationOutput),
  }),
})
  .parallel([...parallelReviews])
  .parallel([...parallelDeliberations])
  .then(synthesizeWithDeliberation)
  .commit();
