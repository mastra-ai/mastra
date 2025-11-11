/**
 * Health check endpoint
 */

export async function GET() {
  return Response.json({ status: 'ok' });
}
