import { randomUUID } from 'node:crypto';
import type { HarnessConfig } from './harness.types';
import type { HarnessMode } from './mode';
import { Session } from './session';
import type { SessionRecord } from './session.types';

export class Harness<MODES extends HarnessMode[]> {
  readonly #defaultMode: string;
  readonly #modesById = new Map<string, MODES[number]>();

  constructor(config: HarnessConfig<MODES>) {
    if (!config.modes.length) {
      throw new Error('The harness needs modes to operate.');
    }

    this.#defaultMode = config.defaultModeId ?? config.modes[0]!.id;

    const modes = config.modes ?? [];
    for (const mode of modes) {
      if (this.#modesById.has(mode.id)) {
        throw new Error(`Duplicate mode id "${mode.id}" found when creating the Harness`);
      }

      if (mode.tools && mode.additionalTools) {
        throw new Error(`Mode "${mode.id} cannot set both "tools" and "additionalTools" - choose replace OR augment`);
      }
      this.#modesById.set(mode.id, mode);
    }
  }

  /**
   * Look up a single mode by id. Returns `undefined` if no mode with that id
   * is registered. For the throwing variant used during request resolution,
   * see the internal `_getMode` helper.
   */
  getMode(modeId: string): HarnessMode | undefined {
    return this.#modesById.get(modeId);
  }

  async session(opts: /*{ sessionId: string } |*/ {
    sessionId?: never;
    threadId: string;
    resourceId: string;
  }): Promise<Session> {
    // if sessoinId, retrieve session from storage
    let sessionRecord: SessionRecord | null = null;
    if (sessionRecord) {
      const session = new Session(sessionRecord);
      const mode = this.#modesById.get(sessionRecord.modeId) ?? this.#modesById.get(this.#defaultMode);
      session.setMode(this.#modesById.get(mode)!);
      session.setModelId(sessionRecord.modelId);
    }

    return new Session({
      id: `sess-${randomUUID}`,
      threadId: opts.threadId,
      resourceId: opts.resourceId,
      mode: this.#modesById.get(this.#defaultMode)!,
      model: 'zai-coding-plan/glm-5-turbo',
      createdAt: new Date(),
    });
  }
}
