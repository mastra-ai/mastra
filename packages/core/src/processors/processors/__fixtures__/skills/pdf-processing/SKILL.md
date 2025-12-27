---
name: pdf-processing
description: Extract text and tables from PDF files, fill PDF forms, and merge multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
license: Apache-2.0
metadata:
  author: test-org
  version: '1.0'
---

# PDF Processing Skill

This skill provides capabilities for working with PDF documents.

## When to Use

Use this skill when the user needs to:

- Extract text from PDF files
- Extract tables from PDF documents
- Fill out PDF forms
- Merge multiple PDF files
- Split PDF files

## Instructions

1. **Extract Text**: Use the `extract_text` function with the PDF file path
2. **Extract Tables**: Use the `extract_tables` function to get structured table data
3. **Fill Forms**: Use the `fill_form` function with field mappings
4. **Merge PDFs**: Use the `merge_pdfs` function with a list of PDF paths
5. **Split PDFs**: Use the `split_pdf` function with page ranges

## Examples

### Extract Text from PDF

```python
text = extract_text("document.pdf")
print(text)
```

### Extract Tables

```python
tables = extract_tables("report.pdf")
for table in tables:
    print(table.to_csv())
```

## Common Edge Cases

- Large PDFs (>100MB) may require chunking
- Scanned PDFs need OCR (use `use_ocr=True` parameter)
- Password-protected PDFs require the password parameter
