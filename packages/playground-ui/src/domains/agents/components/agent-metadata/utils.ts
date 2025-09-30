/**
 * Removes common provider suffixes like .chat, .x, .messages, .completion
 * from provider IDs to get the clean provider name.
 * 
 * @example
 * cleanProviderId('cerebras.chat') // returns 'cerebras'
 * cleanProviderId('xai.x') // returns 'xai'
 * cleanProviderId('anthropic.messages') // returns 'anthropic'
 * cleanProviderId('openai') // returns 'openai'
 */
export const cleanProviderId = (providerId: string): string => {
  return providerId.replace(/\.(chat|x|messages|completion)$/i, '');
};
