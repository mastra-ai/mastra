import type { MastraPackage } from '../schemas/system';
import { systemPackagesResponseSchema } from '../schemas/system';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

export const GET_SYSTEM_PACKAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/system/packages',
  responseType: 'json',
  responseSchema: systemPackagesResponseSchema,
  summary: 'Get installed Mastra packages',
  description: 'Returns a list of all installed Mastra packages and their versions from the project',
  tags: ['System'],
  handler: async () => {
    try {
      const packagesEnv = process.env.MASTRA_PACKAGES;

      let packages: MastraPackage[] = [];

      if (packagesEnv) {
        try {
          packages = JSON.parse(packagesEnv);
        } catch {
          packages = [];
        }
      }

      return { packages };
    } catch (error) {
      return handleError(error, 'Error getting system packages');
    }
  },
});
