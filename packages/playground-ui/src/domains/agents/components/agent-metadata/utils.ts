/**
 * Removes any provider API suffixes like .chat, .responses, .messages, .completion
 * from provider IDs to get the clean provider name.
 *
 * @example
 * cleanProviderId('cerebras.chat') // returns 'cerebras'
 * cleanProviderId('anthropic.messages') // returns 'anthropic'
 * cleanProviderId('openai.responses') // returns 'openai'
 * cleanProviderId('openai') // returns 'openai'
 */
export const cleanProviderId = (providerId: string): string => {
  return providerId.includes(`.`) ? providerId.split(`.`)[0] : providerId;
};
