import { z } from 'zod';

import { modelIdSchema } from '../domain/identifiers.js';
import { RegistryConfigurationError } from './provider-registry.js';

export const modelDescriptorSchema = z
  .object({
    id: modelIdSchema,
    provider: z.string().min(1),
    runtimeId: z.string().min(1),
    multimodal: z.boolean(),
    structuredOutput: z.boolean(),
    externalNetwork: z.boolean(),
  })
  .strict();

export type ModelDescriptor = z.infer<typeof modelDescriptorSchema>;

export class ModelRegistry {
  readonly #models = new Map<string, ModelDescriptor>();

  register(rawDescriptor: ModelDescriptor): this {
    const descriptor = modelDescriptorSchema.parse(rawDescriptor);
    if (this.#models.has(descriptor.id)) {
      throw new RegistryConfigurationError('DUPLICATE_PROVIDER', `Model ${descriptor.id} is registered more than once`);
    }
    this.#models.set(descriptor.id, Object.freeze(descriptor));
    return this;
  }

  resolve(id: string): ModelDescriptor {
    const model = this.#models.get(id);
    if (model === undefined) {
      throw new RegistryConfigurationError('UNKNOWN_PROVIDER', `Unknown model: ${id}`);
    }
    if (!model.multimodal || !model.structuredOutput) {
      throw new RegistryConfigurationError(
        'UNAVAILABLE_CAPABILITY',
        `Model ${id} lacks required extraction capabilities`,
      );
    }
    return model;
  }
}
