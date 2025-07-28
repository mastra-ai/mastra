import PDFParser from 'pdf2json';

export interface PDFExtractionResult {
  extractedText: string;
  pagesCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
}

export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFExtractionResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(null, true);

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error('PDF parsing error:', errData.parserError);
      reject(new Error(`PDF parsing failed: ${errData.parserError}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        let extractedText = '';
        let pagesCount = 0;

        if (pdfData && pdfData.Pages && Array.isArray(pdfData.Pages)) {
          pagesCount = pdfData.Pages.length;

          for (const page of pdfData.Pages) {
            if (page.Texts && Array.isArray(page.Texts)) {
              for (const text of page.Texts) {
                if (text.R && Array.isArray(text.R)) {
                  for (const run of text.R) {
                    if (run.T) {
                      // Decode URI component to handle special characters
                      const decodedText = decodeURIComponent(run.T);
                      extractedText += decodedText + ' ';
                    }
                  }
                }
              }
            }
            extractedText += '\n\n'; // Add page break
          }
        }

        // Clean up the extracted text
        extractedText = extractedText
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
          .trim();

        const metadata = {
          title: pdfData.Meta?.Title || undefined,
          author: pdfData.Meta?.Author || undefined,
          subject: pdfData.Meta?.Subject || undefined,
          creator: pdfData.Meta?.Creator || undefined,
        };

        resolve({
          extractedText,
          pagesCount,
          metadata,
        });
      } catch (error) {
        console.error('Error processing PDF data:', error);
        reject(new Error(`Failed to process extracted PDF data: ${error}`));
      }
    });

    try {
      pdfParser.parseBuffer(pdfBuffer);
    } catch (error) {
      console.error('Error parsing PDF buffer:', error);
      reject(new Error(`Failed to parse PDF buffer: ${error}`));
    }
  });
}
