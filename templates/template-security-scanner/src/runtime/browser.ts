import { z } from 'zod';
import { RuntimeDiagnostic } from '../config/settings.js';

export const BROWSER_FLAGS = [
  '--headless',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-gpu-compositing',
  '--disable-gpu-rasterization',
  '--disable-gpu-shader-disk-cache',
  '--disable-background-networking',
  '--no-first-run',
  '--no-default-browser-check',
] as const;

const statusSchema = z.object({
  layer1: z.literal('namespace'),
  pidNamespaces: z.literal('yes').transform(() => true as const),
  networkNamespaces: z.literal('yes').transform(() => true as const),
  seccompBpf: z.literal('yes').transform(() => true as const),
  seccompTsync: z
    .enum(['yes', 'no'])
    .transform(value => value === 'yes')
    .nullable(),
});

/** Parse Chromium's observed sandbox status and reject missing required positive controls. */
export function parseBrowserSandboxStatus(html: string) {
  const input = z.string().max(65536).safeParse(html);
  const table = input.success
    ? input.data.match(/<table\b[^>]*\bid=["']sandbox-status["'][^>]*>([\s\S]*?)<\/table>/i)?.[1]
    : undefined;
  const rows = table?.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const values = new Map<string, string>();
  let ambiguous = false;
  for (const row of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match =>
      match[1]!
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    );
    if (cells.length !== 2) {
      ambiguous = true;
      continue;
    }
    const [label, value] = cells as [string, string];
    if (values.has(label)) ambiguous = true;
    values.set(label, value);
  }
  const parsed = statusSchema.safeParse({
    layer1: values.get('layer 1 sandbox'),
    pidNamespaces: values.get('pid namespaces'),
    networkNamespaces: values.get('network namespaces'),
    seccompBpf: values.get('seccomp-bpf sandbox'),
    seccompTsync: values.get('seccomp-bpf sandbox supports tsync') ?? null,
  });
  if (ambiguous || !parsed.success) {
    throw new RuntimeDiagnostic(
      'BROWSER_SANDBOX_UNAVAILABLE',
      'Chromium must report Namespace, PID/network namespace isolation and Seccomp-BPF active in its sandbox status.',
    );
  }
  return parsed.data;
}
