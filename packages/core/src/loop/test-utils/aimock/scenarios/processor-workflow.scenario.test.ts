import { it, expect } from 'vitest';
import type { ProcessInputArgs, Processor } from '../../../../processors';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../../../../processors/step-schema';
import { createStep, createWorkflow } from '../../../../workflows';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Workflows as processors: a support agent can package its input/output processors as a
 * workflow (createWorkflow + createStep(processor)). The agent must run every step of that
 * workflow in order, send the transformed prompt to the model, apply output rewrites to the
 * reply, and surface any abort() raised inside a workflow step as a normal tripwire.
 *
 * If this breaks, workflow-packaged guardrails silently stop blocking, or redaction /
 * tagging steps never reach the model or the caller.
 */

const rewriteUserText = (id: string, rewrite: (text: string) => string) =>
  ({
    id,
    processInput: async ({ messages }: ProcessInputArgs) =>
      messages.map(msg => ({
        ...msg,
        content: {
          ...msg.content,
          parts: msg.content.parts.map(part => (part.type === 'text' ? { ...part, text: rewrite(part.text) } : part)),
        },
      })),
  }) satisfies Processor;

function userTexts(body: unknown): string[] {
  const messages = ((body as { messages?: { role: string; content: unknown }[] })?.messages ?? []).filter(
    m => m.role === 'user',
  );
  return messages.flatMap(m =>
    typeof m.content === 'string'
      ? [m.content]
      : (m.content as { type: string; text?: string }[]).filter(p => p.type === 'text').map(p => p.text ?? ''),
  );
}

describeForAllEngines('Support agent processors packaged as workflows', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: a processor workflow built from createStep(processor) runs the step's processInput
  // and the model receives the rewritten user message.
  it('sends the prompt rewritten by an input processor workflow', async () => {
    const inputWorkflow = createWorkflow({
      id: 'ticket-tagging-workflow',
      inputSchema: ProcessorStepInputSchema,
      outputSchema: ProcessorStepOutputSchema,
    })
      .then(createStep(rewriteUserText('ticket-tagger', text => `[TICKET] ${text} [PRIORITY]`)))
      .commit();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'My order never arrived',
      inputProcessors: [inputWorkflow],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Sorry, let me check your order.' });
      },
    });

    expect(requests).toHaveLength(1);
    expect(userTexts(requests[0]!.body)).toEqual(['[TICKET] My order never arrived [PRIORITY]']);
    expect(await output.text).toBe('Sorry, let me check your order.');
  });

  // Technical: abort(reason, { retry, metadata }) inside an input workflow step surfaces as a
  // tripwire chunk with the same reason/retry/metadata, and the model is never called.
  it('blocks the turn when a step in an input processor workflow aborts', async () => {
    const blockingStep = {
      id: 'blocked-keyword-guard',
      processInput: async ({ messages, abort }) => {
        const blocked = messages.some(msg =>
          msg.content.parts.some(part => part.type === 'text' && part.text.includes('blocked')),
        );
        if (blocked) abort('Content contains blocked keywords', { retry: true, metadata: { severity: 'high' } });
        return messages;
      },
    } satisfies Processor;
    const guardWorkflow = createWorkflow({
      id: 'blocked-keyword-workflow',
      inputSchema: ProcessorStepInputSchema,
      outputSchema: ProcessorStepOutputSchema,
    })
      .then(createStep(blockingStep))
      .commit();

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'This message contains blocked content',
      inputProcessors: [guardWorkflow],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The model should never run.' });
      },
    });

    const tripwire = chunks!.find(c => c.type === 'tripwire') as { payload: Record<string, unknown> } | undefined;
    expect(tripwire?.payload).toMatchObject({
      reason: 'Content contains blocked keywords',
      retry: true,
      metadata: { severity: 'high' },
    });
    expect(await output.text).toBe('');
    expect(requests).toHaveLength(0);
  });

  // Technical: processOutputResult inside an output workflow step rewrites the assistant message
  // in the final response messages. COR-1414: durable, evented and inngest save the rewrite but return
  // the raw model text in response.messages, so the final assertion is pinned as it.fails there.
  const wrapped = engine === 'durable' || engine === 'evented' || engine === 'inngest';
  (wrapped ? it.fails : it)('applies an output processor workflow to the final assistant message', async () => {
    const tagReply = {
      id: 'reply-tagger',
      processOutputResult: async ({ messages }) =>
        messages.map(msg =>
          msg.role === 'assistant'
            ? {
                ...msg,
                content: {
                  ...msg.content,
                  parts: msg.content.parts.map(part =>
                    part.type === 'text' ? { ...part, text: `${part.text} [REVIEWED]` } : part,
                  ),
                },
              }
            : msg,
        ),
    } satisfies Processor;
    const outputWorkflow = createWorkflow({
      id: 'reply-review-workflow',
      inputSchema: ProcessorStepInputSchema,
      outputSchema: ProcessorStepOutputSchema,
    })
      .then(createStep(tagReply))
      .commit();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my parcel?',
      outputProcessors: [outputWorkflow],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'It ships tomorrow.' });
      },
    });

    expect(requests).toHaveLength(1);
    const assistantTexts = (await output.response)
      .messages!.filter(m => m.role === 'assistant')
      .flatMap(m =>
        typeof m.content === 'string'
          ? [m.content]
          : (m.content as { type: string; text?: string }[]).filter(p => p.type === 'text').map(p => p.text),
      );
    expect(assistantTexts).toEqual(['It ships tomorrow. [REVIEWED]']);
  });

  // Technical: abort(reason, { retry: false }) inside an output workflow step sets
  // output.tripwire with that reason and finishes the run as a tripwire.
  it('blocks the reply when a step in an output processor workflow aborts', async () => {
    const replyGuard = {
      id: 'reply-guard',
      processOutputResult: async ({ messages, abort }) => {
        const flagged = messages.some(
          msg =>
            msg.role === 'assistant' &&
            msg.content.parts.some(part => part.type === 'text' && part.text.includes('inappropriate')),
        );
        if (flagged) abort('Output contains inappropriate content', { retry: false });
        return messages;
      },
    } satisfies Processor;
    const guardWorkflow = createWorkflow({
      id: 'reply-guard-workflow',
      inputSchema: ProcessorStepInputSchema,
      outputSchema: ProcessorStepOutputSchema,
    })
      .then(createStep(replyGuard))
      .commit();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tell me a joke',
      outputProcessors: [guardWorkflow],
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'This is inappropriate content' });
      },
    });

    expect(requests).toHaveLength(1);
    await output.getFullOutput();
    expect(output.tripwire?.reason).toBe('Output contains inappropriate content');
  });
});
