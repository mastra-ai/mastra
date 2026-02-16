/**
 * Mastra Observational Memory extension for pi-coding-agent.
 *
 * Drop this file into .pi/extensions/ and OM will automatically:
 * - Compress long conversations into structured observations
 * - Inject observations into the system prompt
 * - Register `memory_status` and `memory_observations` tools
 *
 * Config is read from .pi/mastra.json (optional — defaults are sensible).
 */
import { mastraOMExtension } from '@mastra/pi/extension';
import type { ExtensionFactory } from '@mariozechner/pi-coding-agent';

const extension: ExtensionFactory = async (api) => {
    console.log('[mastra-om] Extension loaded — Observational Memory active');
    return mastraOMExtension(api);
};

export default extension;
