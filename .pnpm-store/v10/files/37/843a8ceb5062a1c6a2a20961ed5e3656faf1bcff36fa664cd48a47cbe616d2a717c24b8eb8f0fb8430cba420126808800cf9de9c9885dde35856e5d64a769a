/// <reference types="node"/>
/*!
 * node-progress
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * These are keys in the options object you can pass to the progress bar along with total as seen in the example above.
 */
export interface ProgressBarOptions {
  /**
   * Total number of ticks to complete.
   */
  total: number;

  /**
   * current completed index
   */
  curr?: number | undefined;

  /**
   * head character defaulting to complete character
   */
  head?: string | undefined;

  /**
   * The displayed width of the progress bar defaulting to total.
   */
  width?: number | undefined;

  /**
   * minimum time between updates in milliseconds defaulting to 16
   */
  renderThrottle?: number | undefined;

  /**
   * The output stream defaulting to stderr.
   */
  stream?: NodeJS.WritableStream | undefined;

  /**
   * Completion character defaulting to "=".
   */
  complete?: string | undefined;

  /**
   * Incomplete character defaulting to "-".
   */
  incomplete?: string | undefined;

  /**
   * Option to clear the bar on completion defaulting to false.
   */
  clear?: boolean | undefined;

  /**
   * Optional function to call when the progress bar completes.
   */
  callback?: Function | undefined;
}

export interface ProgressBarInstance {
  stream: NodeJS.WritableStream;
  fmt: string;
  curr: number;
  total: number;
  width: number;
  clear: boolean;
  chars: {
    complete: string;
    incomplete: string;
    head: string;
  };
  renderThrottle: number;
  lastRender: number;
  callback: Function;
  tokens: { [key: string]: any };
  lastDraw: string;
  complete: boolean;
  start?: Date;

  tick(tokens?: any): void;
  tick(count?: number, tokens?: any): void;
  render(tokens?: any, force?: boolean): void;
  update(ratio: number, tokens?: any): void;
  interrupt(message: string): void;
  terminate(): void;
}

interface ProgressBarConstructor {
  new (format: string, total: number): ProgressBarInstance;
  new (format: string, options: ProgressBarOptions): ProgressBarInstance;
  prototype: ProgressBarInstance;
}

/**
 * Initialize a `ProgressBar` with the given `fmt` string and `options` or
 * `total`.
 *
 * Options:
 *
 *   - `curr` current completed index
 *   - `total` total number of ticks to complete
 *   - `width` the displayed width of the progress bar defaulting to total
 *   - `stream` the output stream defaulting to stderr
 *   - `head` head character defaulting to complete character
 *   - `complete` completion character defaulting to "="
 *   - `incomplete` incomplete character defaulting to "-"
 *   - `renderThrottle` minimum time between updates in milliseconds defaulting to 16
 *   - `callback` optional function to call when the progress bar completes
 *   - `clear` will clear the progress bar upon termination
 *
 * Tokens:
 *
 *   - `:bar` the progress bar itself
 *   - `:current` current tick number
 *   - `:total` total ticks
 *   - `:elapsed` time elapsed in seconds
 *   - `:percent` completion percentage
 *   - `:eta` eta in seconds
 *   - `:rate` rate of ticks per second
 *
 * @param {string} fmt
 * @param {object|number} options or total
 * @api public
 */
const ProgressBar: ProgressBarConstructor = function (
  this: ProgressBarInstance,
  fmt: string,
  options: ProgressBarOptions | number,
) {
  this.stream = (options as ProgressBarOptions).stream || process.stderr;

  if (typeof options == "number") {
    var total = options;
    options = {} as ProgressBarOptions;
    (options as ProgressBarOptions).total = total;
  } else {
    options = options || ({} as ProgressBarOptions);
    if ("string" != typeof fmt) throw new Error("format required");
    if ("number" != typeof (options as ProgressBarOptions).total)
      throw new Error("total required");
  }

  this.fmt = fmt;
  this.curr = (options as ProgressBarOptions).curr || 0;
  this.total = (options as ProgressBarOptions).total;
  this.width = (options as ProgressBarOptions).width || this.total;
  this.clear = (options as ProgressBarOptions).clear || false;
  this.chars = {
    complete: (options as ProgressBarOptions).complete || "=",
    incomplete: (options as ProgressBarOptions).incomplete || "-",
    head:
      (options as ProgressBarOptions).head ||
      (options as ProgressBarOptions).complete ||
      "=",
  };
  this.renderThrottle =
    (options as ProgressBarOptions).renderThrottle !== 0
      ? (options as ProgressBarOptions).renderThrottle || 16
      : 0;
  this.lastRender = -Infinity;
  this.callback = (options as ProgressBarOptions).callback || function () {};
  this.tokens = {};
  this.lastDraw = "";
  this.complete = false;
} as any;

/**
 * "tick" the progress bar with optional `len` and optional `tokens`.
 *
 * @param {number|object} len or tokens
 * @param {object} tokens
 * @api public
 */
ProgressBar.prototype.tick = function (
  this: ProgressBarInstance,
  len?: number | any,
  tokens?: any,
): void {
  if (len !== 0) len = len || 1;

  // swap tokens
  if ("object" == typeof len) ((tokens = len), (len = 1));
  if (tokens) this.tokens = tokens;

  // start time for eta
  if (0 == this.curr) this.start = new Date();

  this.curr += len;

  // try to render
  this.render();

  // progress complete
  if (this.curr >= this.total) {
    this.render(undefined, true);
    this.complete = true;
    this.terminate();
    this.callback(this);
    return;
  }
};

/**
 * Method to render the progress bar with optional `tokens` to place in the
 * progress bar's `fmt` field.
 *
 * @param {object} tokens
 * @api public
 */
ProgressBar.prototype.render = function (
  this: ProgressBarInstance,
  tokens?: any,
  force?: boolean,
): void {
  force = force !== undefined ? force : false;
  if (tokens) this.tokens = tokens;

  if (!(this.stream as any).isTTY) return;

  var now = Date.now();
  var delta = now - this.lastRender;
  if (!force && delta < this.renderThrottle) {
    return;
  } else {
    this.lastRender = now;
  }

  var ratio = this.curr / this.total;
  ratio = Math.min(Math.max(ratio, 0), 1);

  var percent = Math.floor(ratio * 100);
  var incomplete: string, complete: string, completeLength: number;
  var elapsed = this.start ? new Date().getTime() - this.start.getTime() : 0;
  var eta = percent == 100 ? 0 : elapsed * (this.total / this.curr - 1);
  var rate = this.curr / (elapsed / 1000);

  /* populate the bar template with percentages and timestamps */
  var str = this.fmt
    .replace(":current", this.curr.toString())
    .replace(":total", this.total.toString())
    .replace(":elapsed", isNaN(elapsed) ? "0.0" : (elapsed / 1000).toFixed(1))
    .replace(
      ":eta",
      isNaN(eta) || !isFinite(eta) ? "0.0" : (eta / 1000).toFixed(1),
    )
    .replace(":percent", percent.toFixed(0) + "%")
    .replace(":rate", Math.round(rate).toString());

  /* compute the available space (non-zero) for the bar */
  var availableSpace = Math.max(
    0,
    (this.stream as any).columns - str.replace(":bar", "").length,
  );
  if (availableSpace && process.platform === "win32") {
    availableSpace = availableSpace - 1;
  }

  var width = Math.min(this.width, availableSpace);

  /* TODO: the following assumes the user has one ':bar' token */
  completeLength = Math.round(width * ratio);
  complete = Array(Math.max(0, completeLength + 1)).join(this.chars.complete);
  incomplete = Array(Math.max(0, width - completeLength + 1)).join(
    this.chars.incomplete,
  );

  /* add head to the complete string */
  if (completeLength > 0) complete = complete.slice(0, -1) + this.chars.head;

  /* fill in the actual progress bar */
  str = str.replace(":bar", complete + incomplete);

  /* replace the extra tokens */
  if (this.tokens)
    for (var key in this.tokens) str = str.replace(":" + key, this.tokens[key]);

  if (this.lastDraw !== str) {
    (this.stream as any).cursorTo(0);
    this.stream.write(str);
    (this.stream as any).clearLine(1);
    this.lastDraw = str;
  }
};

/**
 * "update" the progress bar to represent an exact percentage.
 * The ratio (between 0 and 1) specified will be multiplied by `total` and
 * floored, representing the closest available "tick." For example, if a
 * progress bar has a length of 3 and `update(0.5)` is called, the progress
 * will be set to 1.
 *
 * A ratio of 0.5 will attempt to set the progress to halfway.
 *
 * @param {number} ratio The ratio (between 0 and 1 inclusive) to set the
 *   overall completion to.
 * @api public
 */
ProgressBar.prototype.update = function (
  this: ProgressBarInstance,
  ratio: number,
  tokens?: any,
): void {
  var goal = Math.floor(ratio * this.total);
  var delta = goal - this.curr;

  this.tick(delta, tokens);
};

/**
 * "interrupt" the progress bar and write a message above it.
 * @param {string} message The message to write.
 * @api public
 */
ProgressBar.prototype.interrupt = function (
  this: ProgressBarInstance,
  message: string,
): void {
  // clear the current line
  (this.stream as any).clearLine();
  // move the cursor to the start of the line
  (this.stream as any).cursorTo(0);
  // write the message text
  this.stream.write(message);
  // terminate the line after writing the message
  this.stream.write("\n");
  // re-display the progress bar with its lastDraw
  this.stream.write(this.lastDraw);
};

/**
 * Terminates a progress bar.
 *
 * @api public
 */
ProgressBar.prototype.terminate = function (this: ProgressBarInstance): void {
  if (this.clear) {
    if ((this.stream as any).clearLine) {
      (this.stream as any).clearLine();
      (this.stream as any).cursorTo(0);
    }
  } else {
    this.stream.write("\n");
  }
};

export default ProgressBar;
