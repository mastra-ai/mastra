var bignumJSON = require('./lib');

var iterations = 10000;
var bignumJsonStr = '{ \
    "bigint": 92233720368547758074237, \
    "decimal": -9223372036854775807.4237482374983253298159, \
    "string": "hello world", \
    "boolean": true, \
    "array": [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ], \
    "object": { \
        "int": 15, \
        "float": 15.56 \
    } \
}';
var jsonStr = '{ \
    "int": 9223372, \
    "float": -0.4237482, \
    "string": "hello world", \
    "boolean": true, \
    "array": [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ], \
    "object": { \
        "int": 15, \
        "float": 15.56 \
    } \
}';

// dont count first call
var jsonObj = JSON.parse(bignumJsonStr);
var bignumObj = bignumJSON.parse(bignumJsonStr);
JSON.stringify(jsonObj);
bignumJSON.stringify(bignumObj);

// test JSON.parse

var startTime = process.hrtime();

for (var i = 0; i < iterations; i++) {
    JSON.parse(bignumJsonStr);
}

var diffTime = process.hrtime(startTime);
diffTime = (diffTime[0] * 1e9 + diffTime[1]) / 1e6;
console.log(iterations + ' calls of JSON.parse():                                   ' + diffTime.toString() + ' ms');

// test JSON.stringify

startTime = process.hrtime();

for (var i = 0; i < iterations; i++) {
    JSON.stringify(jsonObj);
}

diffTime = process.hrtime(startTime);
diffTime = (diffTime[0] * 1e9 + diffTime[1]) / 1e6;
console.log(iterations + ' calls of JSON.stringify():                               ' + diffTime.toString() + ' ms');

// test bignumJSON.parse with bignums

startTime = process.hrtime();

for (var i = 0; i < iterations; i++) {
    bignumJSON.parse(bignumJsonStr);
}

diffTime = process.hrtime(startTime);
diffTime = (diffTime[0] * 1e9 + diffTime[1]) / 1e6;
console.log(iterations + ' calls of bignumJSON.parse() with bignums in JSON:        ' + diffTime.toString() + ' ms');

// test bignumJSON.parse without bignums

startTime = process.hrtime();

for (var i = 0; i < iterations; i++) {
    bignumJSON.parse(jsonStr);
}

diffTime = process.hrtime(startTime);
diffTime = (diffTime[0] * 1e9 + diffTime[1]) / 1e6;
console.log(iterations + ' calls of bignumJSON.parse() without bignums in JSON:     ' + diffTime.toString() + ' ms');

// test bignumJSON.stringify with bignums

startTime = process.hrtime();

for (var i = 0; i < iterations; i++) {
    bignumJSON.stringify(bignumObj);
}

diffTime = process.hrtime(startTime);
diffTime = (diffTime[0] * 1e9 + diffTime[1]) / 1e6;
console.log(iterations + ' calls of bignumJSON.stringify() with bignums in JSON:    ' + diffTime.toString() + ' ms');

// test bignumJSON.stringify without bignums

startTime = process.hrtime();

for (var i = 0; i < iterations; i++) {
    bignumJSON.stringify(jsonObj);
}

diffTime = process.hrtime(startTime);
diffTime = (diffTime[0] * 1e9 + diffTime[1]) / 1e6;
console.log(iterations + ' calls of bignumJSON.stringify() without bignums in JSON: ' + diffTime.toString() + ' ms');
