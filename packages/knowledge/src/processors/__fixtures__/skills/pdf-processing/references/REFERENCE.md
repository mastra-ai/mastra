# PDF Processing Reference

## Supported PDF Versions

- PDF 1.0 through PDF 2.0
- PDF/A (archival)
- PDF/X (print production)

## Functions

### extract_text(file_path, page_range=None, use_ocr=False)

Extracts text from PDF.

**Parameters:**

- `file_path`: Path to PDF file
- `page_range`: Optional tuple (start, end) for page range
- `use_ocr`: Boolean to enable OCR for scanned documents

**Returns:** String containing extracted text

### extract_tables(file_path, page_range=None)

Extracts tables from PDF into structured format.

**Parameters:**

- `file_path`: Path to PDF file
- `page_range`: Optional tuple (start, end) for page range

**Returns:** List of pandas DataFrames
