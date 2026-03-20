/**
 * Browser Emulation Tool
 *
 * Device and environment emulation:
 * - set_device: Emulate a device (iPhone, Pixel, etc.)
 * - set_media: Set CSS media features (dark mode, etc.)
 * - set_geolocation: Set GPS coordinates
 * - set_offline: Toggle offline mode
 * - set_headers: Set HTTP headers
 */

import { createTool } from '../../tools';
import { emulationInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserEmulationTool = createTool({
  id: 'browser_emulation',
  description: `Emulate devices and environments. Actions:
- set_device: Emulate a device (e.g., "iPhone 14", "Pixel 7")
- set_media: Set CSS media features (colorScheme, reducedMotion)
- set_geolocation: Set GPS coordinates
- set_offline: Toggle offline/online mode
- set_headers: Set custom HTTP headers`,
  inputSchema: emulationInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.emulation(input as Parameters<typeof browser.emulation>[0]);
  },
});
