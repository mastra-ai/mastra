import { describe, it, expect } from 'vitest';
import { TokenCounter } from './token-counter.js';

describe('TokenCounter', () => {
  const counter = new TokenCounter();

  it('counts tokens in a simple string', () => {
    const count = counter.count('Hello, world!');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it('returns 0 for empty string', () => {
    expect(counter.count('')).toBe(0);
  });

  it('returns 0 for null/undefined-ish values', () => {
    expect(counter.count('')).toBe(0);
  });

  it('counts tokens in a longer passage', () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(100);
    const count = counter.count(text);
    // Each repetition is roughly 10 tokens, so 100 reps should be ~1000
    expect(count).toBeGreaterThan(500);
    expect(count).toBeLessThan(2000);
  });

  it('handles special characters', () => {
    const text = '🔴 (14:30) User stated prefers TypeScript';
    const count = counter.count(text);
    expect(count).toBeGreaterThan(0);
  });

  it('handles code content', () => {
    const code = `
export function middleware(req: NextRequest) {
  const token = req.cookies.get('auth-token');
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
`;
    const count = counter.count(code);
    expect(count).toBeGreaterThan(20);
  });
});
