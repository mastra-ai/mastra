import BaseFormatter from "./base.js";
class ConsoleFormatter extends BaseFormatter {
    constructor() {
        super();
        this.includeMoveDestinations = false;
        this.brushes = getBrushes();
    }
    prepareContext(context) {
        super.prepareContext(context);
        context.indent = function (levels) {
            this.indentLevel =
                (this.indentLevel || 0) + (typeof levels === "undefined" ? 1 : levels);
            this.indentPad = new Array(this.indentLevel + 1).join("  ");
        };
        context.newLine = function () {
            this.buffer = this.buffer || [];
            this.buffer.push("\n");
            this.atNewLine = true;
        };
        context.out = function (...args) {
            var _a, _b, _c, _d;
            const color = (_a = this.color) === null || _a === void 0 ? void 0 : _a[0];
            if (this.atNewLine) {
                this.atNewLine = false;
                this.buffer = this.buffer || [];
                const linePrefix = ((_b = this.linePrefix) === null || _b === void 0 ? void 0 : _b[0])
                    ? color
                        ? color(this.linePrefix[0])
                        : this.linePrefix[0]
                    : " ";
                this.buffer.push(`${linePrefix}${this.indentPad || ""}`);
            }
            for (const arg of args) {
                const lines = arg.split("\n");
                let text = lines.join(`\n${(_d = (_c = this.linePrefix) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : " "}${this.indentPad || ""}`);
                if (color) {
                    text = color(text);
                }
                if (!this.buffer) {
                    throw new Error("console context buffer is not defined");
                }
                this.buffer.push(text);
            }
        };
        context.pushColor = function (color) {
            this.color = this.color || [];
            this.color.unshift(color);
        };
        context.popColor = function () {
            this.color = this.color || [];
            this.color.shift();
        };
        context.pushLinePrefix = function (prefix) {
            this.linePrefix = this.linePrefix || [];
            this.linePrefix.unshift(prefix);
        };
        context.popLinePrefix = function () {
            this.linePrefix = this.linePrefix || [];
            this.linePrefix.shift();
        };
    }
    typeFormattterErrorFormatter(context, err) {
        context.pushColor(this.brushes.error);
        context.out(`[ERROR]${err}`);
        context.popColor();
    }
    formatValue(context, value) {
        context.out(JSON.stringify(value, null, 2));
    }
    formatTextDiffString(context, value) {
        const lines = this.parseTextDiff(value);
        context.indent();
        context.newLine();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const underline = [];
            if (line === undefined)
                continue;
            context.pushColor(this.brushes.textDiffLine);
            const header = `${line.location.line},${line.location.chr} `;
            context.out(header);
            underline.push(new Array(header.length + 1).join(" "));
            context.popColor();
            const pieces = line.pieces;
            for (const piece of pieces) {
                const brush = this.brushes[piece.type];
                context.pushColor(brush);
                const decodedText = decodeURI(piece.text);
                context.out(decodedText);
                underline.push(new Array(decodedText.length + 1).join(piece.type === "added" ? "+" : piece.type === "deleted" ? "-" : " "));
                context.popColor();
            }
            context.newLine();
            context.pushColor(this.brushes.textDiffLine);
            context.out(underline.join(""));
            context.popColor();
            if (i < lines.length - 1) {
                context.newLine();
            }
        }
        context.indent(-1);
    }
    rootBegin(context, type, nodeType) {
        context.pushColor(this.brushes[type]);
        if (type === "node") {
            context.out(nodeType === "array" ? "[" : "{");
            context.indent();
            context.newLine();
        }
    }
    rootEnd(context, type, nodeType) {
        if (type === "node") {
            context.indent(-1);
            context.newLine();
            context.out(nodeType === "array" ? "]" : "}");
        }
        context.popColor();
    }
    nodeBegin(context, key, leftKey, type, nodeType) {
        const label = typeof leftKey === "number" && key.substring(0, 1) === "_"
            ? key.substring(1)
            : key;
        if (type === "deleted") {
            context.pushLinePrefix("-");
        }
        else if (type === "added") {
            context.pushLinePrefix("+");
        }
        context.pushColor(this.brushes[type]);
        context.out(`${label}: `);
        if (type === "node") {
            context.out(nodeType === "array" ? "[" : "{");
            context.indent();
            context.newLine();
        }
    }
    nodeEnd(context, _key, _leftKey, type, nodeType, isLast) {
        if (type === "node") {
            context.indent(-1);
            context.newLine();
            context.out(nodeType === "array" ? "]" : `}${isLast ? "" : ","}`);
        }
        if (!isLast) {
            context.newLine();
        }
        context.popColor();
        if (type === "deleted" || type === "added") {
            context.popLinePrefix();
        }
    }
    format_unchanged(context, _delta, left) {
        if (typeof left === "undefined") {
            return;
        }
        this.formatValue(context, left);
    }
    format_movedestination(context, _delta, left) {
        if (typeof left === "undefined") {
            return;
        }
        this.formatValue(context, left);
    }
    format_node(context, delta, left) {
        // recurse
        this.formatDeltaChildren(context, delta, left);
    }
    format_added(context, delta) {
        this.formatValue(context, delta[0]);
    }
    format_modified(context, delta) {
        context.pushColor(this.brushes.deleted);
        this.formatValue(context, delta[0]);
        context.popColor();
        context.out(" => ");
        context.pushColor(this.brushes.added);
        this.formatValue(context, delta[1]);
        context.popColor();
    }
    format_deleted(context, delta) {
        this.formatValue(context, delta[0]);
    }
    format_moved(context, delta) {
        context.out(`~> ${delta[1]}`);
    }
    format_textdiff(context, delta) {
        this.formatTextDiffString(context, delta[0]);
    }
}
export default ConsoleFormatter;
let defaultInstance;
export const format = (delta, left) => {
    if (!defaultInstance) {
        defaultInstance = new ConsoleFormatter();
    }
    return defaultInstance.format(delta, left);
};
export function log(delta, left) {
    console.log(format(delta, left));
}
const palette = {
    black: ["\x1b[30m", "\x1b[39m"],
    red: ["\x1b[31m", "\x1b[39m"],
    green: ["\x1b[32m", "\x1b[39m"],
    yellow: ["\x1b[33m", "\x1b[39m"],
    blue: ["\x1b[34m", "\x1b[39m"],
    magenta: ["\x1b[35m", "\x1b[39m"],
    cyan: ["\x1b[36m", "\x1b[39m"],
    white: ["\x1b[37m", "\x1b[39m"],
    gray: ["\x1b[90m", "\x1b[39m"],
    bgBlack: ["\x1b[40m", "\x1b[49m"],
    bgRed: ["\x1b[41m", "\x1b[49m"],
    bgGreen: ["\x1b[42m", "\x1b[49m"],
    bgYellow: ["\x1b[43m", "\x1b[49m"],
    bgBlue: ["\x1b[44m", "\x1b[49m"],
    bgMagenta: ["\x1b[45m", "\x1b[49m"],
    bgCyan: ["\x1b[46m", "\x1b[49m"],
    bgWhite: ["\x1b[47m", "\x1b[49m"],
    blackBright: ["\x1b[90m", "\x1b[39m"],
    redBright: ["\x1b[91m", "\x1b[39m"],
    greenBright: ["\x1b[92m", "\x1b[39m"],
    yellowBright: ["\x1b[93m", "\x1b[39m"],
    blueBright: ["\x1b[94m", "\x1b[39m"],
    magentaBright: ["\x1b[95m", "\x1b[39m"],
    cyanBright: ["\x1b[96m", "\x1b[39m"],
    whiteBright: ["\x1b[97m", "\x1b[39m"],
    bgBlackBright: ["\x1b[100m", "\x1b[49m"],
    bgRedBright: ["\x1b[101m", "\x1b[49m"],
    bgGreenBright: ["\x1b[102m", "\x1b[49m"],
    bgYellowBright: ["\x1b[103m", "\x1b[49m"],
    bgBlueBright: ["\x1b[104m", "\x1b[49m"],
    bgMagentaBright: ["\x1b[105m", "\x1b[49m"],
    bgCyanBright: ["\x1b[106m", "\x1b[49m"],
    bgWhiteBright: ["\x1b[107m", "\x1b[49m"],
};
function getBrushes() {
    var _a;
    const proc = typeof process !== "undefined" ? process : undefined;
    const argv = (proc === null || proc === void 0 ? void 0 : proc.argv) || [];
    const env = (proc === null || proc === void 0 ? void 0 : proc.env) || {};
    const colorEnabled = !env.NODE_DISABLE_COLORS &&
        !env.NO_COLOR &&
        !argv.includes("--no-color") &&
        !argv.includes("--color=false") &&
        env.TERM !== "dumb" &&
        ((env.FORCE_COLOR != null && env.FORCE_COLOR !== "0") ||
            ((_a = proc === null || proc === void 0 ? void 0 : proc.stdout) === null || _a === void 0 ? void 0 : _a.isTTY) ||
            false);
    const replaceClose = (text, close, replace, index) => {
        let result = "";
        let cursor = 0;
        let currentIndex = index;
        do {
            result += text.substring(cursor, index) + replace;
            cursor = index + close.length;
            currentIndex = text.indexOf(close, cursor);
        } while (~currentIndex);
        return result + text.substring(cursor);
    };
    const brush = (open, close, replace = open) => {
        if (!colorEnabled)
            return (value) => String(value);
        return (value) => {
            const text = String(value);
            const index = text.indexOf(close, open.length);
            return ~index
                ? open + replaceClose(text, close, replace, index) + close
                : open + text + close;
        };
    };
    const combineBrushes = (...brushes) => {
        return (value) => {
            let result = String(value);
            for (const brush of brushes) {
                result = brush(result);
            }
            return result;
        };
    };
    const colors = {
        added: brush(...palette.green),
        deleted: brush(...palette.red),
        movedestination: brush(...palette.gray),
        moved: brush(...palette.yellow),
        unchanged: brush(...palette.gray),
        error: combineBrushes(brush(...palette.whiteBright), brush(...palette.bgRed)),
        textDiffLine: brush(...palette.gray),
        context: undefined,
        modified: undefined,
        textdiff: undefined,
        node: undefined,
        unknown: undefined,
    };
    return colors;
}
