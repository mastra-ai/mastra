// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceFilePreview, WorkspaceFilePreviewContent } from '../workspace-file-preview';
import { getWorkspaceFilePreviewKind, isWorkspaceFilePreviewBinary } from '../workspace-file-preview-utils';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function renderWithMastraClient(children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>,
  );
}

const pdfMocks = vi.hoisted(() => ({
  destroyLoadingTask: vi.fn(),
  getDocument: vi.fn(),
  getPage: vi.fn(),
  cleanupDocument: vi.fn(),
  renderPage: vi.fn(),
  workerOptionsState: { value: undefined as string | undefined },
  globalWorkerOptions: {} as { workerSrc?: string },
}));

const officeMocks = vi.hoisted(() => ({
  extractRawText: vi.fn(),
  loadZip: vi.fn(),
  readSpreadsheet: vi.fn(),
  sheetToJson: vi.fn(),
}));

Object.defineProperty(pdfMocks.globalWorkerOptions, 'workerSrc', {
  configurable: true,
  get: () => pdfMocks.workerOptionsState.value,
  set: (value: unknown) => {
    if (typeof value !== 'string') throw new Error('Invalid `workerSrc` type.');
    pdfMocks.workerOptionsState.value = value;
  },
});

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: pdfMocks.globalWorkerOptions,
  getDocument: pdfMocks.getDocument,
}));

vi.mock('pdfjs-dist/build/pdf.worker.mjs?worker&url', () => ({
  default: 'pdf.worker.mjs',
}));

vi.mock('mammoth', () => ({
  extractRawText: officeMocks.extractRawText,
}));

vi.mock('jszip', () => ({
  default: {
    loadAsync: officeMocks.loadZip,
  },
}));

vi.mock('xlsx', () => ({
  read: officeMocks.readSpreadsheet,
  utils: {
    sheet_to_json: officeMocks.sheetToJson,
  },
}));

beforeEach(() => {
  pdfMocks.destroyLoadingTask.mockReset();
  pdfMocks.getDocument.mockReset();
  pdfMocks.getPage.mockReset();
  pdfMocks.cleanupDocument.mockReset();
  pdfMocks.renderPage.mockReset();
  pdfMocks.workerOptionsState.value = undefined;
  officeMocks.extractRawText.mockReset();
  officeMocks.loadZip.mockReset();
  officeMocks.readSpreadsheet.mockReset();
  officeMocks.sheetToJson.mockReset();

  pdfMocks.renderPage.mockReturnValue({ cancel: vi.fn(), promise: Promise.resolve() });
  pdfMocks.getPage.mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({ height: 800 * scale, width: 600 * scale }),
    render: pdfMocks.renderPage,
  });
  pdfMocks.getDocument.mockReturnValue({
    destroy: pdfMocks.destroyLoadingTask,
    promise: Promise.resolve({
      cleanup: pdfMocks.cleanupDocument,
      getPage: pdfMocks.getPage,
      numPages: 1,
    }),
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        setTransform: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  );

  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}

      observe() {
        this.callback([{ contentRect: { width: 640 } } as ResizeObserverEntry], this);
      }

      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WorkspaceFilePreviewContent', () => {
  it('renders PDF files in a custom canvas viewer', async () => {
    const { container } = render(
      <WorkspaceFilePreviewContent path="reports/output.pdf" content="JVBERi0xLjQ=" mimeType="application/pdf" />,
    );

    expect(container.querySelector('iframe')).toBeNull();
    await waitFor(() => expect(pdfMocks.workerOptionsState.value).toBe('pdf.worker.mjs'));
    expect(await screen.findByTestId('workspace-pdf-page-1')).toBeTruthy();
    await waitFor(() => expect(pdfMocks.renderPage).toHaveBeenCalled());
  });

  it('recovers a stale artifact workspace when a single filesystem workspace can read the file', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workspaces`, () =>
        HttpResponse.json({
          workspaces: [
            {
              id: 'ws-current',
              name: 'Current workspace',
              status: 'pending',
              source: 'agent',
              agentId: 'chef-model-v2-agent',
              agentName: 'Chef Agent V2 Model',
              capabilities: {
                hasFilesystem: true,
                hasSandbox: false,
                canBM25: false,
                canVector: false,
                canHybrid: false,
                hasSkills: true,
              },
              safety: { readOnly: false },
            },
          ],
        }),
      ),
      http.get(`${BASE_URL}/api/workspaces/ws-stale/fs/stat`, () =>
        HttpResponse.json({ error: 'No workspace filesystem configured' }, { status: 404 }),
      ),
      http.get(`${BASE_URL}/api/workspaces/ws-current/fs/stat`, () =>
        HttpResponse.json({
          path: 'reports/output.pdf',
          type: 'file',
          size: 12,
          mimeType: 'application/pdf',
        }),
      ),
      http.get(`${BASE_URL}/api/workspaces/ws-current/fs/read`, () =>
        HttpResponse.json({
          path: 'reports/output.pdf',
          content: 'JVBERi0xLjQ=',
          type: 'file',
          size: 12,
          mimeType: 'application/pdf',
        }),
      ),
    );

    renderWithMastraClient(<WorkspaceFilePreview workspaceId="ws-stale" path="reports/output.pdf" />);

    await waitFor(() => expect(pdfMocks.workerOptionsState.value).toBe('pdf.worker.mjs'));
    expect(await screen.findByTestId('workspace-pdf-page-1')).toBeTruthy();
    await waitFor(() => expect(pdfMocks.getDocument).toHaveBeenCalled());
  });

  it('renders image files with a base64 data URL', () => {
    render(<WorkspaceFilePreviewContent path="images/chart.png" content="iVBORw0KGgo=" mimeType="image/png" />);

    expect(screen.getByRole('img', { name: 'chart.png' }).getAttribute('src')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('renders text and code files inline', () => {
    const { container } = render(
      <WorkspaceFilePreviewContent path="src/index.ts" content="const answer = 42;" mimeType="text/plain" />,
    );

    expect(container.textContent).toContain('const answer = 42;');
  });

  it('renders Markdown files with preview and code tabs', () => {
    const { container } = render(
      <WorkspaceFilePreviewContent
        path="artifact-test.md"
        content={'# Recipe\n\nA **bright** pasta.'}
        mimeType="text/markdown"
      />,
    );

    expect(screen.getByRole('tab', { name: 'Preview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Code' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Recipe' })).toBeTruthy();
    expect(container.querySelector('strong')?.textContent).toBe('bright');

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));

    expect(container.textContent).toContain('# Recipe');
  });

  it('renders MDX files as a readable preview without showing component scaffolding', () => {
    const mdxContent = `export const RecipeCard = ({children, title}) => (

<div style={{fontFamily: 'Arial, sans-serif', border: '1px solid #eee'}}><h1>{title}</h1> {children}</div>

)

# Quick Lemon Garlic Pasta

<RecipeCard title="Quick Lemon Garlic Pasta">

## Ingredients

- 200 g spaghetti
- 2 tbsp olive oil

</RecipeCard>`;
    const { container } = render(
      <WorkspaceFilePreviewContent path="docs/page.mdx" content={mdxContent} />,
    );

    expect(screen.getByRole('heading', { name: 'Quick Lemon Garlic Pasta' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ingredients' })).toBeTruthy();
    expect(screen.getByText('200 g spaghetti')).toBeTruthy();
    expect(screen.getByText(/MDX component code is not executed in Preview/)).toBeTruthy();
    expect(container.textContent).not.toContain('export const RecipeCard');
    expect(container.textContent).not.toContain('<RecipeCard');
    expect(container.textContent).not.toContain('</RecipeCard>');

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));

    expect(container.textContent).toContain('export const RecipeCard');
    expect(container.textContent).toContain('<RecipeCard title="Quick Lemon Garlic Pasta">');
  });

  it('renders HTML files in a sandboxed iframe with a code tab', () => {
    const { container } = render(
      <WorkspaceFilePreviewContent
        path="public/page.html"
        content={'<html><body><h1>Hello HTML</h1><script>window.evil = true</script></body></html>'}
        mimeType="text/html"
      />,
    );
    const iframe = screen.getByTitle('Preview of page.html');

    expect(iframe.getAttribute('sandbox')).toBe('');
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Hello HTML</h1>');

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));

    expect(container.textContent).toContain('<h1>Hello HTML</h1>');
  });

  it('renders CSV files with DataList and quoted values and uneven rows', () => {
    const { container } = render(
      <WorkspaceFilePreviewContent
        path="exports/report.csv"
        content={'name,notes,total\n"Ada, Lovelace","Line 1\nLine 2",42\nGrace,,7,extra'}
        mimeType="text/csv"
      />,
    );

    expect(container.querySelector('.data-list-top')).toBeTruthy();
    expect(container.querySelectorAll('.data-list-row')).toHaveLength(2);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('D')).toBeTruthy();
    expect(screen.getByText('Ada, Lovelace')).toBeTruthy();
    expect(screen.getByText(/Line 1/)).toBeTruthy();
    expect(screen.getByText('extra')).toBeTruthy();
    expect(screen.queryByText('const answer = 42;')).toBeNull();
  });

  it('renders TSV files with DataList', () => {
    const { container } = render(
      <WorkspaceFilePreviewContent path="exports/report.tsv" content={'name\tcount\nAda\t2'} />,
    );

    expect(container.querySelector('.data-list-top')).toBeTruthy();
    expect(container.querySelectorAll('.data-list-row')).toHaveLength(1);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders spreadsheet files as sheet tabs and table cells', async () => {
    officeMocks.readSpreadsheet.mockReturnValue({
      SheetNames: ['Budget', 'Notes'],
      Sheets: {
        Budget: {},
        Notes: {},
      },
    });
    officeMocks.sheetToJson
      .mockReturnValueOnce([
        ['Quarter', 'Revenue'],
        ['Q1', '42'],
      ])
      .mockReturnValueOnce([['Memo']]);

    render(
      <WorkspaceFilePreviewContent
        path="sheets/budget.xlsx"
        content="c3ByZWFkc2hlZXQ="
        mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      />,
    );

    expect(await screen.findByRole('button', { name: 'Budget' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeTruthy();
    expect(screen.getByText('Quarter')).toBeTruthy();
    expect(screen.getByText('Q1')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders DOCX files as readable extracted text', async () => {
    officeMocks.extractRawText.mockResolvedValue({
      messages: [],
      value: 'Quarterly plan\n\nShip artifact previews',
    });

    render(
      <WorkspaceFilePreviewContent
        path="docs/plan.docx"
        content="ZG9jeA=="
        mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      />,
    );

    expect(await screen.findByText('Quarterly plan')).toBeTruthy();
    expect(screen.getByText('Ship artifact previews')).toBeTruthy();
  });

  it('renders PPTX files as readable slide text in slide order', async () => {
    officeMocks.loadZip.mockResolvedValue({
      file: () => [
        {
          name: 'ppt/slides/slide2.xml',
          async: vi
            .fn()
            .mockResolvedValue(
              '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Second slide</a:t></p:sld>',
            ),
        },
        {
          name: 'ppt/slides/slide1.xml',
          async: vi
            .fn()
            .mockResolvedValue(
              '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>First slide</a:t></p:sld>',
            ),
        },
      ],
    });

    render(
      <WorkspaceFilePreviewContent
        path="decks/roadmap.pptx"
        content="cHB0eA=="
        mimeType="application/vnd.openxmlformats-officedocument.presentationml.presentation"
      />,
    );

    expect(await screen.findByText('Slide 1')).toBeTruthy();
    expect(screen.getByText('First slide')).toBeTruthy();
    expect(screen.getByText('Slide 2')).toBeTruthy();
    expect(screen.getByText('Second slide')).toBeTruthy();
  });

  it('wraps long text and code lines instead of forcing horizontal scrolling', () => {
    const { container, rerender } = render(
      <WorkspaceFilePreviewContent
        path="src/long.ts"
        content="const longValue = 'A very long code line that should wrap instead of scrolling horizontally';"
        mimeType="text/plain"
      />,
    );

    expect(container.querySelector('pre')?.style.overflowX).toBe('hidden');
    expect(container.querySelector('code')?.style.whiteSpace).toBe('pre-wrap');
    expect(container.querySelector('code')?.style.overflowWrap).toBe('anywhere');

    rerender(
      <WorkspaceFilePreviewContent
        path="notes.txt"
        content="A very long plain text line that should wrap instead of scrolling horizontally"
        mimeType="text/plain"
      />,
    );

    expect(container.querySelector('pre')?.className).toContain('break-words');
    expect(container.querySelector('pre')?.className).toContain('whitespace-pre-wrap');

    rerender(
      <WorkspaceFilePreviewContent
        path="artifact-test.md"
        content="# Long heading that should wrap instead of scrolling horizontally"
        mimeType="text/markdown"
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Code' }));

    expect(container.querySelector('pre')?.style.overflowX).toBe('hidden');
    expect(container.querySelector('code')?.style.whiteSpace).toBe('pre-wrap');
  });

  it('renders the artifact variant without an inner framed surface', () => {
    const { container } = render(
      <WorkspaceFilePreviewContent
        path="artifact-test.md"
        content="# Recipe"
        mimeType="text/markdown"
        variant="artifact"
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    const header = root.firstElementChild as HTMLElement;

    expect(root.className).toContain('bg-transparent');
    expect(root.className).not.toContain('rounded-lg');
    expect(root.className).not.toContain('border');
    expect(header.className).not.toContain('bg-surface3');
    expect(header.className).not.toContain('border-b');
  });

  it('renders unsupported legacy Office files with open and download actions', () => {
    const onDownload = vi.fn();

    render(
      <WorkspaceFilePreviewContent
        path="decks/roadmap.ppt"
        mimeType="application/vnd.ms-powerpoint"
        size={2048}
        workspaceHref="/workspaces/ws-1?file=decks%2Froadmap.ppt"
        onDownload={onDownload}
      />,
    );

    expect(screen.getByText('Preview unavailable')).toBeTruthy();
    expect(screen.getByText(/application\/vnd.ms-powerpoint/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(
      '/workspaces/ws-1?file=decks%2Froadmap.ppt',
    );
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });

  it('keeps open and download actions available when Office parsing fails', async () => {
    const onDownload = vi.fn();
    officeMocks.readSpreadsheet.mockImplementation(() => {
      throw new Error('Bad workbook');
    });

    render(
      <WorkspaceFilePreviewContent
        path="sheets/budget.xlsx"
        content="YnJva2Vu"
        mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        workspaceHref="/workspaces/ws-1?file=sheets%2Fbudget.xlsx"
        onDownload={onDownload}
      />,
    );

    expect(await screen.findByText('Failed to preview spreadsheet')).toBeTruthy();
    expect(screen.getByText('Bad workbook')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(
      '/workspaces/ws-1?file=sheets%2Fbudget.xlsx',
    );
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
  });

  it('classifies previewable Office files, legacy Office files, and CSV/TSV files', () => {
    expect(getWorkspaceFilePreviewKind('docs/brief.docx')).toBe('document');
    expect(getWorkspaceFilePreviewKind('decks/roadmap.pptx')).toBe('presentation');
    expect(getWorkspaceFilePreviewKind('sheets/budget.xlsx')).toBe('spreadsheet');
    expect(getWorkspaceFilePreviewKind('sheets/budget.xls')).toBe('spreadsheet');
    expect(getWorkspaceFilePreviewKind('exports/report.csv')).toBe('csv');
    expect(getWorkspaceFilePreviewKind('exports/report.tsv')).toBe('csv');
    expect(getWorkspaceFilePreviewKind('pages/demo.html')).toBe('text');
    expect(getWorkspaceFilePreviewKind('pages/demo.htm')).toBe('text');
    expect(getWorkspaceFilePreviewKind('docs/brief.doc')).toBe('unsupported');
    expect(getWorkspaceFilePreviewKind('decks/roadmap.ppt')).toBe('unsupported');
    expect(isWorkspaceFilePreviewBinary('spreadsheet')).toBe(true);
    expect(isWorkspaceFilePreviewBinary('document')).toBe(true);
    expect(isWorkspaceFilePreviewBinary('presentation')).toBe(true);
    expect(isWorkspaceFilePreviewBinary('csv')).toBe(false);
  });
});
