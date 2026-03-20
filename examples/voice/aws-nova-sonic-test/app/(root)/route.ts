// This route is disabled - using React component via app/page.tsx instead
// If you need the static HTML version, access it at /api/root
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  // Serve the static HTML file directly without React hydration
  // NOTE: This route is now shadowed by app/page.tsx which uses the React component
  // To access the static version, use /api/root instead
  try {
    const htmlPath = join(process.cwd(), 'public', 'index.html');
    const htmlContent = readFileSync(htmlPath, 'utf-8');
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error serving HTML:', error);
    return new NextResponse('HTML file not found', { status: 404 });
  }
}

