# `css-box-model` 📦

Get accurate and well named [CSS Box Model](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Box_Model/Introduction_to_the_CSS_box_model) information about a [`Element`](https://developer.mozilla.org/en-US/docs/Web/API/Element).

[![Build Status](https://travis-ci.org/alexreardon/css-box-model.svg?branch=master)](https://travis-ci.org/alexreardon/css-box-model)
[![npm](https://img.shields.io/npm/v/css-box-model.svg)](https://www.npmjs.com/package/css-box-model)
[![dependencies](https://david-dm.org/alexreardon/css-box-model.svg)](https://david-dm.org/alexreardon/css-box-model)
[![Downloads per month](https://img.shields.io/npm/dm/css-box-model.svg)](https://www.npmjs.com/package/css-box-model)
[![min](https://img.shields.io/bundlephobia/min/css-box-model.svg)](https://www.npmjs.com/package/css-box-model)
[![minzip](https://img.shields.io/bundlephobia/minzip/css-box-model.svg)](https://www.npmjs.com/package/css-box-model)

Any time you are using [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) you might want to consider using `css-box-model` instead to get more detailed box model information.

## Usage

```js
// @flow
import { getBox } from 'css-box-model';

const el: HTMLElement = document.getElementById('foo');
const box: BoxModel = getBox(el);

// profit
```

## Installation

```bash
## yarn
yarn add css-box-model

# npm
npm install css-box-model --save
```

## The [CSS Box Model](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Box_Model/Introduction_to_the_CSS_box_model)

![the box model](https://user-images.githubusercontent.com/2182637/46847224-f8a23e80-ce2e-11e8-80d6-0ca62a1871a7.png)

| Box type    | Composition                         |
| ----------- | ----------------------------------- |
| Margin box  | margin + border + padding + content |
| Border box  | border + padding + content          |
| Padding box | padding + content                   |
| Content box | content                             |

This our returned `BoxModel`:

```js
export type BoxModel = {|
  // content + padding + border + margin
  marginBox: Rect,
  // content + padding + border
  borderBox: Rect,
  // content + padding
  paddingBox: Rect,
  // content
  contentBox: Rect,
  // for your own consumption
  border: Spacing,
  padding: Spacing,
  margin: Spacing,
|};

// Supporting types

// This is an extension of DOMRect and ClientRect
export type Rect = {|
  // ClientRect
  top: number,
  right: number,
  bottom: number,
  left: number,
  width: number,
  height: number,
  // DOMRect
  x: number,
  y: number,
  // Rect
  center: Position,
|};

export type Position = {|
  x: number,
  y: number,
|};

export type Spacing = {
  top: number,
  right: number,
  bottom: number,
  left: number,
};
```

## API

### `getBox`

> (el: HTMLElement) => BoxModel

Use `getBox` to return the box model for an element

### `withScroll`

> `(original: BoxModel, scroll?: Position = getWindowScroll()) => BoxModel`

This is useful if you want to know the box model for an element relative to a page

```js
const el: HTMLElement = document.getElementById('app');
const box: BoxModel = getBox(el);
const withScroll: BoxModel = withScroll(box);
```

You are welcome to pass in your own `scroll`. By default we we use the window scroll:

```js
const getWindowScroll = (): Position => ({
  x: window.pageXOffset,
  y: window.pageYOffset,
});
```

### `calculateBox`

> `(borderBox: AnyRectType, styles: CSSStyleDeclaration) => BoxModel`

This will do the box model calculations without needing to read from the DOM. This is useful if you have already got a `ClientRect` / `DOMRect` and a `CSSStyleDeclaration` as then we can skip computing these values.

```js
const el: HTMLElement = document.getElementById('app');
const borderBox: ClientRect = el.getBoundingClientRect();
const styles: CSSStyleDeclaration = window.getComputedStyles(el);

const box: BoxModel = calculateBox(borderBox, styles);
```

**`AnyRectType`** allows for simple interoperability with any rect type

```js
type AnyRectType = ClientRect | DOMRect | Rect | Spacing;
```

### `createBox`

> `({ borderBox, margin, border, padding }: CreateBoxArgs) => BoxModel`

Allows you to create a `BoxModel` by passing in a `Rect` like shape (`AnyRectType`) and optionally your own `margin`, `border` and or `padding`.

```js
type CreateBoxArgs = {|
  borderBox: AnyRectType,
  margin?: Spacing,
  border?: Spacing,
  padding?: Spacing,
|};
```

```js
const borderBox: Spacing = {
  top: 10,
  right: 100,
  left: 20,
  bottom: 80,
};
const padding: Spacing = {
  top: 10,
  right: 20,
  left: 20,
  bottom: 10,
};

const box: BoxModel = createBox({ borderBox, padding });
```

## Utility API

> Functions to help you interact with the objects we provide

### `getRect`

> `(spacing: AnyRectType) => Rect`

Given any `Rect` like shape, return a `Rect`. Accepts any object that has `top`, `right`, `bottom` and `right` (eg `ClientRect`, `DOMRect`);

```js
const spacing: Spacing = {
  top: 0,
  right: 100,
  bottom: 50,
  left: 50,
};

const rect: Rect = getRect(spacing);

console.log(rect);

/*
{
  top: 0,
  right: 100,
  bottom: 50,
  left: 50,
  width: 100,
  height: 50,
  x: 0,
  y: 0,
  center: { x: 50, y: 50 },
}
*/
```

### `expand`

Used to expand a `Spacing`

```js
(target: Spacing, expandBy: Spacing) => Spacing;
```

```js
const original: Spacing = {
  top: 10,
  left: 11,
  right: 21,
  bottom: 22,
};

const expandBy: Spacing = {
  top: 1,
  left: 2,
  right: 3,
  bottom: 4,
};

const expanded: Spacing = expand(original, expandBy);

console.log(expanded);

/*
{
  // pulled back
  top: 8,
  left: 8
  // pushed forward
  bottom: 22,
  right: 22,
}
*/
```

### `shrink`

Used to shrink a `Spacing`

```js
(target: Spacing, shrinkBy: Spacing) => Spacing;
```

```js
const original: Spacing = {
  top: 10,
  left: 10,
  right: 20,
  bottom: 20,
};

const shrinkBy: Spacing = {
  top: 2,
  left: 2,
  right: 2,
  bottom: 2,
};

const smaller: Spacing = shrink(original, shrinkBy);

console.log(smaller);

/*
{
  // pushed forward
  top: 12,
  left: 12
  // pulled back
  bottom: 18,
  right: 18,
}
*/
```
