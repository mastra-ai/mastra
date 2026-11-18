import type { Scenario, ScenarioStep } from '../scenario.js';
import { errorMessage, makeStep, probeTool, requireTools, runReadBatch } from '../scenario.js';

/**
 * ElevenLabs scenario. Nothing here spends credits unless
 * `MASTRA_SMOKE_ELEVENLABS_ALLOW_SPEAK=1` or `MASTRA_SMOKE_ELEVENLABS_ALLOW_MUSIC=1`.
 *
 * - Text-to-speech and speech-to-text bill per character and per minute. With
 *   ALLOW_SPEAK, the scenario speaks one short sentence, transcribes the audio
 *   back, checks the words survived, and deletes the history item the speech
 *   created. Without it, both tools are probed with a synthetic voice and an
 *   unknown model, which ElevenLabs rejects before doing any work.
 * - Voice cloning: with ALLOW_SPEAK, the spoken sentence is cloned into a
 *   `<runId>` voice, which is then deleted. Without it, cloning is tried with a
 *   sample that isn't audio (any voice that still gets created is deleted) and
 *   the voice delete is probed.
 * - Music: composition plans are free, so one is always drafted. Composing
 *   bills per second; with ALLOW_MUSIC the scenario composes a 3-second
 *   instrumental from that plan, otherwise compose is probed with an unknown
 *   model.
 * - Conversational AI agents get a real create → get → update → delete
 *   lifecycle (an agent costs nothing until it takes a call).
 * - History items, dubbing projects, conversations, and knowledge-base
 *   documents have no create tool, so their getters run against the first
 *   listed record when one exists, and their deletes are probed with a
 *   synthetic id — the scenario never deletes a customer's record.
 * - Voice settings are read and written back unchanged on a voice the account
 *   owns; with no owned voice the edit is probed.
 * - Pronunciation dictionaries have no create tool and every rule change adds
 *   a version to the dictionary. Set `MASTRA_SMOKE_ELEVENLABS_DICTIONARY_ID`
 *   to a test dictionary to add and then remove a `<runId>` rule for real;
 *   otherwise the rule tools are probed.
 */

const SYNTHETIC_ID = 'mastra-smoke-nonexistent';

export const elevenlabsScenario: Scenario = {
  integrationId: 'elevenlabs',
  summary: 'agent CRUD, voice settings round-trip, account/library reads, record getters + probed deletes',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['elevenlabs_create_agent', 'elevenlabs_delete_agent']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    /** Runs one tool call as a step; returns the output, or undefined on failure/skip. */
    async function step<T>(name: string, toolId: string, input: unknown, detail?: (out: T) => string | undefined) {
      if (!tools[toolId]) {
        steps.push(makeStep(name, toolId, 'skip', 'tool not in project toolset'));
        return undefined;
      }
      try {
        const out = await call<T>(toolId, input);
        steps.push(makeStep(name, toolId, 'pass', detail?.(out)));
        return out;
      } catch (error) {
        steps.push(makeStep(name, toolId, 'fail', errorMessage(error)));
        return undefined;
      }
    }

    /** Gets the first listed record for real, or probes the getter with a synthetic id. */
    async function getFirstOrProbe(name: string, toolId: string, idKey: string, id: string | undefined) {
      if (id) await step(name, toolId, { [idKey]: id });
      else steps.push(await probeTool(call, tools, `${name} (probe)`, toolId, { [idKey]: SYNTHETIC_ID }));
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['elevenlabs_get_user', {}],
          ['elevenlabs_get_user_subscription', {}],
          ['elevenlabs_list_models', {}],
          ['elevenlabs_get_default_voice_settings', {}],
        ],
        tools,
      )),
    );

    // Voices: read, then write the owned voice's settings back unchanged.
    const voices = await step<{ voices: Array<{ voice_id: string; is_owner?: boolean }> }>(
      'list voices',
      'elevenlabs_list_voices',
      {},
      out => `${out.voices.length} voices`,
    );
    const firstVoice = voices?.voices[0]?.voice_id;
    await getFirstOrProbe('get voice', 'elevenlabs_get_voice', 'voice_id', firstVoice);
    await getFirstOrProbe('get voice settings', 'elevenlabs_get_voice_settings', 'voice_id', firstVoice);
    const spoken = await runAudio(firstVoice);
    const spokenHistoryItem = spoken?.historyItemId;
    await runVoiceClone(spoken?.audio);
    await runMusic();
    const ownedVoice = voices?.voices.find(v => v.is_owner)?.voice_id;
    if (ownedVoice && tools['elevenlabs_get_voice_settings']) {
      try {
        const settings = await call<Record<string, unknown>>('elevenlabs_get_voice_settings', { voice_id: ownedVoice });
        await step('edit voice settings (unchanged)', 'elevenlabs_edit_voice_settings', {
          voice_id: ownedVoice,
          ...settings,
        });
      } catch (error) {
        steps.push(makeStep('edit voice settings', 'elevenlabs_edit_voice_settings', 'fail', errorMessage(error)));
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'edit voice settings (probe)', 'elevenlabs_edit_voice_settings', {
          voice_id: SYNTHETIC_ID,
          stability: 0.5,
        }),
      );
    }

    // Records with no create tool: list, get the first, probe the delete.
    const history = await step<{ items: Array<{ history_item_id: string }> }>(
      'list history',
      'elevenlabs_list_history',
      {
        page_size: 5,
      },
    );
    await getFirstOrProbe(
      'get history item',
      'elevenlabs_get_history_item',
      'history_item_id',
      history?.items[0]?.history_item_id,
    );
    if (spokenHistoryItem) {
      try {
        await call('elevenlabs_delete_history_item', { history_item_id: spokenHistoryItem });
        steps.push(makeStep('delete spoken history item', 'elevenlabs_delete_history_item', 'pass'));
      } catch (error) {
        log.error(`elevenlabs: leaked history item ${spokenHistoryItem} (${runId})`, errorMessage(error));
        steps.push(
          makeStep('delete spoken history item', 'elevenlabs_delete_history_item', 'fail', errorMessage(error)),
        );
      }
    } else {
      steps.push(
        await probeTool(call, tools, 'delete history item (probe)', 'elevenlabs_delete_history_item', {
          history_item_id: SYNTHETIC_ID,
        }),
      );
    }

    const dubs = await step<{ dubs: Array<{ dubbing_id?: string }> }>(
      'list dubbing projects',
      'elevenlabs_list_dubbing_projects',
      { page_size: 5 },
    );
    await getFirstOrProbe(
      'get dubbing project',
      'elevenlabs_get_dubbing_project',
      'dubbing_id',
      dubs?.dubs[0]?.dubbing_id,
    );
    steps.push(
      await probeTool(call, tools, 'delete dubbing project (probe)', 'elevenlabs_delete_dubbing_project', {
        dubbing_id: SYNTHETIC_ID,
      }),
    );

    const docs = await step<{ items: Array<{ id: string }> }>('list knowledge base', 'elevenlabs_list_knowledge_base', {
      page_size: 5,
    });
    await getFirstOrProbe(
      'get knowledge base document',
      'elevenlabs_get_knowledge_base_document',
      'documentation_id',
      docs?.items[0]?.id,
    );
    steps.push(
      await probeTool(
        call,
        tools,
        'delete knowledge base document (probe)',
        'elevenlabs_delete_knowledge_base_document',
        {
          documentation_id: SYNTHETIC_ID,
        },
      ),
    );

    const conversations = await step<{ items: Array<{ conversation_id: string }> }>(
      'list conversations',
      'elevenlabs_list_conversations',
      { page_size: 5 },
    );
    await getFirstOrProbe(
      'get conversation',
      'elevenlabs_get_conversation',
      'conversation_id',
      conversations?.items[0]?.conversation_id,
    );
    steps.push(
      await probeTool(call, tools, 'delete conversation (probe)', 'elevenlabs_delete_conversation', {
        conversation_id: SYNTHETIC_ID,
      }),
    );

    await runDictionary();

    // Conversational AI agent lifecycle.
    const agent = await step<{ agent_id: string }>(
      'create agent',
      'elevenlabs_create_agent',
      {
        name: runId,
        tags: [runId],
        conversation_config: { agent: { first_message: 'Automated @mastra/connect smoke test. Safe to delete.' } },
      },
      out => out.agent_id,
    );
    if (!agent) return steps;
    try {
      await step('get agent', 'elevenlabs_get_agent', { agent_id: agent.agent_id });
      await step('update agent', 'elevenlabs_update_agent', { agent_id: agent.agent_id, name: `${runId} (renamed)` });
      await step<{ items: Array<{ agent_id: string }> }>(
        'list agents',
        'elevenlabs_list_agents',
        { search: runId, page_size: 5 },
        out =>
          out.items.some(a => a.agent_id === agent.agent_id) ? 'found smoke agent' : 'smoke agent not listed yet',
      );
    } finally {
      try {
        await call('elevenlabs_delete_agent', { agent_id: agent.agent_id });
        steps.push(makeStep('delete agent', 'elevenlabs_delete_agent', 'pass'));
      } catch (error) {
        log.error(`elevenlabs: leaked agent ${agent.agent_id} (${runId}); delete it manually`, errorMessage(error));
        steps.push(makeStep('delete agent', 'elevenlabs_delete_agent', 'fail', errorMessage(error)));
      }
    }
    return steps;

    /** Speaks a sentence and transcribes it back; returns the audio and the history item it created. */
    async function runAudio(
      voiceId: string | undefined,
    ): Promise<{ audio: string; historyItemId?: string } | undefined> {
      if (process.env.MASTRA_SMOKE_ELEVENLABS_ALLOW_SPEAK !== '1' || !voiceId) {
        steps.push(
          await probeTool(call, tools, 'text to speech (probe)', 'elevenlabs_text_to_speech', {
            voice_id: SYNTHETIC_ID,
            text: 'Mastra smoke test.',
          }),
        );
        steps.push(
          await probeTool(call, tools, 'speech to text (probe)', 'elevenlabs_speech_to_text', {
            audio: Buffer.from('ID3').toString('base64'),
            model_id: 'mastra_smoke_nonexistent',
          }),
        );
        return undefined;
      }

      const speech = await step<{ audio: string; size_bytes: number; history_item_id?: string }>(
        'text to speech',
        'elevenlabs_text_to_speech',
        { voice_id: voiceId, text: 'Mastra smoke test.', output_format: 'mp3_22050_32' },
        out => `${out.size_bytes} bytes${out.history_item_id ? '' : ', no history item id'}`,
      );
      if (!speech) {
        steps.push(makeStep('speech to text', 'elevenlabs_speech_to_text', 'skip', 'no audio was generated'));
        return undefined;
      }
      try {
        const transcript = await call<{ text: string }>('elevenlabs_speech_to_text', {
          audio: speech.audio,
          language_code: 'en',
          tag_audio_events: false,
        });
        const heard = /smoke/i.test(transcript.text);
        steps.push(
          makeStep(
            'speech to text (round trip)',
            'elevenlabs_speech_to_text',
            heard ? 'pass' : 'fail',
            `heard "${transcript.text}"`,
          ),
        );
      } catch (error) {
        steps.push(makeStep('speech to text (round trip)', 'elevenlabs_speech_to_text', 'fail', errorMessage(error)));
      }
      return { audio: speech.audio, historyItemId: speech.history_item_id };
    }

    /** Clones the spoken sample into a run-tagged voice and deletes it again. */
    async function runVoiceClone(sample: string | undefined) {
      if (!tools['elevenlabs_clone_voice']) {
        steps.push(makeStep('clone voice', 'elevenlabs_clone_voice', 'skip', 'tool not in project toolset'));
        return;
      }
      let voiceId: string | undefined;
      try {
        // Without a real sample, send bytes that aren't audio; ElevenLabs should refuse them.
        const out = await call<{ voice_id: string }>('elevenlabs_clone_voice', {
          name: runId,
          samples: [sample ?? Buffer.from('not audio').toString('base64')],
          description: 'Automated @mastra/connect smoke test. Safe to delete.',
        });
        voiceId = out.voice_id;
        steps.push(makeStep(sample ? 'clone voice' : 'clone voice (probe)', 'elevenlabs_clone_voice', 'pass', voiceId));
      } catch (error) {
        const msg = errorMessage(error);
        const expected = !sample && /status=(400|422)/.test(msg);
        steps.push(
          makeStep(
            sample ? 'clone voice' : 'clone voice (probe)',
            'elevenlabs_clone_voice',
            expected ? 'pass' : 'fail',
            expected ? `expected error (endpoint exercised): ${msg.slice(0, 120)}` : msg,
          ),
        );
      }

      if (!voiceId) {
        steps.push(
          await probeTool(call, tools, 'delete voice (probe)', 'elevenlabs_delete_voice', { voice_id: SYNTHETIC_ID }),
        );
        return;
      }
      try {
        await call('elevenlabs_delete_voice', { voice_id: voiceId });
        steps.push(makeStep('delete cloned voice', 'elevenlabs_delete_voice', 'pass'));
      } catch (error) {
        log.error(`elevenlabs: leaked cloned voice ${voiceId} (${runId}); delete it manually`, errorMessage(error));
        steps.push(makeStep('delete cloned voice', 'elevenlabs_delete_voice', 'fail', errorMessage(error)));
      }
    }

    /** Drafts a free composition plan, then composes it only when music is allowed. */
    async function runMusic() {
      const plan = await step<{ composition_plan: Record<string, unknown> }>(
        'create composition plan',
        'elevenlabs_create_composition_plan',
        { prompt: 'A calm three-second piano chord, instrumental.', music_length_ms: 3_000 },
      );
      if (process.env.MASTRA_SMOKE_ELEVENLABS_ALLOW_MUSIC !== '1' || !plan) {
        steps.push(
          await probeTool(call, tools, 'compose music (probe)', 'elevenlabs_compose_music', {
            prompt: 'A calm piano chord.',
            music_length_ms: 3_000,
            model_id: 'music_v999',
          }),
        );
        return;
      }
      await step<{ size_bytes: number; media_type: string }>(
        'compose music',
        'elevenlabs_compose_music',
        { composition_plan: plan.composition_plan, output_format: 'mp3_22050_32' },
        out => `${out.size_bytes} bytes of ${out.media_type}`,
      );
    }

    async function runDictionary() {
      const listed = await step<{ pronunciation_dictionaries: Array<{ id: string }> }>(
        'list pronunciation dictionaries',
        'elevenlabs_list_pronunciation_dictionaries',
        {},
      );
      const testDictionary = process.env.MASTRA_SMOKE_ELEVENLABS_DICTIONARY_ID?.trim();
      await getFirstOrProbe(
        'get pronunciation dictionary',
        'elevenlabs_get_pronunciation_dictionary',
        'pronunciation_dictionary_id',
        testDictionary || listed?.pronunciation_dictionaries[0]?.id,
      );

      if (!testDictionary) {
        steps.push(
          await probeTool(
            call,
            tools,
            'add dictionary rules (probe)',
            'elevenlabs_add_pronunciation_dictionary_rules',
            {
              pronunciation_dictionary_id: SYNTHETIC_ID,
              rules: [{ type: 'alias', string_to_replace: runId, alias: 'smoke' }],
            },
          ),
        );
        steps.push(
          await probeTool(
            call,
            tools,
            'remove dictionary rules (probe)',
            'elevenlabs_remove_pronunciation_dictionary_rules',
            { pronunciation_dictionary_id: SYNTHETIC_ID, rule_strings: [runId] },
          ),
        );
        return;
      }

      const added = await step('add dictionary rule', 'elevenlabs_add_pronunciation_dictionary_rules', {
        pronunciation_dictionary_id: testDictionary,
        rules: [{ type: 'alias', string_to_replace: runId, alias: 'smoke' }],
      });
      if (!added) {
        steps.push(
          makeStep(
            'remove dictionary rule',
            'elevenlabs_remove_pronunciation_dictionary_rules',
            'skip',
            'rule was not added',
          ),
        );
        return;
      }
      try {
        await call('elevenlabs_remove_pronunciation_dictionary_rules', {
          pronunciation_dictionary_id: testDictionary,
          rule_strings: [runId],
        });
        steps.push(makeStep('remove dictionary rule', 'elevenlabs_remove_pronunciation_dictionary_rules', 'pass'));
      } catch (error) {
        log.error(`elevenlabs: leaked rule "${runId}" in dictionary ${testDictionary}`, errorMessage(error));
        steps.push(
          makeStep(
            'remove dictionary rule',
            'elevenlabs_remove_pronunciation_dictionary_rules',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }
  },
};
