import { useEffect, useRef } from 'react';
import { useTheme } from '@/ds/components/ThemeProvider';
import { Colors } from '@/ds/tokens/colors';
import './grain-fill.css';

const PIXEL_RATIO = 2;
const STOPS = ['--grain-back', '--grain-1', '--grain-2', '--grain-3', '--grain-4', '--grain-5'];

const grainByTheme = {
  dark: { intensity: 0.2, noise: 0.4 },
  light: { intensity: 0.1, noise: 0.15 },
};

const cache = new Map<string, Promise<string | undefined>>();

function toVec4(color: string, ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].map(channel => channel / 255);
}

function readStops(element: HTMLElement) {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  const previous = element.style.color;
  const stops = STOPS.map(name => {
    element.style.color = `var(${name})`;
    return toVec4(getComputedStyle(element).color, ctx);
  });
  element.style.color = previous;
  return stops;
}

type Theme = 'dark' | 'light';

export interface GrainFillSize {
  width: number;
  height: number;
}

async function render(stops: number[][], theme: Theme, { width, height }: GrainFillSize, offsetY: number) {
  const shaders = await import('@paper-design/shaders');
  const noiseTexture = shaders.getShaderNoiseTexture();
  await noiseTexture?.decode();

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${width * 2}px;top:0;width:${width}px;height:${height}px;pointer-events:none`;
  document.body.appendChild(host);

  const [back = [0, 0, 0, 0], ...colors] = stops;
  try {
    const mount = new shaders.ShaderMount(
      host,
      shaders.grainGradientFragmentShader,
      {
        u_colorBack: back,
        u_colors: colors,
        u_colorsCount: colors.length,
        u_softness: 1,
        u_intensity: grainByTheme[theme].intensity,
        u_noise: grainByTheme[theme].noise,
        u_shape: shaders.GrainGradientShapes.wave,
        u_noiseTexture: noiseTexture,
        u_fit: shaders.ShaderFitOptions[shaders.defaultPatternSizing.fit],
        u_scale: 1,
        u_rotation: 270,
        u_offsetX: -0.1,
        u_offsetY: offsetY,
        u_originX: 0.5,
        u_originY: 0.5,
        u_worldWidth: 0,
        u_worldHeight: 0,
      },
      { preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false },
      0,
      0,
      PIXEL_RATIO,
    );

    try {
      const canvas = host.querySelector('canvas');
      const nextFrame = () => new Promise(requestAnimationFrame);
      await nextFrame();
      await nextFrame();
      const target = width * Math.max(PIXEL_RATIO, window.devicePixelRatio);
      if (canvas && canvas.width < target) {
        mount.setMinPixelRatio((PIXEL_RATIO * target) / canvas.width);
        await nextFrame();
      }
      return canvas?.toDataURL('image/png');
    } finally {
      mount.dispose();
    }
  } finally {
    host.remove();
  }
}

function grainFill(element: HTMLElement, theme: Theme, size: GrainFillSize, offsetY: number) {
  const stops = readStops(element);
  if (!stops) return Promise.resolve(undefined);
  const cacheKey = JSON.stringify([stops, theme, size.width, size.height, offsetY]);
  let image = cache.get(cacheKey);
  if (!image) {
    image = render(stops, theme, size, offsetY).catch(() => undefined);
    cache.set(cacheKey, image);
  }
  return image;
}

const statusTones = ['warning', 'destructive', 'info', 'success'] as const;

export type GrainFillTone = (typeof statusTones)[number] | keyof typeof Colors;

function isStatusTone(tone: GrainFillTone): tone is (typeof statusTones)[number] {
  return statusTones.some(status => status === tone);
}

function toneLayer(tone: GrainFillTone) {
  if (isStatusTone(tone)) return { dataTone: tone, offsetY: 0, style: {} };
  return { dataTone: 'color', offsetY: 0.12, style: { '--grain-ink': Colors[tone] } };
}

export interface GrainFillProps extends GrainFillSize {
  tone: GrainFillTone;
  className?: string;
}

export function GrainFill({ tone, width, height, className }: GrainFillProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const { resolvedTheme } = useTheme();
  const layer = toneLayer(tone);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let current = true;
    element.style.backgroundImage = '';
    element.removeAttribute('data-ready');
    void grainFill(element, resolvedTheme, { width, height }, layer.offsetY).then(image => {
      if (!current || !image) return;
      element.style.backgroundImage = `url(${image})`;
      element.setAttribute('data-ready', '');
    });
    return () => {
      current = false;
    };
  }, [tone, resolvedTheme, width, height, layer.offsetY]);

  return (
    <span
      ref={ref}
      aria-hidden
      data-grain-tone={layer.dataTone}
      className={className}
      style={{
        ...layer.style,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${width}px max(${height}px, 100%)`,
      }}
    />
  );
}
