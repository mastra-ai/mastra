import { registerApiRoute } from '@mastra/core/server';
// read-excel-file/node/package.json has its own name and version (#28828).
import readXlsxFile from 'read-excel-file/node';

export const excelSubpathRoute = registerApiRoute('/excel-subpath', {
  method: 'GET',
  handler: async c => c.json({ readXlsxFile: typeof readXlsxFile }),
});
