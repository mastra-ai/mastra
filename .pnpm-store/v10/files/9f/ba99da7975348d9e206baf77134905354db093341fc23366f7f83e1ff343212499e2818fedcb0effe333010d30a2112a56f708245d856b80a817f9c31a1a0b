# 📸 node-screenshots

`node-screenshots` is a native node.js screenshot library based on [XCap](https://github.com/nashaofu/xcap), It supports Mac, Windows, and Linux systems without any dependencies. `node-screenshots` supports screenshot and video recording (to be implemented).

English | [简体中文](README-zh_CN.md)

## Support Matrix

### Operating System

| Operating System | node16 | node18 | node20 |
| ---------------- | ------ | ------ | ------ |
| Windows x64      | ✓      | ✓      | ✓      |
| Windows x32      | ✓      | ✓      | ✓      |
| Windows arm64    | ✓      | ✓      | ✓      |
| macOS x64        | ✓      | ✓      | ✓      |
| macOS arm64      | ✓      | ✓      | ✓      |
| Linux x64 gnu    | ✓      | ✓      | ✓      |
| Linux x64 musl   | ✓      | ✓      | ✓      |

## Example

### Monitor

```ts
const fs = require("fs");
const { Monitor } = require("node-screenshots");

let monitor = Monitor.fromPoint(100, 100);

console.log(monitor, monitor.id);

let image = monitor.captureImageSync();
fs.writeFileSync(`${monitor.id}-sync.png`, image.toPngSync());

monitor.captureImage().then((data) => {
  console.log(data);
  fs.writeFileSync(`${monitor.id}.jpeg`, data.toJpegSync());
});

let monitors = Monitor.all();

monitors.forEach((capturer) => {
  console.log({
    id: capturer.id,
    x: capturer.x,
    y: capturer.y,
    width: capturer.width,
    height: capturer.height,
    rotation: capturer.rotation,
    scaleFactor: capturer.scaleFactor,
    isPrimary: capturer.isPrimary,
  });
});
```

### Window

```ts
const fs = require("fs");
const { Window } = require("node-screenshots");

let windows = Window.all();

windows.forEach((item) => {
  console.log({
    id: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    scaleFactor: item.scaleFactor,
    isPrimary: item.isPrimary,
  });

  let image = item.captureImageSync();
  fs.writeFileSync(`${item.id}-sync.bmp`, image.toBmpSync());

  item.captureImage().then(async (data) => {
    console.log(data);
    let newImage = await data.crop(10, 10, 10, 10);
    fs.writeFileSync(`${item.id}.png`, await newImage.toPng());
  });
});
```

## API

Full typeScript type definition: [index.d.ts](./index.d.ts)

### Monitor

- `static all(): Array<Monitor>`: Get all monitor
- `static fromPoint(x: number, y: number): Monitor | null`: Get a monitor from the specified coordinates
- `captureImageSync(): Image`: Synchronously capture image
- `captureImage(): Promise<Image>`: Asynchronously capture image

### Window

- `static all(): Array<Window>`: Get all window
- `captureImageSync(): Image`: Synchronously capture image
- `captureImage(): Promise<Image>`: Asynchronously capture image

### Image

- `cropSync(x: number, y: number, width: number, height: number): Image`: Synchronously crop image
- `crop(x: number, y: number, width: number, height: number): Promise<Image>`: Asynchronously crop image
- `toPngSync(copyOutputData?: boolean | undefined | null): Buffer`:Synchronously Convert to png
- `toPng(copyOutputData?: boolean | undefined | null): Promise<Buffer>`: Asynchronously Convert to png
- `toJpegSync(copyOutputData?: boolean | undefined | null): Buffer`: Synchronously Convert to jpeg
- `toJpeg(copyOutputData?: boolean | undefined | null): Promise<Buffer>`: Asynchronously Convert to jpeg
- `toBmpSync(copyOutputData?: boolean | undefined | null): Buffer`: Synchronously Convert to bmp
- `toBmp(copyOutputData?: boolean | undefined | null): Promise<Buffer>`: Asynchronously Convert to bmp
- `toRawSync(copyOutputData?: boolean | undefined | null): Buffer`: Synchronously Convert to raw(RGBA data)
- `toRaw(copyOutputData?: boolean | undefined | null): Promise<Buffer>`: Asynchronously Convert to raw(RGBA data)

`copyOutputData`: pass related parameters in electron, otherwise electron will crash, nodejs does not pass or passes false, performance will be better, for more information refer to https://github.com/napi-rs/napi-rs/issues/1346

## Linux System Requirements

On Linux, you need to install `libxcb`, `libxrandr`, and `dbus`.

Debian / Ubuntu:

```sh
apt-get install libxcb1 libxrandr2 libdbus-1-3
```

Alpine:

```sh
apk add libxcb libxrandr dbus
```

## Related Repositories

- [xcap](https://github.com/nashaofu/xcap) - XCap is a cross-platform screen capture library written in Rust
