#!/usr/bin/env node
'use strict';

var util = require('util');
var assert = require('assert');
var pawnScanner = require('../lib/pawn-scanner');

function findFunction(code, expected) {
  var intel = pawnScanner.scanCode(code);

  if (expected.name === undefined) {
    expected.name = 'Function';
  }

  if (expected.forward === undefined) {
    expected.forward = false;
  }

  if (expected.tag === undefined) {
    expected.tag = null;
  }

  if (expected.args === undefined) {
    expected.args = [];
  }

  expected = [{
    forward: expected.forward,
    type: expected.type,
    tag: expected.tag,
    name: expected.name,
    args: expected.args,
    addr: expected.addr || null
  }];

  try {
    assert.deepEqual(intel.functions, expected);
  } catch (e) {
    console.error(
        'Test failed: ' + code +
      '\n       Line: ' + e.stack.substr(
                          e.stack.lastIndexOf('test-pawn-scanner.js') + 21
                        ).match(/^[0-9]+/)[0] +
      '\n     Actual: ' + util.inspect(intel.functions, { depth: null })
        .replace(/\n/g, '\n             ') +
      '\n   Expected: ' + util.inspect(expected, { depth: null })
        .replace(/\n/g, '\n             ')
    );
  }
}

function arg(info) {
  return {
    tag: info.tag || null,
    name: info.name === undefined ? 'Arg' : info.name,
    dim: info.dim || [],
    const: info.const || false,
    ref: info.ref || false,
    default: info.default || null
  };
}

function args(info) {
  return info.map(arg);
}

// Basic structure
findFunction('Function();', { type: 'function' });
findFunction('stock Function();', { type: 'stock' });
findFunction('static Function();', { type: 'static' });
findFunction('public Function();', { type: 'public' });
findFunction('forward Function();', { forward: true, type: 'function' });
findFunction('forward public Function();', { forward: true, type: 'public' });
findFunction('forward stock Function();', { forward: true, type: 'stock' });

// Return tag
findFunction('Tag:Function();', { type: 'function', tag: 'Tag' });
findFunction('stock Tag:Function();', { type: 'stock', tag: 'Tag' });
findFunction('static Tag:Function();', { type: 'static', tag: 'Tag' });
findFunction('public Tag:Function();', { type: 'public', tag: 'Tag' });
findFunction('forward Tag:Function();', { forward: true, type: 'function', tag: 'Tag' });
findFunction('forward public Tag:Function();', { forward: true, type: 'public', tag: 'Tag' });
findFunction('forward stock Tag:Function();', { forward: true, type: 'stock', tag: 'Tag' });

// Function address override
findFunction('native Function() = OtherFunction;', { type: 'native', addr: 'OtherFunction' });
findFunction('native Function() = -1;', { type: 'native', addr: -1 });

// Arguments
findFunction('Function(Arg1, Tag:Arg2);', { type: 'function', args: args([{name: 'Arg1'}, {name: 'Arg2', tag: 'Tag'}]) });
findFunction('Function(const Arg1, const Tag:Arg2);', { type: 'function', args: args([{name: 'Arg1', const: true}, {name: 'Arg2', const: true, tag: 'Tag'}]) });
findFunction('Function(&Arg1, &Tag:Arg2);', { type: 'function', args: args([{name: 'Arg1', ref: true}, {name: 'Arg2', ref: true, tag: 'Tag'}]) });
findFunction('Function(Arg1[], Arg2[][]);', { type: 'function', args: args([{name: 'Arg1', dim: [null]}, {name: 'Arg2', dim: [null, null]}]) });
findFunction('Function(Arg1[] = "test", Arg2[][] = sizeof(Arg1), Arg3[] = {1, 2, 3});', { type: 'function', args: args([{name: 'Arg1', default: '"test"', dim: [null]}, {name: 'Arg2', default: 'sizeof(Arg1)', dim: [null, null]}, {name: 'Arg3', dim: [null], default: '{1, 2, 3}'}]) });
findFunction('Function(Arg1, Tag:Arg2, Float:...);', { type: 'function', args: args([{name: 'Arg1'}, {name: 'Arg2', tag: 'Tag'}, {name: null, tag: 'Float'}]) });
findFunction('Function(Arg1, Tag:Arg2, {Float, _}:...);', { type: 'function', args: args([{name: 'Arg1'}, {name: 'Arg2', tag: 'Tag'}, {name: null, tag: ['Float', '_']}]) });
findFunction('Function(Arg1[128], Arg2[128][]);', { type: 'function', args: args([{name: 'Arg1', dim: [128]}, {name: 'Arg2', dim: [128, null]}]) });
findFunction('Function(Arg1[128], Arg2[128][E_TEST]);', { type: 'function', args: args([{name: 'Arg1', dim: [128]}, {name: 'Arg2', dim: [128, 'E_TEST']}]) });
findFunction('Function(Arg1[128], Arg2[128][Test:123*2]);', { type: 'function', args: args([{name: 'Arg1', dim: [128]}, {name: 'Arg2', dim: [128, 'Test:123*2']}]) });