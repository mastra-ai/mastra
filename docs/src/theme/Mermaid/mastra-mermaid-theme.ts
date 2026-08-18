import type { MermaidConfig } from 'mermaid'

const FONT_SANS = "'Inter', 'Inter Fallback', -apple-system, BlinkMacSystemFont, helvetica, arial, sans-serif"
const FONT_MONO = "'Geist Mono', 'Geist Mono Fallback', Menlo, Consolas, Monaco, monospace"

type Palette = {
  background: string
  nodeBg: string
  nodeBorder: string
  nodeText: string
  clusterBg: string
  clusterBorder: string
  line: string
  text: string
  accent: string
  accentText: string
  muted: string
  noteBg: string
  noteText: string
  accentBg: string
  accentBorder: string
  accentTextOn: string
  pendingBg: string
  pendingBorder: string
  pendingText: string
  dangerBg: string
  dangerBorder: string
  dangerText: string
}

const light: Palette = {
  background: '#ededed',
  nodeBg: '#ffffff',
  nodeBorder: '#cccccc',
  nodeText: '#080808',
  clusterBg: '#f2f2f2',
  clusterBorder: '#e0e0e0',
  line: '#8f8f8f',
  text: '#141414',
  accent: '#0d8020',
  accentText: '#ffffff',
  muted: '#737272',
  noteBg: '#f0f0f0',
  noteText: '#494949',
  accentBg: '#e7f4ea',
  accentBorder: '#0d8020',
  accentTextOn: '#085314',
  pendingBg: '#fdf1e3',
  pendingBorder: '#b45309',
  pendingText: '#8a4008',
  dangerBg: '#fdeaea',
  dangerBorder: '#d81717',
  dangerText: '#a51111',
}

const dark: Palette = {
  background: '#121212',
  nodeBg: '#1c1c1c',
  nodeBorder: '#343434',
  nodeText: '#ffffff',
  clusterBg: '#0d0d0d',
  clusterBorder: '#242424',
  line: '#787878',
  text: '#e6e6e6',
  accent: '#18fb6f',
  accentText: '#050505',
  muted: '#9d9d9d',
  noteBg: '#171717',
  noteText: '#9d9d9d',
  accentBg: '#0e2417',
  accentBorder: '#18fb6f',
  accentTextOn: '#62f69d',
  pendingBg: '#2a2010',
  pendingBorder: '#fbbf24',
  pendingText: '#fcd34d',
  dangerBg: '#2a1414',
  dangerBorder: '#fa7b6a',
  dangerText: '#fca79a',
}

function semanticClassCSS(name: string, bg: string, border: string, text: string) {
  return [
    `.node.${name} rect, .node.${name} circle, .node.${name} ellipse, .node.${name} polygon, .node.${name} path {`,
    `  fill: ${bg} !important; stroke: ${border} !important;`,
    `}`,
    `.node.${name} .nodeLabel, .node.${name} .nodeLabel p, .node.${name} span {`,
    `  color: ${text} !important; fill: ${text} !important;`,
    `}`,
  ].join('\n')
}

// Mermaid does not put edge classes on the rendered path, but it does keep the
// author-supplied edge id. Name an edge `accent1`, `pending2`, `danger1` and it
// picks up the matching color in both light and dark mode.
function semanticEdgeCSS(name: string, color: string) {
  return [
    `.edgePaths path[id*="-${name}"], path.flowchart-link[id*="-${name}"] {`,
    `  stroke: ${color} !important;`,
    `}`,
  ].join('\n')
}

function themeVariables(p: Palette, isDark: boolean) {
  return {
    darkMode: isDark,
    background: p.background,
    fontFamily: FONT_SANS,
    fontSize: '16px',

    primaryColor: p.nodeBg,
    primaryBorderColor: p.nodeBorder,
    primaryTextColor: p.nodeText,
    secondaryColor: p.clusterBg,
    secondaryBorderColor: p.clusterBorder,
    secondaryTextColor: p.text,
    tertiaryColor: p.clusterBg,
    tertiaryBorderColor: p.clusterBorder,
    tertiaryTextColor: p.text,

    mainBkg: p.nodeBg,
    nodeBorder: p.nodeBorder,
    nodeTextColor: p.nodeText,
    textColor: p.text,
    lineColor: p.line,
    defaultLinkColor: p.line,
    titleColor: p.text,

    clusterBkg: p.clusterBg,
    clusterBorder: p.clusterBorder,
    edgeLabelBackground: p.background,

    noteBkgColor: p.noteBg,
    noteTextColor: p.noteText,
    noteBorderColor: p.nodeBorder,

    actorBkg: p.nodeBg,
    actorBorder: p.nodeBorder,
    actorTextColor: p.nodeText,
    actorLineColor: p.line,
    signalColor: p.text,
    signalTextColor: p.text,
    labelBoxBkgColor: p.nodeBg,
    labelBoxBorderColor: p.nodeBorder,
    labelTextColor: p.nodeText,
    loopTextColor: p.text,
    activationBkgColor: p.clusterBg,
    activationBorderColor: p.nodeBorder,
    sequenceNumberColor: p.accentText,

    altBackground: p.clusterBg,
    labelColor: p.nodeText,
    classText: p.nodeText,

    pie1: p.accent,
    pie2: p.muted,
    pie3: p.nodeBorder,
    pieStrokeColor: p.background,
    pieOuterStrokeColor: p.nodeBorder,
    pieTitleTextColor: p.text,
    pieSectionTextColor: p.accentText,
    pieLegendTextColor: p.text,
    pieOpacity: '1',
  }
}

export function mastraMermaidConfig(colorMode: 'light' | 'dark'): MermaidConfig {
  const isDark = colorMode === 'dark'
  const palette = isDark ? dark : light

  return {
    startOnLoad: false,
    theme: 'base',
    layout: 'elk',
    fontFamily: FONT_SANS,
    themeVariables: themeVariables(palette, isDark),
    flowchart: {
      curve: 'linear',
      padding: 16,
      nodeSpacing: 40,
      rankSpacing: 60,
      useMaxWidth: true,
    },
    elk: {
      mergeEdges: false,
      nodePlacementStrategy: 'BRANDES_KOEPF',
    },
    sequence: {
      useMaxWidth: true,
      actorMargin: 56,
      boxMargin: 12,
      mirrorActors: false,
    },
    themeCSS: [
      `.edgeLabel, .edgeLabel p { font-family: ${FONT_MONO}; font-size: 12px; }`,
      `.nodeLabel, .cluster-label { letter-spacing: -0.01em; }`,
      `.marker { stroke: ${palette.line}; fill: ${palette.line}; }`,
      `.node rect, .node circle, .node polygon, .node path { stroke-width: 1px; }`,
      `.cluster rect { stroke-width: 1px; rx: 8; ry: 8; }`,
      semanticClassCSS('accent', palette.accentBg, palette.accentBorder, palette.accentTextOn),
      semanticClassCSS('pending', palette.pendingBg, palette.pendingBorder, palette.pendingText),
      semanticClassCSS('danger', palette.dangerBg, palette.dangerBorder, palette.dangerText),
      semanticEdgeCSS('accent', palette.accentBorder),
      semanticEdgeCSS('pending', palette.pendingBorder),
      semanticEdgeCSS('danger', palette.dangerBorder),
    ].join('\n'),
  }
}
