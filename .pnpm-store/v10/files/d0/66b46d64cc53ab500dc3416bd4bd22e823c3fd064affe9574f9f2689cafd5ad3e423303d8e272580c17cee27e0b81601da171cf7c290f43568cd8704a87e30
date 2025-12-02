function calcChildStagger(children, child, delayChildren, staggerChildren = 0, staggerDirection = 1) {
    const index = Array.from(children)
        .sort((a, b) => a.sortNodePosition(b))
        .indexOf(child);
    const numChildren = children.size;
    const maxStaggerDuration = (numChildren - 1) * staggerChildren;
    const delayIsFunction = typeof delayChildren === "function";
    return delayIsFunction
        ? delayChildren(index, numChildren)
        : staggerDirection === 1
            ? index * staggerChildren
            : maxStaggerDuration - index * staggerChildren;
}

export { calcChildStagger };
