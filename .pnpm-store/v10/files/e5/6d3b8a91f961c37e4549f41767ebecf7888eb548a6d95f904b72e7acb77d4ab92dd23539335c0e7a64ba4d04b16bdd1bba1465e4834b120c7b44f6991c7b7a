"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.casts = void 0;
const types_1 = require("./types");
const reachableFrom = (source, adj, seen = new Set()) => {
    const reachable = new Set();
    if (seen.has(source))
        return [];
    seen.add(source);
    (adj[source] || []).map((cast) => {
        reachable.add(cast);
        for (const item of reachableFrom(cast, adj, seen)) {
            reachable.add(item);
        }
    });
    return [...reachable];
};
const casts = async (cxn, params) => {
    const allCastsRaw = await cxn.queryJSON(`WITH MODULE schema
        SELECT Cast {
            id,
            source := .from_type { id, name },
            target := .to_type { id, name },
            allow_assignment,
            allow_implicit,
        }
        FILTER .from_type IS ScalarType
        AND .to_type IS ScalarType
        # AND .from_type.is_abstract = false
        # AND .to_type.is_abstract = false
        `);
    const allCasts = JSON.parse(allCastsRaw);
    const types = new Set();
    const typesById = {};
    const castsById = {};
    const castsBySource = {};
    const implicitCastsBySource = {};
    const implicitCastsByTarget = {};
    const assignmentCastsBySource = {};
    const assignmentCastsByTarget = {};
    for (const cast of allCasts) {
        if (types_1.typeMapping.has(cast.source.id) || types_1.typeMapping.has(cast.target.id)) {
            cast.allow_implicit = false;
            cast.allow_assignment = false;
        }
        typesById[cast.source.id] = cast.source;
        typesById[cast.target.id] = cast.target;
        types.add(cast.source.id);
        types.add(cast.target.id);
        castsById[cast.id] = cast;
        castsBySource[cast.source.id] = castsBySource[cast.source.id] || [];
        castsBySource[cast.source.id].push(cast.target.id);
        if (cast.allow_assignment || cast.allow_implicit) {
            assignmentCastsBySource[cast.source.id] ??= [];
            assignmentCastsBySource[cast.source.id].push(cast.target.id);
            assignmentCastsByTarget[cast.target.id] ??= [];
            assignmentCastsByTarget[cast.target.id].push(cast.source.id);
        }
        if (cast.allow_implicit) {
            implicitCastsBySource[cast.source.id] ??= [];
            implicitCastsBySource[cast.source.id].push(cast.target.id);
            implicitCastsByTarget[cast.target.id] ??= [];
            implicitCastsByTarget[cast.target.id].push(cast.source.id);
        }
    }
    const castMap = {};
    const implicitCastMap = {};
    const implicitCastFromMap = {};
    const assignmentCastMap = {};
    const assignableByMap = {};
    for (const type of [...types]) {
        castMap[type] = castsBySource[type] || [];
        implicitCastMap[type] = reachableFrom(type, implicitCastsBySource);
        implicitCastFromMap[type] = reachableFrom(type, implicitCastsByTarget);
        assignmentCastMap[type] = reachableFrom(type, assignmentCastsBySource);
        assignableByMap[type] = reachableFrom(type, assignmentCastsByTarget);
    }
    if (params?.debug === true) {
        console.log(`\nIMPLICIT`);
        for (const [fromId, castArr] of Object.entries(implicitCastMap)) {
            console.log(`${typesById[fromId].name} implicitly castable to: [${castArr
                .map((id) => typesById[id].name)
                .join(", ")}]`);
        }
        console.log("");
        for (const [fromId, castArr] of Object.entries(implicitCastFromMap)) {
            console.log(`${typesById[fromId].name} implicitly castable from: [${castArr
                .map((id) => typesById[id].name)
                .join(", ")}]`);
        }
        console.log(`\nASSIGNABLE TO`);
        for (const [fromId, castArr] of Object.entries(assignmentCastMap)) {
            console.log(`${typesById[fromId].name} assignable to: [${castArr
                .map((id) => typesById[id].name)
                .join(", ")}]`);
        }
        console.log(`\nASSIGNABLE BY`);
        for (const [fromId, castArr] of Object.entries(assignableByMap)) {
            console.log(`${typesById[fromId].name} assignable by: [${castArr
                .map((id) => typesById[id].name)
                .join(", ")}]`);
        }
        console.log(`\nEXPLICIT`);
        for (const [fromId, castArr] of Object.entries(castMap)) {
            console.log(`${typesById[fromId].name} castable to: [${castArr
                .map((id) => {
                return typesById[id].name;
            })
                .join(", ")}]`);
        }
    }
    return {
        castsById,
        typesById,
        castMap,
        implicitCastMap,
        implicitCastFromMap,
        assignmentCastMap,
        assignableByMap,
    };
};
exports.casts = casts;
