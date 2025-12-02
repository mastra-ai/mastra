"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrigin = exports.makeRegex = void 0;
function getNames(cert) {
    var _a, _b;
    const CN = (_a = cert.subject) === null || _a === void 0 ? void 0 : _a.CN;
    const sans = ((_b = cert.subjectaltname) !== null && _b !== void 0 ? _b : '')
        .split(',')
        .map(name => name.trim())
        .filter(name => name.startsWith('DNS:'))
        .map(name => name.substr(4));
    if (cert.subjectaltname)
        // Ignore CN if SAN:s are present; https://stackoverflow.com/a/29600674
        return [...new Set(sans)];
    else
        return [CN];
}
function makeRegex(name) {
    return "^" + name
        .split('*')
        .map(part => part.replace(/[^a-zA-Z0-9]/g, val => `\\${val}`))
        .join('[^.]+') + "$";
}
exports.makeRegex = makeRegex;
function makeMatcher(regexes) {
    return (name) => regexes.some(regex => name.match(regex));
}
function parseOrigin(cert) {
    const names = [];
    const regexes = [];
    if (cert) {
        getNames(cert).forEach(name => {
            if (name.match(/.*\*.*\*.*/))
                throw new Error(`Invalid CN/subjectAltNames: ${name}`);
            if (name.includes("*"))
                regexes.push(new RegExp(makeRegex(name)));
            else
                names.push(name);
        });
    }
    const ret = {
        names,
        ...(!regexes.length ? {} : { dynamic: makeMatcher(regexes) }),
    };
    return ret;
}
exports.parseOrigin = parseOrigin;
//# sourceMappingURL=san.js.map