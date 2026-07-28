---
name: Mastra Code Factory
description: A crisp operational interface for coordinating and inspecting agent-driven software delivery.
colors:
  canvas: "oklch(0% 0 0deg)"
  panel: "oklch(16% 0 0deg)"
  panel-raised: "oklch(18% 0 0deg)"
  panel-muted: "oklch(21.78% 0 0deg)"
  text-strong: "oklch(0.985 0 0)"
  text-muted: "oklch(0.705 0 0)"
  border-subtle: "oklch(100% 0 0deg / 7%)"
  signal-green: "oklch(0.723 0.219 149.579)"
  alert-red: "oklch(0.637 0.237 25.331)"
  comparison-blue: "oklch(0.623 0.214 259.815)"
  warning-amber: "oklch(0.769 0.188 70.08)"
typography:
  headline:
    fontFamily: "system-ui, ui-sans-serif, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
  title:
    fontFamily: "system-ui, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  body:
    fontFamily: "system-ui, ui-sans-serif, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "14px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.text-strong}"
    textColor: "{colors.canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  button-default:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  input-default:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
  dashboard-panel:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
---

# Design System: Mastra Code Factory

## Overview

**Creative North Star: "The Factory Instrument Panel"**

The interface behaves like a well-made instrument panel: operational state is immediately readable, controls are familiar, and every accent communicates status, selection, or movement. Dense information is organized through hierarchy and alignment rather than decorative containers.

The system is crisp, restrained, and adaptive across dark and light themes. It rejects presentation-only executive dashboards, dense terminal-style monitoring consoles, decorative marketing analytics, glass effects, oversized rounded cards, and repetitive grids of visually identical stat cards.

**Key Characteristics:**
- Compact but never cramped
- Tonal surface layering with quiet borders
- Tabular, aligned data for rapid comparison
- Signal colors used only for state and emphasis
- Responsive state transitions with reduced-motion support

## Colors

The palette is neutral-first. Signal colors are rare enough to retain meaning against the monochrome surface hierarchy.

### Primary
- **Signal Green:** Healthy flow, active automation, positive outcomes, and the current successful state.

### Secondary
- **Alert Red:** Errors, destructive states, and critical queue age.
- **Comparison Blue:** Neutral comparative series and informational states.
- **Warning Amber:** Aging work, caution, and threshold proximity.

### Neutral
- **Carbon Canvas:** The default dark application perimeter.
- **Instrument Panel:** The primary content surface.
- **Raised Control:** Interactive controls and grouped readouts.
- **Precision Ink:** Primary labels and numeric values.
- **Muted Annotation:** Supporting copy, units, and secondary context.
- **Hairline Divider:** Quiet structural separation between related regions.

### Named Rules

**The Signal Rarity Rule.** Accent colors identify state, selection, or data series; they never decorate neutral content.

**The Dual-Encoding Rule.** Every status color is paired with a label, icon, pattern, or position so meaning survives color-vision differences.

## Typography

**Display Font:** System UI sans-serif
**Body Font:** System UI sans-serif
**Label/Mono Font:** System UI monospace

**Character:** One neutral sans family keeps the application familiar and fast to parse. Monospace is reserved for identifiers, compact status labels, and aligned operational values—not body copy.

### Hierarchy
- **Headline** (500, 1.25rem, 1.4): Page and primary section titles.
- **Title** (500, 0.875rem, 1.43): Panel headings and strong labels.
- **Body** (400, 0.8125rem, 1.5): Descriptions, rows, and supporting context.
- **Label** (400, 0.625rem, 1.6): Compact metadata and status annotations.

### Named Rules

**The Readout Rule.** Quantitative values use tabular numerals, deliberate alignment, and a tighter hierarchy than editorial display type.

## Elevation

Depth comes from tonal layering and restrained borders. Resting dashboard surfaces remain flat; shadows are reserved for floating dialogs, popovers, tooltips, and the main application frame. State changes use the standard 200ms ease-out transition and become instant or crossfaded when reduced motion is requested.

### Shadow Vocabulary
- **Main Frame:** A restrained ambient shadow on the application frame in light mode; dark mode relies primarily on surface contrast.
- **Dialog:** A focused two-layer shadow for modal and floating overlay separation.
- **Focus Ring:** A low-opacity green halo paired with a visible border change for keyboard focus.

### Named Rules

**The Tonal-First Rule.** If a resting panel needs a shadow to be understood, its hierarchy or spacing is wrong.

## Components

### Buttons

Instrument-grade controls: compact, familiar, and explicit about interaction state.

- **Shape:** Text controls are full pills; icon controls are circular.
- **Primary:** High-contrast ink-on-canvas treatment, reserved for the screen's main action.
- **Hover / Focus:** A 200ms ease-out tone shift, visible focus border, and no decorative movement.
- **Secondary / Ghost:** Neutral tonal changes preserve hierarchy without competing with primary actions.

### Chips

- **Style:** Compact monospace labels in full pills with subtle borders and semantic tinted backgrounds.
- **State:** Text and color change together; selected and alert states never rely on hue alone.

### Cards / Containers

- **Corner Style:** Gently curved panels (10–14px); never inflated beyond the established extra-large radius.
- **Background:** Adjacent neutral tones distinguish canvas, page, and raised readouts.
- **Shadow Strategy:** Flat at rest; floating UI follows the Elevation vocabulary.
- **Border:** One quiet hairline when tonal separation alone is insufficient.
- **Internal Padding:** 12–16px for compact cards; 24px only for page-level groupings.

### Inputs / Fields

- **Style:** Full-pill fields on a raised neutral surface with clear placeholder contrast.
- **Focus:** Border and focus-ring treatment are both visible; focus is never communicated by color alone.
- **Error / Disabled:** Error retains readable text and `aria-invalid`; disabled controls reduce emphasis without disappearing.

### Navigation

Navigation stays visually quiet until hover or active state. Active destinations receive a stronger neutral surface and `aria-current`; mobile and desktop retain the same labels and hierarchy.

### Operational Data Panels

Charts, progress bars, tables, and KPI readouts share aligned headers, tabular numerals, terse annotations, and direct drill-down. Each visualization includes a text summary or labels sufficient to understand the state without color.

## Do's and Don'ts

### Do:
- **Do** lead with Factory flow, bottlenecks, and active work before secondary breakdowns.
- **Do** align quantitative values with tabular numerals and consistent units.
- **Do** use the 4/8/12/16/24/32px spacing rhythm and established 4/6/10/14px corner scale.
- **Do** use Signal Green, Alert Red, Comparison Blue, and Warning Amber only for semantic state or data comparison.
- **Do** preserve WCAG AA contrast, keyboard reachability, visible focus, reduced motion, and color-independent meaning.

### Don't:
- **Don't** build presentation-only executive dashboards or decorative marketing analytics.
- **Don't** turn operational screens into dense terminal-style monitoring consoles.
- **Don't** use glass effects, oversized rounded cards, or repetitive grids of visually identical stat cards.
- **Don't** add decorative gradients, accent side stripes, or large soft shadows to resting panels.
- **Don't** encode status through color alone or suppress labels to make charts look cleaner.
