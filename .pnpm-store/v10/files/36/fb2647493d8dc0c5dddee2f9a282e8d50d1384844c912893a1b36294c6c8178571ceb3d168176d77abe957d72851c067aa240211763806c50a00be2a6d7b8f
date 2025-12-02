var fs = require('fs');
var path = require('path');
var test = require('tape');
var MemoryStream = require('../../index.js');

test('Stream file', function (t) {
  t.plan(1);
  var source = path.join(process.cwd(), 'test/source.txt');
  var gold = fs.readFileSync(source);
  var rs = fs.createReadStream(source);
  var ws = new MemoryStream();

  ws.on('finish', function () {
    // console.log(gold.toString());
    // console.log(ws.get().toString());
    t.equal(ws.get().toString(), gold.toString(), 'Output should equal file source.');
    t.end();
  });

  rs.pipe(ws);
});

test('Stream file objectMode true', function (t) {
  t.plan(1);
  var source = path.join(process.cwd(), 'test/object.json');
  var gold = require(source);
  var rs = fs.createReadStream(source);
  var ws = new MemoryStream({
    objectMode: true
  });

  ws.on('finish', function () {
    console.error(ws.get(), gold);
    t.deepEqual(ws.get(), [ gold ], 'Output should equal file source.');
    t.end();
  });

  rs.pipe(ws);
});
