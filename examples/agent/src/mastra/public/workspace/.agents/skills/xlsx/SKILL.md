---
name: xlsx
description: Reads Excel workbooks (.xlsx) stored in the sandbox, such as files under uploads/. Use when the user attaches or mentions a spreadsheet.
---

# Read an XLSX workbook

An `.xlsx` file is a ZIP archive of XML files. Reading it as text returns unreadable bytes, so extract its cells with a sandbox command instead.

## Print every sheet as CSV

Run this command in the sandbox. Replace the path with the one from the `[File uploaded to the sandbox]` note:

```bash
python3 - "uploads/workbook.xlsx" <<'PY'
import csv, sys, zipfile
import xml.etree.ElementTree as ET

MAIN = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
DOC_REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
PKG_REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'

def parse(book, name):
    data = book.read(name)
    flat = data.replace(b'\x00', b'')
    if b'<!DOCTYPE' in flat or b'<!ENTITY' in flat:
        sys.exit(name + ' declares a DTD, which a workbook never needs. Refusing to parse it.')
    return ET.fromstring(data)

def text_of(node):
    runs = node.findall(MAIN + 't') + node.findall(MAIN + 'r/' + MAIN + 't')
    return ''.join(run.text or '' for run in runs)

def column_of(ref):
    index = 0
    for letter in ref:
        if not letter.isalpha():
            break
        index = index * 26 + ord(letter.upper()) - 64
    return index - 1

with zipfile.ZipFile(sys.argv[1]) as book:
    strings = []
    if 'xl/sharedStrings.xml' in book.namelist():
        strings = [text_of(item) for item in parse(book, 'xl/sharedStrings.xml').iter(MAIN + 'si')]
    rels = parse(book, 'xl/_rels/workbook.xml.rels')
    targets = {rel.get('Id'): rel.get('Target') for rel in rels.iter(PKG_REL + 'Relationship')}
    out = csv.writer(sys.stdout)
    for sheet in parse(book, 'xl/workbook.xml').iter(MAIN + 'sheet'):
        target = targets[sheet.get(DOC_REL + 'id')]
        path = target[1:] if target.startswith('/') else 'xl/' + target
        print('## Sheet: ' + sheet.get('name'))
        for row in parse(book, path).iter(MAIN + 'row'):
            cells = []
            for cell in row.iter(MAIN + 'c'):
                kind, value = cell.get('t'), cell.findtext(MAIN + 'v') or ''
                if kind == 's':
                    value = strings[int(value)]
                elif kind == 'inlineStr':
                    value = text_of(cell.find(MAIN + 'is'))
                elif kind == 'b':
                    value = 'TRUE' if value == '1' else 'FALSE'
                index = column_of(cell.get('r') or '')
                if index < 0:
                    index = len(cells)
                cells.extend([''] * (index - len(cells) + 1))
                cells[index] = value
            out.writerow(cells)
PY
```

The output has one `## Sheet: <name>` line per sheet, followed by its rows as CSV.

## Read the output

- Empty cells are empty CSV fields, so columns stay aligned.
- A formula cell shows its last computed value, not the formula.
- Dates are Excel serial numbers: the number of days since 1899-12-30. For example, `45000` is 2023-03-15.
- For a large sheet, read the first rows only: end the first line with `<<'PY' | head -n 50`.

## When the command fails

- `No such file or directory`: the path doesn't match the uploaded file. Copy it again from the `path:` line of the note, character for character. To see what exists, run `ls uploads/` as a sandbox command. The workspace file tools read a different filesystem and never see uploaded files.
- `python3: command not found`: list the archive with `unzip -l <path>`, then read `xl/sharedStrings.xml` and `xl/worksheets/sheet1.xml` with `unzip -p <path> <entry>`. A cell with `t="s"` holds an index into the shared strings.
- `declares a DTD`: the workbook is malformed or hostile. Don't parse it another way. Tell the user the file can't be read.
- `File is not a zip file`: the file isn't an `.xlsx` workbook. The older `.xls` format can't be read this way. Ask the user to save the file as `.xlsx` or CSV.
