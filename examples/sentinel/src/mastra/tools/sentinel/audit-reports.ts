import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * NYC Comptroller Annual Audit Reports — FY2001 through FY2023.
 * Each report is a comprehensive summary of every audit finding for that fiscal year.
 * Stable PDF URLs at comptroller.nyc.gov.
 */
const ANNUAL_AUDIT_REPORTS: Array<{ year: number; url: string }> = [
  { year: 2023, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-FY2023.pdf' },
  { year: 2022, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-FY2022-secured.pdf' },
  { year: 2021, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/AuditAnnual2021.pdf' },
  { year: 2020, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/AuditAnnual2020.pdf' },
  { year: 2019, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/AuditAnnual2019.pdf' },
  { year: 2018, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-2018.pdf' },
  { year: 2017, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual2017-Final-secured.pdf' },
  { year: 2016, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Report-2016-Secured.pdf' },
  { year: 2015, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/AnnualRpt2015.pdf' },
  { year: 2014, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/AnnualAuditReport2014.pdf' },
  { year: 2013, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/AnnualReport_2013.pdf' },
  { year: 2012, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2012.pdf' },
  { year: 2011, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2011.pdf' },
  { year: 2010, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2010.pdf' },
  { year: 2009, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2009.pdf' },
  { year: 2008, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2008.pdf' },
  { year: 2007, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2007.pdf' },
  { year: 2006, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2006.pdf' },
  { year: 2005, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2005.pdf' },
  { year: 2004, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2004.pdf' },
  { year: 2003, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2003.pdf' },
  { year: 2002, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2002.pdf' },
  { year: 2001, url: 'https://comptroller.nyc.gov/wp-content/uploads/documents/Annual-Audit-Report-Fiscal-Year-2001.pdf' },
];

type PdfParser = (
  buffer: Buffer,
  options?: Record<string, unknown>,
) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;

let _pdfParse: PdfParser | null = null;
async function getPdfParser(): Promise<PdfParser> {
  if (!_pdfParse) {
    _pdfParse = (await import('pdf-parse' as string)).default as PdfParser;
  }
  return _pdfParse;
}

/**
 * Download a PDF and extract text. Returns null on failure (non-blocking).
 */
async function extractPdfText(
  url: string,
  maxPages: number,
): Promise<{ text: string; pages: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MastraSentinel/1.0 (audit-research-tool)' },
    });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const pdfParse = await getPdfParser();
    const parsed = await pdfParse(buffer, { max: maxPages });
    return { text: parsed.text, pages: parsed.numpages };
  } catch {
    return null;
  }
}

/**
 * Search for keywords in text, returning surrounding context for each match.
 */
function findMatchingExcerpts(
  text: string,
  keywords: string[],
  contextChars: number = 500,
): Array<{ keyword: string; excerpt: string; position: number }> {
  const matches: Array<{ keyword: string; excerpt: string; position: number }> = [];
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    let startPos = 0;

    while (true) {
      const idx = lowerText.indexOf(lowerKeyword, startPos);
      if (idx === -1) break;

      const excerptStart = Math.max(0, idx - contextChars);
      const excerptEnd = Math.min(text.length, idx + lowerKeyword.length + contextChars);
      const excerpt = text.substring(excerptStart, excerptEnd).trim();

      matches.push({ keyword, excerpt, position: idx });
      startPos = idx + lowerKeyword.length;
    }
  }

  return matches;
}

export const sentinelAuditFindingsSearch = createTool({
  id: 'sentinel-audit-findings-search',
  description:
    'Search across 20+ years of NYC Comptroller annual audit reports (FY2001–FY2023) for keywords or topics. Fetches and searches through the actual PDF text of annual audit reports in parallel. Each annual report summarizes every audit finding, recommendation, and agency response for that fiscal year. Use for questions like "Show me prior findings related to overtime abuse" or "Find all audit findings about the Department of Education."',
  inputSchema: z.object({
    keywords: z
      .array(z.string())
      .min(1)
      .describe(
        'Keywords to search for across audit reports, e.g. ["subrecipient", "monitoring", "grant compliance"]',
      ),
    year_from: z
      .number()
      .optional()
      .describe('Earliest fiscal year to search (default: 2001)'),
    year_to: z
      .number()
      .optional()
      .describe('Latest fiscal year to search (default: 2023)'),
    max_pages_per_report: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50)
      .describe('Max pages to extract per report PDF (default 50)'),
    max_excerpts_per_report: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe('Max matching excerpts to return per report (default 5)'),
  }),
  execute: async ({
    keywords,
    year_from,
    year_to,
    max_pages_per_report = 50,
    max_excerpts_per_report = 5,
  }) => {
    const fromYear = year_from ?? 2001;
    const toYear = year_to ?? 2023;

    const reportsToSearch = ANNUAL_AUDIT_REPORTS.filter(
      r => r.year >= fromYear && r.year <= toYear,
    );

    if (reportsToSearch.length === 0) {
      return { error: `No annual audit reports available for FY${fromYear}–FY${toYear}` };
    }

    // Fetch and search all reports in parallel
    const results = await Promise.all(
      reportsToSearch.map(async report => {
        const extracted = await extractPdfText(report.url, max_pages_per_report);
        if (!extracted) {
          return {
            fiscal_year: report.year,
            status: 'failed' as const,
            matches: [] as Array<{ keyword: string; excerpt: string; position: number }>,
          };
        }

        const matches = findMatchingExcerpts(extracted.text, keywords);

        return {
          fiscal_year: report.year,
          status: 'searched' as const,
          total_pages: extracted.pages,
          match_count: matches.length,
          matches: matches.slice(0, max_excerpts_per_report),
        };
      }),
    );

    const reportsWithMatches = results.filter(r => r.match_count && r.match_count > 0);
    const totalMatches = results.reduce((sum, r) => sum + (r.match_count ?? 0), 0);

    return {
      keywords,
      years_searched: `FY${fromYear}–FY${toYear}`,
      reports_searched: reportsToSearch.length,
      reports_with_matches: reportsWithMatches.length,
      total_matches: totalMatches,
      findings: reportsWithMatches.sort((a, b) => b.fiscal_year - a.fiscal_year),
      reports_failed: results.filter(r => r.status === 'failed').map(r => r.fiscal_year),
    };
  },
});

export const sentinelAuditReportContent = createTool({
  id: 'sentinel-audit-report-content',
  description:
    'Fetch and extract full text content from a specific NYC Comptroller audit report PDF. Accepts a direct PDF URL or a fiscal year (FY2001–FY2023) to pull the annual audit report for that year. Returns extracted text for detailed analysis of findings, recommendations, and compliance issues.',
  inputSchema: z.object({
    url: z
      .string()
      .url()
      .optional()
      .describe('Direct PDF URL. If omitted, provide fiscal_year instead.'),
    fiscal_year: z
      .number()
      .optional()
      .describe('Fiscal year (2001–2023) to fetch the annual audit report for.'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50)
      .describe('Maximum pages to extract text from (default 50)'),
  }),
  execute: async ({ url, fiscal_year, max_pages = 50 }) => {
    let pdfUrl = url;

    if (!pdfUrl && fiscal_year) {
      const report = ANNUAL_AUDIT_REPORTS.find(r => r.year === fiscal_year);
      if (!report) {
        throw new Error(
          `No annual audit report available for FY${fiscal_year}. Available years: FY2001–FY2023.`,
        );
      }
      pdfUrl = report.url;
    }

    if (!pdfUrl) {
      throw new Error('Provide either a PDF url or a fiscal_year (2001–2023).');
    }

    const extracted = await extractPdfText(pdfUrl, max_pages);
    if (!extracted) {
      throw new Error(`Failed to fetch or parse PDF: ${pdfUrl}`);
    }

    return {
      source_url: pdfUrl,
      fiscal_year: fiscal_year ?? null,
      page_count: extracted.pages,
      extracted_pages: Math.min(max_pages, extracted.pages),
      text_content: extracted.text,
    };
  },
});
