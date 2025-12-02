/* jshint esversion: 6 */
/* jslint node: true */
'use strict';

JSON.canonicalize = require('../');
const test = require('ava');
const jsonfile = require('jsonfile');
const fs = require('fs');

test('arrays', t => {
  const input = jsonfile.readFileSync('test/testdata/input/arrays.json');
  const expected = fs.readFileSync('test/testdata/output/arrays.json', 'utf8').trim();
  const actual = JSON.canonicalize(input);
  t.is(actual, expected);
});

test('french', t => {
  const input = jsonfile.readFileSync('test/testdata/input/french.json');
  const expected = fs.readFileSync('test/testdata/output/french.json', 'utf8').trim();
  const actual = JSON.canonicalize(input);
  t.is(actual, expected);
});

test('structures', t => {
  const input = jsonfile.readFileSync('test/testdata/input/structures.json');
  const expected = fs.readFileSync('test/testdata/output/structures.json', 'utf8').trim();
  const actual = JSON.canonicalize(input);
  t.is(actual, expected);
});

test('values', t => {
  const input = jsonfile.readFileSync('test/testdata/input/values.json');
  const expected = fs.readFileSync('test/testdata/output/values.json', 'utf8').trim();
  const actual = JSON.canonicalize(input);
  t.is(actual, expected);
});

test('weird', t => {
  const input = jsonfile.readFileSync('test/testdata/input/weird.json');
  const expected = fs.readFileSync('test/testdata/output/weird.json', 'utf8').trim();
  const actual = JSON.canonicalize(input);
  t.is(actual, expected);
});
