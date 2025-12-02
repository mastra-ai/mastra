const TEXT_DIFF = 2;
const DEFAULT_MIN_LENGTH = 60;
let cachedDiffPatch = null;
function getDiffMatchPatch(options, required) {
    var _a;
    if (!cachedDiffPatch) {
        let instance;
        if ((_a = options === null || options === void 0 ? void 0 : options.textDiff) === null || _a === void 0 ? void 0 : _a.diffMatchPatch) {
            instance = new options.textDiff.diffMatchPatch();
        }
        else {
            if (!required) {
                return null;
            }
            const error = new Error("The diff-match-patch library was not provided. Pass the library in through the options or use the `jsondiffpatch/with-text-diffs` entry-point.");
            // eslint-disable-next-line camelcase
            error.diff_match_patch_not_found = true;
            throw error;
        }
        cachedDiffPatch = {
            diff: (txt1, txt2) => instance.patch_toText(instance.patch_make(txt1, txt2)),
            patch: (txt1, patch) => {
                const results = instance.patch_apply(instance.patch_fromText(patch), txt1);
                for (const resultOk of results[1]) {
                    if (!resultOk) {
                        const error = new Error("text patch failed");
                        error.textPatchFailed = true;
                        throw error;
                    }
                }
                return results[0];
            },
        };
    }
    return cachedDiffPatch;
}
export const diffFilter = function textsDiffFilter(context) {
    var _a, _b;
    if (context.leftType !== "string") {
        return;
    }
    const left = context.left;
    const right = context.right;
    const minLength = ((_b = (_a = context.options) === null || _a === void 0 ? void 0 : _a.textDiff) === null || _b === void 0 ? void 0 : _b.minLength) || DEFAULT_MIN_LENGTH;
    if (left.length < minLength || right.length < minLength) {
        context.setResult([left, right]).exit();
        return;
    }
    // large text, try to use a text-diff algorithm
    const diffMatchPatch = getDiffMatchPatch(context.options);
    if (!diffMatchPatch) {
        // diff-match-patch library not available,
        // fallback to regular string replace
        context.setResult([left, right]).exit();
        return;
    }
    const diff = diffMatchPatch.diff;
    context.setResult([diff(left, right), 0, TEXT_DIFF]).exit();
};
diffFilter.filterName = "texts";
export const patchFilter = function textsPatchFilter(context) {
    if (context.nested) {
        return;
    }
    const nonNestedDelta = context.delta;
    if (nonNestedDelta[2] !== TEXT_DIFF) {
        return;
    }
    const textDiffDelta = nonNestedDelta;
    // text-diff, use a text-patch algorithm
    const patch = getDiffMatchPatch(context.options, true).patch;
    context.setResult(patch(context.left, textDiffDelta[0])).exit();
};
patchFilter.filterName = "texts";
const textDeltaReverse = (delta) => {
    var _a, _b, _c;
    const headerRegex = /^@@ +-(\d+),(\d+) +\+(\d+),(\d+) +@@$/;
    const lines = delta.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined)
            continue;
        const lineStart = line.slice(0, 1);
        if (lineStart === "@") {
            const header = headerRegex.exec(line);
            if (header !== null) {
                const lineHeader = i;
                // fix header
                lines[lineHeader] =
                    `@@ -${header[3]},${header[4]} +${header[1]},${header[2]} @@`;
            }
        }
        else if (lineStart === "+") {
            lines[i] = `-${(_a = lines[i]) === null || _a === void 0 ? void 0 : _a.slice(1)}`;
            if (((_b = lines[i - 1]) === null || _b === void 0 ? void 0 : _b.slice(0, 1)) === "+") {
                // swap lines to keep default order (-+)
                const lineTmp = lines[i];
                lines[i] = lines[i - 1];
                lines[i - 1] = lineTmp;
            }
        }
        else if (lineStart === "-") {
            lines[i] = `+${(_c = lines[i]) === null || _c === void 0 ? void 0 : _c.slice(1)}`;
        }
    }
    return lines.join("\n");
};
export const reverseFilter = function textsReverseFilter(context) {
    if (context.nested) {
        return;
    }
    const nonNestedDelta = context.delta;
    if (nonNestedDelta[2] !== TEXT_DIFF) {
        return;
    }
    const textDiffDelta = nonNestedDelta;
    // text-diff, use a text-diff algorithm
    context
        .setResult([textDeltaReverse(textDiffDelta[0]), 0, TEXT_DIFF])
        .exit();
};
reverseFilter.filterName = "texts";
