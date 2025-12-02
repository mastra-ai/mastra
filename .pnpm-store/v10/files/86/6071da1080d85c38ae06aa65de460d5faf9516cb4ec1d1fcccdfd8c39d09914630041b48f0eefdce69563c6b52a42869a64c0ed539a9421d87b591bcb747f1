import { isCSSVar } from './is-css-var.mjs';

function setStyle(element, name, value) {
    isCSSVar(name)
        ? element.style.setProperty(name, value)
        : (element.style[name] = value);
}

export { setStyle };
