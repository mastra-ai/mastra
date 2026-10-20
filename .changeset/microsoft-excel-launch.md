---
'@mastra/connect': minor
---

Added a Microsoft Excel toolset with 27 tools for drive discovery, workbook files, worksheets, ranges, tables, names, charts, and search.

```ts
import { tools } from '@mastra/connect';

const excelTools = await tools({ providers: ['microsoft-excel'] })();
const drive = await excelTools.microsoft_excel_get_user_drive.execute({});
const workbooks = await excelTools.microsoft_excel_list_workbooks.execute({ driveId: drive.id });
```
