import type { SetDeviceOutput, SetMediaOutput } from '@mastra/core/browser';
import {
  setDeviceInputSchema,
  setDeviceOutputSchema,
  setMediaInputSchema,
  setMediaOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

// Common device definitions
const DEVICES: Record<
  string,
  { viewport: { width: number; height: number; deviceScaleFactor: number }; userAgent: string }
> = {
  'iPhone 14': {
    viewport: { width: 390, height: 844, deviceScaleFactor: 3 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  'iPhone 14 Pro': {
    viewport: { width: 393, height: 852, deviceScaleFactor: 3 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  'iPhone 15': {
    viewport: { width: 393, height: 852, deviceScaleFactor: 3 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  'iPad Pro': {
    viewport: { width: 1024, height: 1366, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  'iPad Air': {
    viewport: { width: 820, height: 1180, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  'Pixel 7': {
    viewport: { width: 412, height: 915, deviceScaleFactor: 2.625 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  },
  'Pixel 7 Pro': {
    viewport: { width: 412, height: 892, deviceScaleFactor: 3.5 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  },
  'Samsung Galaxy S23': {
    viewport: { width: 360, height: 780, deviceScaleFactor: 3 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  },
  'Desktop 1080p': {
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
  'Desktop 1440p': {
    viewport: { width: 2560, height: 1440, deviceScaleFactor: 1 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
  'MacBook Pro 14': {
    viewport: { width: 1512, height: 982, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
  'MacBook Air': {
    viewport: { width: 1280, height: 832, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  },
};

export function createSetDeviceTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_device',
    description: `Emulate a specific device (sets viewport, user agent, and device scale). Available devices: ${Object.keys(DEVICES).join(', ')}`,
    inputSchema: setDeviceInputSchema,
    outputSchema: setDeviceOutputSchema,
    execute: async ({ context: { device } }): Promise<SetDeviceOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        // Find device (case-insensitive)
        const deviceKey = Object.keys(DEVICES).find(key => key.toLowerCase() === device.toLowerCase());
        if (!deviceKey) {
          return {
            success: false,
            code: 'unknown_device',
            message: `Unknown device: ${device}. Available devices: ${Object.keys(DEVICES).join(', ')}`,
          };
        }

        const deviceConfig = DEVICES[deviceKey];

        // Set viewport
        await page.setViewportSize({
          width: deviceConfig.viewport.width,
          height: deviceConfig.viewport.height,
        });

        // Set user agent via CDP
        const cdp = await browser.getCDPSession();
        if (cdp) {
          await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: deviceConfig.viewport.width,
            height: deviceConfig.viewport.height,
            deviceScaleFactor: deviceConfig.viewport.deviceScaleFactor,
            mobile: deviceConfig.viewport.width < 768,
          });
          await cdp.send('Emulation.setUserAgentOverride', {
            userAgent: deviceConfig.userAgent,
          });
        }

        return {
          success: true,
          device: deviceKey,
          viewport: deviceConfig.viewport,
          userAgent: deviceConfig.userAgent,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'set_device_failed',
          message: `Failed to set device: ${message}`,
        };
      }
    },
  });
}

export function createSetMediaTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_set_media',
    description: 'Set media features like color scheme (dark/light), reduced motion, or forced colors',
    inputSchema: setMediaInputSchema,
    outputSchema: setMediaOutputSchema,
    execute: async ({ context: { colorScheme, reducedMotion, forcedColors } }): Promise<SetMediaOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const cdp = await browser.getCDPSession();
        if (!cdp) {
          return {
            success: false,
            code: 'cdp_not_available',
            message: 'CDP session not available for media emulation',
          };
        }

        const features: Array<{ name: string; value: string }> = [];

        if (colorScheme) {
          features.push({ name: 'prefers-color-scheme', value: colorScheme });
        }
        if (reducedMotion) {
          features.push({ name: 'prefers-reduced-motion', value: reducedMotion });
        }
        if (forcedColors) {
          features.push({ name: 'forced-colors', value: forcedColors });
        }

        if (features.length > 0) {
          await cdp.send('Emulation.setEmulatedMedia', { features });
        }

        return {
          success: true,
          settings: {
            colorScheme,
            reducedMotion,
            forcedColors,
          },
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'set_media_failed',
          message: `Failed to set media: ${message}`,
        };
      }
    },
  });
}
