---
name: xlsx
description: Read .xlsx and .xls files uploaded to the workspace. Use when a message says a spreadsheet was uploaded to the workspace at a path.
---

# Read a spreadsheet

The message gives you the file path, for example `uploads/<id>/report.xlsx`.

1. Print every sheet with pandas:

```bash
python3 -c "
import sys, pandas as pd
for name, df in pd.read_excel(sys.argv[1], sheet_name=None).items():
    print(f'## {name} ({len(df)} rows)')
    print(df.to_string(max_rows=50))
" 'uploads/<id>/report.xlsx'
```

2. If the import fails, install the readers and run it again:

```bash
pip install pandas openpyxl xlrd
```

3. Answer with the values you read and name the sheets you used.
