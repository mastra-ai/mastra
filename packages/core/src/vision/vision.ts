import { MastraBase } from '../base';

interface BuiltInModelConfig {
  name: string;
  apiKey?: string;
}

export interface VisionConfig {
  visionModel?: BuiltInModelConfig;
}

export abstract class MastraVision extends MastraBase {
  protected visionModel?: BuiltInModelConfig;

  constructor({ visionModel }: VisionConfig = {}) {
    super({
      name: visionModel?.name,
    });
    this.visionModel = visionModel;
  }

  abstract analyze(
    videoStream: NodeJS.ReadableStream | unknown,
    input: string,
    options?: unknown,
  ): Promise<string | NodeJS.ReadableStream | void>;
}
