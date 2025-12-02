/**
 * Given a absolute or relative time definition and current/prev time state of the sequence,
 * calculate an absolute time for the next keyframes.
 */
function calcNextTime(current, next, prev, labels) {
    if (typeof next === "number") {
        return next;
    }
    else if (next.startsWith("-") || next.startsWith("+")) {
        return Math.max(0, current + parseFloat(next));
    }
    else if (next === "<") {
        return prev;
    }
    else if (next.startsWith("<")) {
        return Math.max(0, prev + parseFloat(next.slice(1)));
    }
    else {
        return labels.get(next) ?? current;
    }
}

export { calcNextTime };
