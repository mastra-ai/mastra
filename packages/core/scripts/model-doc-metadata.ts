export interface ModelPageData {
  model: string;
  imageInput: boolean;
  audioInput: boolean;
  videoInput: boolean;
  toolUsage: boolean;
  reasoning: boolean;
  contextWindow: number | null;
  maxOutput: number | null;
  inputCost: number | null;
  outputCost: number | null;
}

export function getProviderPageMetadata(providerName: string, models: ModelPageData[]) {
  const hasContextWindows = models.some(model => model.contextWindow !== null);
  const hasPricing = models.some(model => model.inputCost !== null || model.outputCost !== null);

  if (hasPricing) {
    return {
      title: `${providerName} Models: IDs, Pricing & Usage`,
      description: `Browse ${providerName} model IDs, capabilities, context windows, and pricing. Learn how to use them in TypeScript with Mastra's model router.`,
    };
  }

  if (hasContextWindows) {
    return {
      title: `${providerName} Models: IDs, Context & Usage`,
      description: `Browse ${providerName} model IDs, capabilities, and context windows. Learn how to use them in TypeScript with Mastra's model router.`,
    };
  }

  return {
    title: `${providerName} | Models`,
    description: `Browse ${providerName} model IDs and capabilities. Learn how to use them in TypeScript with Mastra's model router.`,
  };
}

export function getGatewayPageMetadata(gatewayName: string, modelCount: number) {
  return {
    title: `${gatewayName} | Models`,
    description: `Browse ${modelCount} ${gatewayName} model IDs and learn how to configure authentication and use the gateway in TypeScript with Mastra's model router.`,
  };
}

export function getModelsDevAttribution(models: ModelPageData[]): string {
  return models.length > 0
    ? `\nModel availability, capabilities, context windows, and pricing are sourced from [models.dev](https://models.dev) and may change.\n`
    : '';
}
