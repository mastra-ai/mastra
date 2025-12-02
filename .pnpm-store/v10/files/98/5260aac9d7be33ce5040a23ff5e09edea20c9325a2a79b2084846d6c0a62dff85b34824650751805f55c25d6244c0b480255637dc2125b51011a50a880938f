#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("./index");
var args = process.argv.slice(2);
var options = {
    adjectiveCount: 1,
    addAdverb: false,
    separator: '',
    capitalize: true
};
var adverb = ['a', 'adverb', 'addadverb'];
var lower = ['l', 'lower', 'lowercase'];
var reps = 1;
for (var _i = 0, args_1 = args; _i < args_1.length; _i++) {
    var arg = args_1[_i];
    if (String(parseInt(arg)) === String(arg))
        options.adjectiveCount = parseInt(arg);
    else if (typeof arg === 'string') {
        var lc = arg.toLowerCase();
        if (adverb.includes(lc))
            options.addAdverb = true;
        else if (lower.includes(lc))
            options.capitalize = false;
        else if (lc.endsWith('x'))
            reps = parseInt(arg);
        else if (lc === 'space')
            options.separator = ' ';
        else if (!options.separator && arg.length === 1)
            options.separator = arg;
    }
}
for (var i = 0; i < reps; i++) {
    console.log((0, index_1.humanId)(options));
}
//# sourceMappingURL=cli.js.map