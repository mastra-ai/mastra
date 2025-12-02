"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function makeKey(protocol, origin) {
    return protocol + ":" + origin;
}
class OriginCache {
    constructor() {
        this.sessionMap = new Map();
        this.staticMap = new Map();
    }
    get(protocol, origin) {
        const key = makeKey(protocol, origin);
        const stateByStatic = this.staticMap.get(key);
        if (stateByStatic)
            return {
                protocol: stateByStatic.protocol,
                session: stateByStatic.session,
                firstOrigin: stateByStatic.firstOrigin,
            };
        const stateByDynamic = [...this.sessionMap.values()].find(state => state.protocol === protocol &&
            state.match &&
            state.match.dynamic &&
            state.match.dynamic(origin));
        if (stateByDynamic) {
            // An origin matching a dynamic (wildcard) alt-name was found.
            // Cache this to find it statically in the future.
            stateByDynamic.resolved.push(origin);
            this.staticMap.set(key, stateByDynamic);
            return {
                protocol: stateByDynamic.protocol,
                session: stateByDynamic.session,
                firstOrigin: stateByDynamic.firstOrigin,
            };
        }
    }
    set(origin, protocol, session, altNameMatch, cleanup) {
        const state = {
            protocol,
            firstOrigin: origin,
            session,
            match: altNameMatch,
            resolved: [],
            cleanup,
        };
        this.sessionMap.set(session, state);
        if (altNameMatch)
            altNameMatch.names.forEach(origin => {
                this.staticMap.set(makeKey(protocol, origin), state);
            });
        this.staticMap.set(makeKey(protocol, origin), state);
    }
    // Returns true if a session was deleted, false otherwise
    delete(session) {
        var _a, _b;
        const state = this.sessionMap.get(session);
        if (!state)
            return false;
        [
            state.firstOrigin,
            ...state.resolved,
            ...((_b = (_a = state.match) === null || _a === void 0 ? void 0 : _a.names) !== null && _b !== void 0 ? _b : []),
        ]
            .forEach(origin => {
            this.staticMap.delete(makeKey(state.protocol, origin));
        });
        this.sessionMap.delete(session);
        return true;
    }
    disconnectAll() {
        [...this.sessionMap].forEach(([_, session]) => {
            var _a;
            (_a = session.cleanup) === null || _a === void 0 ? void 0 : _a.call(session);
        });
        this.sessionMap.clear();
        this.staticMap.clear();
    }
    disconnect(origin) {
        [
            this.get('https1', origin),
            this.get('https2', origin),
            this.get('http1', origin),
            this.get('http2', origin),
        ]
            .filter((t) => !!t)
            .forEach(({ session }) => {
            var _a, _b;
            (_b = (_a = this.sessionMap.get(session)) === null || _a === void 0 ? void 0 : _a.cleanup) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.delete(session);
        });
    }
}
exports.default = OriginCache;
//# sourceMappingURL=origin-cache.js.map