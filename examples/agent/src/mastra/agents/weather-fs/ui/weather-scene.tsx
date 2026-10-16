import type { ReactNode } from 'react';
import type { Scene, WeatherTheme } from './weather-theme';

declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined;
  }
}

/** Deterministic pseudo-random numbers, so particles stay put across renders. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function particles<T>(count: number, seed: number, make: (random: () => number) => T): T[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => make(random));
}

const RAIN = particles(110, 7, random => ({
  x: `${random() * 125 - 5}%`,
  length: `${14 + random() * 24}px`,
  duration: `${0.45 + random() * 0.35}s`,
  delay: `${-random()}s`,
  opacity: 0.35 + random() * 0.65,
}));

const RIPPLES = particles(12, 11, random => ({
  x: `${5 + random() * 90}%`,
  bottom: `${128 + random() * 26}px`,
  delay: `${-random() * 1.3}s`,
}));

const SNOW = particles(70, 3, random => {
  const size = 2 + random() * 5;
  return {
    x: `${random() * 100}%`,
    size: `${size}px`,
    blur: size < 3.5 ? '1px' : '0px',
    opacity: 0.55 + random() * 0.45,
    duration: `${7 + random() * 9}s`,
    delay: `${-random() * 16}s`,
    sway: `${2 + random() * 2.5}s`,
    drift: `${8 + random() * 22}px`,
  };
});

const MOTES = particles(18, 5, random => ({
  x: `${random() * 100}%`,
  size: `${2 + random() * 3}px`,
  duration: `${6 + random() * 7}s`,
  delay: `${-random() * 13}s`,
  drift: `${random() * 60 - 30}px`,
}));

const GLINTS = particles(14, 13, random => ({
  x: `${random() * 100}%`,
  bottom: `${120 + random() * 40}px`,
  duration: `${1.8 + random() * 1.8}s`,
  delay: `${-random() * 3}s`,
}));

const FOG = particles(6, 17, random => ({
  y: `${random() * 75}%`,
  height: `${70 + random() * 90}px`,
  opacity: 0.3 + random() * 0.35,
  duration: `${9 + random() * 12}s`,
  delay: `${-random() * 20}s`,
}));

interface CloudSpec {
  y: string;
  width: number;
  duration: number;
  opacity: number;
  blur: number;
}

const CLOUDS: Record<Scene, CloudSpec[]> = {
  sunny: [
    { y: '22%', width: 120, duration: 70, opacity: 0.75, blur: 1 },
    { y: '40%', width: 80, duration: 52, opacity: 0.55, blur: 2 },
  ],
  cloudy: [
    { y: '6%', width: 210, duration: 60, opacity: 0.95, blur: 0 },
    { y: '18%', width: 160, duration: 44, opacity: 0.85, blur: 1 },
    { y: '30%', width: 240, duration: 80, opacity: 0.7, blur: 2 },
    { y: '42%', width: 130, duration: 36, opacity: 0.6, blur: 3 },
    { y: '12%', width: 110, duration: 30, opacity: 0.5, blur: 4 },
  ],
  rainy: [
    { y: '-4%', width: 260, duration: 48, opacity: 0.95, blur: 0 },
    { y: '8%', width: 200, duration: 36, opacity: 0.9, blur: 1 },
    { y: '18%', width: 230, duration: 58, opacity: 0.8, blur: 2 },
    { y: '2%', width: 150, duration: 28, opacity: 0.7, blur: 3 },
  ],
  stormy: [
    { y: '-6%', width: 280, duration: 30, opacity: 1, blur: 0 },
    { y: '6%', width: 220, duration: 24, opacity: 0.95, blur: 1 },
    { y: '16%', width: 250, duration: 38, opacity: 0.85, blur: 2 },
    { y: '0%', width: 170, duration: 20, opacity: 0.8, blur: 3 },
  ],
  snowy: [
    { y: '4%', width: 220, duration: 90, opacity: 0.8, blur: 2 },
    { y: '16%', width: 160, duration: 70, opacity: 0.6, blur: 3 },
  ],
  foggy: [],
};

const WAVE_WIDTH = 1600;
const WAVE_HEIGHT = 190;

/** A filled sine wave that tiles every half width, so sliding it by -50% loops seamlessly. */
function wavePath(baseline: number, amplitude: number, period: number, closed: boolean) {
  let path = `M0 ${baseline} Q ${period / 4} ${baseline - amplitude} ${period / 2} ${baseline}`;
  for (let x = period; x <= WAVE_WIDTH + 0.01; x += period / 2) path += ` T ${x} ${baseline}`;
  return closed ? `${path} L ${WAVE_WIDTH} ${WAVE_HEIGHT} L 0 ${WAVE_HEIGHT} Z` : path;
}

const WAVE_LAYERS = [
  { baseline: 40, period: 400, duration: 22, bob: 5.5, scale: 0.8, reverse: true },
  { baseline: 64, period: 800 / 3, duration: 15, bob: 4.2, scale: 1, reverse: false },
  { baseline: 90, period: 200, duration: 10, bob: 3.4, scale: 0.7, reverse: false },
];

function Parallax({ depth, children }: { depth: number; children: ReactNode }) {
  return (
    <div className="wx-par" style={{ '--d': depth }}>
      {children}
    </div>
  );
}

function Sun({ variant }: { variant: 'bright' | 'veiled' | 'pale' }) {
  return (
    <div className={`wx-sun wx-sun-${variant}`}>
      <div className="wx-sun-rays" />
      <div className="wx-sun-rays wx-sun-rays-2" />
      <div className="wx-sun-halo" />
      <div className="wx-sun-core" />
    </div>
  );
}

function Flares() {
  const flares = [
    { x: '58%', y: '30%', size: '70px', color: 'rgba(255, 220, 150, 0.35)', delay: '0s' },
    { x: '44%', y: '44%', size: '26px', color: 'rgba(255, 255, 255, 0.45)', delay: '-1.5s' },
    { x: '30%', y: '56%', size: '46px', color: 'rgba(160, 220, 255, 0.3)', delay: '-3s' },
    { x: '18%', y: '68%', size: '14px', color: 'rgba(255, 200, 255, 0.5)', delay: '-2s' },
  ];
  return (
    <>
      {flares.map(flare => (
        <span
          key={flare.x}
          className="wx-flare"
          style={{ '--x': flare.x, '--y': flare.y, '--s': flare.size, '--c': flare.color, '--delay': flare.delay }}
        />
      ))}
    </>
  );
}

function Clouds({ scene, color }: { scene: Scene; color: string }) {
  return (
    <>
      {CLOUDS[scene].map((cloud, index) => (
        <span
          key={index}
          className="wx-cloud"
          style={{
            '--y': cloud.y,
            '--w': `${cloud.width}px`,
            '--o': cloud.opacity,
            '--b': `${cloud.blur}px`,
            '--c': color,
            '--dur': `${cloud.duration}s`,
            '--delay': `${-cloud.duration * ((index * 0.37) % 1)}s`,
          }}
        />
      ))}
    </>
  );
}

function Rain({ heavy }: { heavy: boolean }) {
  const drops = heavy ? RAIN : RAIN.slice(0, 65);
  return (
    <>
      {drops.map((drop, index) => (
        <span
          key={index}
          className="wx-drop"
          style={{
            '--x': drop.x,
            '--l': drop.length,
            '--dur': drop.duration,
            '--delay': drop.delay,
            '--o': drop.opacity,
          }}
        />
      ))}
    </>
  );
}

function Lightning() {
  return (
    <>
      <div className="wx-flash" />
      <svg className="wx-bolt" viewBox="0 0 90 180" aria-hidden>
        <path d="M52 0 L18 92 L44 92 L26 180 L78 72 L50 72 L70 0 Z" fill="#fff" />
      </svg>
      <svg className="wx-bolt wx-bolt-2" viewBox="0 0 90 180" aria-hidden>
        <path d="M52 0 L18 92 L44 92 L26 180 L78 72 L50 72 L70 0 Z" fill="#e0e7ff" />
      </svg>
    </>
  );
}

function Snow() {
  return (
    <>
      {SNOW.map((flake, index) => (
        <span
          key={index}
          className="wx-flake"
          style={{ '--x': flake.x, '--dur': flake.duration, '--delay': flake.delay }}
        >
          <i
            style={{
              '--s': flake.size,
              '--b': flake.blur,
              '--o': flake.opacity,
              '--sw': flake.sway,
              '--dx': flake.drift,
            }}
          />
        </span>
      ))}
    </>
  );
}

function Fog() {
  return (
    <>
      {FOG.map((band, index) => (
        <span
          key={index}
          className="wx-fog"
          style={{
            '--y': band.y,
            '--h': band.height,
            '--o': band.opacity,
            '--dur': band.duration,
            '--delay': band.delay,
          }}
        />
      ))}
    </>
  );
}

function Waves({ scene, theme }: { scene: Scene; theme: WeatherTheme }) {
  return (
    <div className="wx-waves">
      {WAVE_LAYERS.map((layer, index) => {
        const amplitude = theme.waveAmplitude * layer.scale;
        const gradientId = `wx-wave-${scene}-${index}`;
        return (
          <div
            key={index}
            className={layer.reverse ? 'wx-wave wx-wave-reverse' : 'wx-wave'}
            style={{ '--dur': `${layer.duration / theme.waveSpeed}s`, '--bob': `${layer.bob / theme.waveSpeed}s` }}
          >
            <svg viewBox={`0 0 ${WAVE_WIDTH} ${WAVE_HEIGHT}`} preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.waves[index]} />
                  <stop offset="100%" stopColor={theme.waves[2]} />
                </linearGradient>
              </defs>
              <path d={wavePath(layer.baseline, amplitude, layer.period, true)} fill={`url(#${gradientId})`} />
              {index > 0 && (
                <path
                  d={wavePath(layer.baseline, amplitude, layer.period, false)}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth={index === 2 ? 2 : 1.2}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function Glints() {
  return (
    <>
      {GLINTS.map((glint, index) => (
        <span
          key={index}
          className="wx-glint"
          style={{ '--x': glint.x, '--b': glint.bottom, '--dur': glint.duration, '--delay': glint.delay }}
        />
      ))}
    </>
  );
}

function Ripples() {
  return (
    <>
      {RIPPLES.map((ripple, index) => (
        <span
          key={index}
          className="wx-ripple"
          style={{ '--x': ripple.x, '--b': ripple.bottom, '--delay': ripple.delay }}
        />
      ))}
    </>
  );
}

function Motes() {
  return (
    <>
      {MOTES.map((mote, index) => (
        <span
          key={index}
          className="wx-mote"
          style={{
            '--x': mote.x,
            '--s': mote.size,
            '--dur': mote.duration,
            '--delay': mote.delay,
            '--drift': mote.drift,
          }}
        />
      ))}
    </>
  );
}

interface WeatherSceneProps {
  scene: Scene;
  theme: WeatherTheme;
}

/** The animated sky, weather and sea behind the card content. */
export function WeatherScene({ scene, theme }: WeatherSceneProps) {
  const isWet = scene === 'rainy' || scene === 'stormy';

  return (
    <div className="wx-scene" data-scene={scene}>
      <div className="wx-shake">
        <div className="wx-sky" style={{ backgroundImage: theme.sky }} />
        <Parallax depth={-6}>
          {scene === 'sunny' && <Sun variant="bright" />}
          {scene === 'cloudy' && <Sun variant="veiled" />}
          {scene === 'foggy' && <Sun variant="pale" />}
        </Parallax>
        {scene === 'sunny' && (
          <Parallax depth={14}>
            <Flares />
          </Parallax>
        )}
        <Parallax depth={-10}>
          <Clouds scene={scene} color={theme.cloud} />
        </Parallax>
        {scene === 'stormy' && <Lightning />}
        {isWet && (
          <Parallax depth={4}>
            <Rain heavy={scene === 'stormy'} />
          </Parallax>
        )}
        {scene === 'snowy' && (
          <Parallax depth={8}>
            <Snow />
          </Parallax>
        )}
        {scene === 'foggy' && (
          <Parallax depth={6}>
            <Fog />
          </Parallax>
        )}
        {scene === 'sunny' && <Motes />}
        <Parallax depth={5}>
          <Waves scene={scene} theme={theme} />
          {(scene === 'sunny' || scene === 'cloudy') && <Glints />}
          {isWet && <Ripples />}
        </Parallax>
        <div className="wx-vignette" />
      </div>
    </div>
  );
}
