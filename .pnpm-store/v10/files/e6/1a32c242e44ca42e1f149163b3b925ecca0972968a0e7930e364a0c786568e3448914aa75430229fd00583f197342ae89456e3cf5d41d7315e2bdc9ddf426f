"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeMapping = void 0;
exports.getTypes = getTypes;
exports.types = getTypes;
exports.topoSort = topoSort;
exports.getTypes = getTypes;
exports.types = getTypes;
const strictMap_1 = require("../strictMap");
const numberType = {
    id: "00000000-0000-0000-0000-0000000001ff",
    name: "std::number",
    is_abstract: false,
    is_seq: false,
    kind: "scalar",
    enum_values: null,
    material_id: null,
    bases: [],
};
exports.typeMapping = new Map([
    [
        "00000000-0000-0000-0000-000000000103",
        numberType,
    ],
    [
        "00000000-0000-0000-0000-000000000104",
        numberType,
    ],
    [
        "00000000-0000-0000-0000-000000000105",
        numberType,
    ],
    [
        "00000000-0000-0000-0000-000000000106",
        numberType,
    ],
    [
        "00000000-0000-0000-0000-000000000107",
        numberType,
    ],
]);
async function getTypes(cxn, params) {
    const debug = params?.debug === true;
    const version = await cxn.queryRequiredSingle(`select sys::get_version().major;`);
    const v2Plus = version >= 2;
    const v4Plus = version >= 4;
    const QUERY = `
    WITH
      MODULE schema,

      material_scalars := (
        SELECT ScalarType
        FILTER NOT .abstract
           AND NOT EXISTS .enum_values
           AND NOT EXISTS (SELECT .ancestors FILTER NOT .abstract)
      )

    SELECT Type {
      id,
      name :=
        array_join(array_agg([IS ObjectType].union_of.name), ' | ')
        IF EXISTS [IS ObjectType].union_of
        ELSE .name,
      is_abstract := .abstract,

      kind := 'object' IF Type IS ObjectType ELSE
              'scalar' IF Type IS ScalarType ELSE
              'array' IF Type IS Array ELSE
              'tuple' IF Type IS Tuple ELSE
              ${v2Plus ? `'range' IF Type IS Range ELSE` : ``}
              ${v4Plus ? `'multirange' IF Type IS MultiRange ELSE` : ``}
              'unknown',

      [IS ScalarType].enum_values,
      is_seq := 'std::sequence' in [IS ScalarType].ancestors.name,
      # for sequence (abstract type that has non-abstract ancestor)
      single material_id := (
        SELECT x := Type[IS ScalarType].ancestors
        FILTER x IN material_scalars
        LIMIT 1
      ).id,

      [IS InheritingObject].bases: {
        id
      } ORDER BY @index ASC,

      [IS ObjectType].union_of,
      [IS ObjectType].intersection_of,
      [IS ObjectType].pointers: {
        card := ("One" IF .required ELSE "AtMostOne") IF <str>.cardinality = "One" ELSE ("AtLeastOne" IF .required ELSE "Many"),
        name,
        target_id := .target.id,
        kind := 'link' IF .__type__.name = 'schema::Link' ELSE 'property',
        is_exclusive := exists (select .constraints filter .name = 'std::exclusive'),
        is_computed := len(.computed_fields) != 0,
        is_readonly := .readonly,
        has_default := EXISTS .default or ("std::sequence" in .target[IS ScalarType].ancestors.name),
        [IS Link].pointers: {
          card := ("One" IF .required ELSE "AtMostOne") IF <str>.cardinality = "One" ELSE ("AtLeastOne" IF .required ELSE "Many"),
          name := '@' ++ .name,
          target_id := .target.id,
          kind := 'link' IF .__type__.name = 'schema::Link' ELSE 'property',
          is_computed := len(.computed_fields) != 0,
          is_readonly := .readonly
        } filter .name != '@source' and .name != '@target',
      } FILTER any(@is_owned),
      exclusives := assert_distinct((
        [is schema::ObjectType].constraints
        union
        [is schema::ObjectType].pointers.constraints
      ) {
        target := (.subject[is schema::Property].name ?? .subject[is schema::Link].name ?? .subjectexpr)
      } filter .name = 'std::exclusive'),
      backlinks := (
         SELECT DETACHED Link
         FILTER .target = Type
           AND NOT EXISTS .source[IS ObjectType].union_of
        ) {
        card := "AtMostOne"
          IF
          EXISTS (select .constraints filter .name = 'std::exclusive')
          ELSE
          "Many",
        name := '<' ++ .name ++ '[is ' ++ assert_exists(.source.name) ++ ']',
        stub := .name,
        target_id := .source.id,
        kind := 'link',
        is_exclusive := (EXISTS (select .constraints filter .name = 'std::exclusive')) AND <str>.cardinality = "One",
      },
      backlink_stubs := array_agg((
        WITH
          stubs := DISTINCT (SELECT DETACHED Link FILTER .target = Type).name,
          baseObjectId := (SELECT DETACHED ObjectType FILTER .name = 'std::BaseObject' LIMIT 1).id
        FOR stub in { stubs }
        UNION (
          SELECT {
            card := "Many",
            name := '<' ++ stub,
            target_id := baseObjectId,
            kind := 'link',
            is_exclusive := false,
          }
        )
      )),
      array_element_id := [IS Array].element_type.id,

      tuple_elements := (SELECT [IS Tuple].element_types {
        target_id := .type.id,
        name
      } ORDER BY @index ASC),
      ${v2Plus ? `range_element_id := [IS Range].element_type.id,` : ``}
      ${v4Plus
        ? `multirange_element_id := [IS MultiRange].element_type.id,`
        : ``}
    }
    ORDER BY .name;
  `;
    const _types = JSON.parse(await cxn.queryJSON(QUERY));
    if (debug)
        console.log(JSON.stringify(_types, null, 2));
    for (const type of _types) {
        if (Array.isArray(type.backlinks)) {
            for (const backlink of type.backlinks) {
                const isName = backlink.name.match(/\[is (.+)\]/)[1];
                if (isName.split("::").length === 2 && isName.startsWith("default::")) {
                    backlink.name = backlink.name.replace(/\[is (.+)\]/, `[is ${isName.slice(9)}]`);
                }
            }
        }
        switch (type.kind) {
            case "scalar":
                if (exports.typeMapping.has(type.id)) {
                    type.cast_type = exports.typeMapping.get(type.id).id;
                }
                if (type.is_seq) {
                    type.cast_type = numberType.id;
                }
                if (type.name !== "std::sequence" &&
                    type.bases[0]?.id === type.material_id) {
                    type.cast_type =
                        exports.typeMapping.get(type.material_id)?.id ?? type.material_id;
                }
                break;
            case "multirange":
                type.multirange_element_id =
                    exports.typeMapping.get(type.multirange_element_id)?.id ??
                        type.multirange_element_id;
                break;
            case "range":
                type.range_element_id =
                    exports.typeMapping.get(type.range_element_id)?.id ?? type.range_element_id;
                break;
            case "object": {
                const ptrs = {};
                for (const ptr of type.pointers) {
                    ptrs[ptr.name] = ptr;
                }
                const rawExclusives = type.exclusives;
                const exclusives = [];
                for (const ex of rawExclusives) {
                    const target = ex.target;
                    if (target in ptrs) {
                        exclusives.push({ [ex.target]: ptrs[ex.target] });
                    }
                    if (target[0] === "(" && target[target.length - 1] === ")") {
                        const targets = target
                            .slice(1, -1)
                            .split(" ")
                            .map((t) => {
                            t = t.trim();
                            if (t[0] === ".")
                                t = t.slice(1);
                            if (t[t.length - 1] === ",")
                                t = t.slice(0, -1);
                            return t;
                        });
                        const newEx = {};
                        if (!targets.every((t) => t in ptrs)) {
                            continue;
                        }
                        for (const t of targets) {
                            newEx[t] = ptrs[t];
                        }
                        exclusives.push(newEx);
                    }
                }
                type.exclusives = exclusives;
                break;
            }
        }
    }
    _types.push(numberType);
    const types = topoSort(_types);
    for (const [_, type] of types) {
        if (type.kind === "object" && type.union_of.length) {
            const unionTypes = type.union_of.map(({ id }) => {
                const t = types.get(id);
                if (t.kind !== "object") {
                    throw new Error(`type '${t.name}' of union '${type.name}' is not an object type`);
                }
                return t;
            });
            const [first, ...rest] = unionTypes;
            const restPointerNames = rest.map((t) => new Set(t.pointers.map((p) => p.name)));
            for (const pointer of first.pointers) {
                if (restPointerNames.every((names) => names.has(pointer.name))) {
                    type.pointers.push(pointer);
                }
            }
            type.backlinks = [];
            type.backlink_stubs = [];
        }
    }
    return types;
}
function topoSort(types) {
    const graph = new strictMap_1.StrictMap();
    const adj = new strictMap_1.StrictMap();
    for (const type of types) {
        graph.set(type.id, type);
    }
    for (const type of types) {
        if (type.kind !== "object" && type.kind !== "scalar") {
            continue;
        }
        for (const { id: base } of type.bases) {
            if (!graph.has(base)) {
                throw new Error(`reference to an unknown object type: ${base}`);
            }
            if (!adj.has(type.id)) {
                adj.set(type.id, new Set());
            }
            adj.get(type.id).add(base);
        }
    }
    const visiting = new Set();
    const visited = new Set();
    const sorted = new strictMap_1.StrictMap();
    const visit = (type) => {
        if (visiting.has(type.name)) {
            const last = Array.from(visiting).slice(1, 2);
            throw new Error(`dependency cycle between ${type.name} and ${last}`);
        }
        if (!visited.has(type.id)) {
            visiting.add(type.name);
            if (adj.has(type.id)) {
                for (const adjId of adj.get(type.id).values()) {
                    visit(graph.get(adjId));
                }
            }
            sorted.set(type.id, type);
            visited.add(type.id);
            visiting.delete(type.name);
        }
    };
    for (const type of types) {
        visit(type);
    }
    return sorted;
}
