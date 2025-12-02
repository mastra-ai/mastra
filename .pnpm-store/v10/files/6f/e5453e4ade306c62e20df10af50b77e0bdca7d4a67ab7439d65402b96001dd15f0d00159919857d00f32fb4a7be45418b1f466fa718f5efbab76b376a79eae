function filterViewAnimations(animation) {
    const { effect } = animation;
    if (!effect)
        return false;
    return (effect.target === document.documentElement &&
        effect.pseudoElement?.startsWith("::view-transition"));
}
function getViewAnimations() {
    return document.getAnimations().filter(filterViewAnimations);
}

export { getViewAnimations };
