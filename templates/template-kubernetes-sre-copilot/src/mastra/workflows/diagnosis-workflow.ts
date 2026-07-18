import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { callTool } from '../mcp/tools';
import { loadSkill } from '../lib/skills';
import { podIdentifierSchema, podContextSchema, classifiedPodSchema, diagnosisOutputSchema } from '../lib/schemas';
import type { FailureType } from '../lib/schemas';

/**
 * Fixed diagnostic workflow: fetch the Pod, classify which of the 4 v1 failure patterns it
 * matches, then run exactly the checklist for that pattern (see the matching workspace SKILL.md)
 * and return a structured, evidence-backed diagnosis.
 *
 *   get pod -> classify -> [branch: crashloop | imagepull | oomkilled | pvc-pending] -> report
 */

// ---------------------------------------------------------------------------
// Step 1: fetch the Pod
// ---------------------------------------------------------------------------

const fetchPod = createStep({
  id: 'fetch-pod',
  description: 'Fetch the Pod from the cluster via the read-only kubernetes-mcp-server tools',
  inputSchema: podIdentifierSchema,
  outputSchema: podContextSchema,
  execute: async ({ inputData }) => {
    const { namespace, podName, context } = inputData;
    const result = await callTool('pods_get', { name: podName, namespace, context });
    return { namespace, podName, context, podJson: JSON.stringify(result) };
  },
});

// ---------------------------------------------------------------------------
// Step 2: classify the failure type from the Pod's status
// ---------------------------------------------------------------------------

/**
 * Ordered so a failure that could match more than one keyword resolves to the more specific
 * cause. Notably OOMKilled is checked before CrashLoopBackOff — a container OOM-killed
 * repeatedly *also* shows CrashLoopBackOff in its waiting reason, but OOMKilled is the more
 * specific and more useful classification (see workspace/skills/crashloopbackoff/SKILL.md,
 * which tells the agent to reclassify and hand off when it sees exit code 137).
 */
const CLASSIFICATION_PATTERNS: Array<{ failureType: FailureType; pattern: RegExp; reason: string }> = [
  { failureType: 'OOMKilled', pattern: /oomkilled|exit ?code.{0,20}137/i, reason: 'Pod status references OOMKilled / exit code 137' },
  {
    failureType: 'ImagePullBackOff',
    pattern: /imagepullbackoff|errimagepull/i,
    reason: 'Pod status references ImagePullBackOff / ErrImagePull',
  },
  {
    failureType: 'CrashLoopBackOff',
    pattern: /crashloopbackoff/i,
    reason: 'Pod status references CrashLoopBackOff',
  },
  {
    failureType: 'PVCPending',
    pattern: /"phase"\s*:\s*"pending"|unbound.{0,40}persistentvolumeclaim|unschedulable/i,
    reason: 'Pod is Pending with an unbound PersistentVolumeClaim / unschedulable condition',
  },
];

const classifyFailure = createStep({
  id: 'classify-failure',
  description: 'Classify the Pod status into one of the 4 failure patterns this template covers',
  inputSchema: podContextSchema,
  outputSchema: classifiedPodSchema,
  execute: async ({ inputData }) => {
    const match = CLASSIFICATION_PATTERNS.find(({ pattern }) => pattern.test(inputData.podJson));
    if (!match) {
      throw new Error(
        `Could not classify "${inputData.podName}" into one of the 4 patterns this template covers in v1 ` +
          `(CrashLoopBackOff, ImagePullBackOff, OOMKilled, Pending/PVC-stuck). Raw status: ${inputData.podJson.slice(0, 500)}`,
      );
    }
    return { ...inputData, failureType: match.failureType, classificationReason: match.reason };
  },
});

// ---------------------------------------------------------------------------
// Step 3 (branch arms): one diagnostic chain per failure type. Each arm gathers the evidence its
// SKILL.md checklist calls for, then hands it to workflowDiagnosisAgent for structured synthesis.
// ---------------------------------------------------------------------------

async function synthesize(mastra: any, failureType: FailureType, skillName: string, evidence: Record<string, unknown>) {
  const checklist = await loadSkill(skillName);
  const agent = mastra.getAgentById('workflow-diagnosis-agent');

  const prompt = `## Failure Type\n${failureType}\n\n## Runbook Checklist\n${checklist}\n\n## Gathered Evidence\n${JSON.stringify(evidence, null, 2)}\n\nSynthesize the structured diagnosis per the runbook's Classification Rule and Confidence Guidance sections.`;

  const response = await agent.generate(prompt, { structuredOutput: { schema: diagnosisOutputSchema } });

  return (
    response.object ?? {
      failureType,
      rootCause: 'Diagnosis synthesis failed to return structured output.',
      confidence: 0,
      evidenceChain: [],
      suggestedFix: 'Re-run the diagnosis; if this persists, check the workflow-diagnosis-agent model configuration.',
      riskLevel: 'low' as const,
    }
  );
}

const diagnoseCrashLoop = createStep({
  id: 'diagnose-crashloopbackoff',
  description: 'CrashLoopBackOff checklist: describe pod -> events -> previous logs -> classify',
  inputSchema: classifiedPodSchema,
  outputSchema: diagnosisOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { namespace, podName, context, podJson } = inputData;
    const [events, previousLogs] = await Promise.all([
      callTool('events_list', { namespace, fieldSelector: `involvedObject.name=${podName}`, context }),
      callTool('pods_log', { name: podName, namespace, previous: true, tail: 200, context }),
    ]);
    return synthesize(mastra, 'CrashLoopBackOff', 'crashloopbackoff', { podJson, events, previousLogs });
  },
});

const diagnoseImagePull = createStep({
  id: 'diagnose-imagepullbackoff',
  description: 'ImagePullBackOff checklist: image reference -> events -> imagePullSecret presence',
  inputSchema: classifiedPodSchema,
  outputSchema: diagnosisOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { namespace, podName, context, podJson } = inputData;
    const events = await callTool('events_list', { namespace, fieldSelector: `involvedObject.name=${podName}`, context });
    // The image reference and imagePullSecrets presence are both already in podJson from
    // fetch-pod — no separate tool call needed, the checklist's steps 1 and 3 are read directly
    // off the Pod spec already in hand.
    return synthesize(mastra, 'ImagePullBackOff', 'imagepullbackoff', { podJson, events });
  },
});

const diagnoseOomKilled = createStep({
  id: 'diagnose-oomkilled',
  description: 'OOMKilled checklist: exit code 137 check -> events -> memory limit vs usage',
  inputSchema: classifiedPodSchema,
  outputSchema: diagnosisOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { namespace, podName, context, podJson } = inputData;
    const [events, usage] = await Promise.all([
      callTool('events_list', { namespace, fieldSelector: `involvedObject.name=${podName}`, context }),
      callTool('pods_top', { namespace, name: podName, context }).catch(err => ({
        error: `metrics-server unavailable or pods_top failed: ${String(err)}`,
      })),
    ]);
    return synthesize(mastra, 'OOMKilled', 'oomkilled', { podJson, events, usage });
  },
});

/**
 * Pulls a scalar field's value out of MCP tool output text, tolerant of both YAML
 * (`field: value`, no quotes — what kubernetes-mcp-server actually returns by default) and JSON
 * (`"field": "value"`) formatting. A regex that only matched JSON-quoted syntax silently found
 * nothing against real YAML output — this is the fix for that.
 */
function extractField(text: string, field: string): string[] {
  const pattern = new RegExp(`${field}"?\\s*:\\s*"?([\\w.-]+)"?`, 'g');
  return Array.from(text.matchAll(pattern)).map(m => m[1]);
}

const diagnosePvcPending = createStep({
  id: 'diagnose-pvc-pending',
  description: 'PVC-stuck checklist: describe pod -> PVC status -> StorageClass -> node capacity',
  inputSchema: classifiedPodSchema,
  outputSchema: diagnosisOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { namespace, podName, context, podJson } = inputData;
    const events = await callTool('events_list', { namespace, fieldSelector: `involvedObject.name=${podName}`, context });

    // Pull PVC names referenced by the Pod spec so we know which PVCs/StorageClasses to check.
    const claimNames = extractField(podJson, 'claimName');

    // A missing PVC or StorageClass (e.g. one referencing a StorageClass that was never created)
    // is itself a valid, common diagnosis for this failure type — catch and surface it as
    // evidence rather than letting Promise.all reject and take down the whole step.
    const pvcs = await Promise.all(
      claimNames.map(name =>
        callTool('resources_get', { apiVersion: 'v1', kind: 'PersistentVolumeClaim', name, namespace, context }).catch(
          err => ({ error: `PersistentVolumeClaim "${name}" could not be fetched: ${String(err)}` }),
        ),
      ),
    );

    const storageClassNames = Array.from(
      new Set(pvcs.flatMap(pvc => extractField(JSON.stringify(pvc), 'storageClassName'))),
    );

    const [storageClasses, nodes] = await Promise.all([
      Promise.all(
        storageClassNames.map(name =>
          callTool('resources_get', { apiVersion: 'storage.k8s.io/v1', kind: 'StorageClass', name, context }).catch(
            err => ({ error: `StorageClass "${name}" could not be fetched: ${String(err)}` }),
          ),
        ),
      ),
      callTool('resources_list', { apiVersion: 'v1', kind: 'Node', context }).catch(err => ({
        error: `Node list could not be fetched: ${String(err)}`,
      })),
    ]);

    return synthesize(mastra, 'PVCPending', 'pvc-pending', { podJson, events, pvcs, storageClasses, nodes });
  },
});

// ---------------------------------------------------------------------------
// Step 4: normalize the branch's single populated result back into one shape
// ---------------------------------------------------------------------------

const normalizeReport = createStep({
  id: 'normalize-report',
  description: 'Pick out whichever branch arm actually ran and return it as the final diagnosis',
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: diagnosisOutputSchema,
  execute: async ({ inputData }) => {
    const results = inputData as Record<string, unknown>;
    const result =
      results['diagnose-crashloopbackoff'] ??
      results['diagnose-imagepullbackoff'] ??
      results['diagnose-oomkilled'] ??
      results['diagnose-pvc-pending'];

    return diagnosisOutputSchema.parse(result);
  },
});

export const diagnosisWorkflow = createWorkflow({
  id: 'diagnosis-workflow',
  description: 'Structured Pod failure diagnosis: fetch -> classify -> [branch by failure type] -> report',
  inputSchema: podIdentifierSchema,
  outputSchema: diagnosisOutputSchema,
})
  .then(fetchPod)
  .then(classifyFailure)
  .branch([
    [async ({ inputData }) => inputData.failureType === 'CrashLoopBackOff', diagnoseCrashLoop],
    [async ({ inputData }) => inputData.failureType === 'ImagePullBackOff', diagnoseImagePull],
    [async ({ inputData }) => inputData.failureType === 'OOMKilled', diagnoseOomKilled],
    [async ({ inputData }) => inputData.failureType === 'PVCPending', diagnosePvcPending],
  ])
  .then(normalizeReport)
  .commit();
