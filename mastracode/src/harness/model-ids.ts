export function providerFromModelId(modelId: string): string {
  return modelId.split('/')[0] ?? '';
}

export function modelNameFromModelId(modelId: string): string {
  return modelId.split('/').slice(1).join('/') || modelId;
}
