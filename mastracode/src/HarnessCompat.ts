import { Harness as HarnessLegacy } from '@mastra/core/harness';
import type { HarnessMode as HarnessModeLegacy } from '@mastra/core/harness';
import type { Session, HarnessMode } from '@mastra/core/harness/v1';
import { Harness } from '@mastra/core/harness/v1';

export class HarnessCompat<TState = {}> extends HarnessLegacy<TState> {
  #session: Session;
  #harnessV1: Harness;

  #getHarnessV1() {
    if (!this.#harnessV1) {
      const modes = this.listModes();
      const defaultMode = modes.find(mode => mode.default)!.id;

      this.#harnessV1 = new Harness({
        modes: modes.map((mode): HarnessMode => {
          return {
            id: mode.id,
            agentId: mode.agent.id,
            metadata: {
              color: mode.color,
            },
          };
        }),
        defaultMode,
      });
    }

    return this.#harnessV1;
  }

  async switchThread({ threadId }: { threadId: string }): Promise<void> {
    const modes = this.listModes();
    const harnessV1 = this.#getHarnessV1();

    this.#session = await harnessV1.session({
      threadId,
      resourceId: this.getResourceId(),
    });

    this.#session.setModelId(modes.find(mode => mode.id === this.#session.getMode().id).defaultModelId);

    await super.switchThread({ threadId });
  }

  getCurrentMode(): HarnessModeLegacy<TState> {
    const mode = this.#session.getMode();

    return {
      id: mode.id,
      agent: this.getMastra().getAgentById(mode.agentId),
      color: mode.metadata.color,
      default: false,
      defaultModelId: this.#session.getModelId(),
    };
  }

  /**
   * Switch to a different mode.
   * Aborts any in-progress generation and switches to the mode's default model.
   */
  async switchMode({ modeId }: { modeId: string }): Promise<void> {
    const harnessV1 = this.#getHarnessV1();

    const mode = harnessV1.getMode(modeId);
    if (!mode) {
      throw new Error(`Mode not found: ${modeId}`);
    }

    this.#session.setMode(mode);

    await super.switchMode({ modeId });
  }
}
