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

    return true;
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

    return false;
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

var args = {
                  'Arg': {},
            'const Arg': {const: true},
              'Tag:Arg': {tag: 'Tag'},
  '{Tag1, Tag2, _}:Arg': {tag: ['Tag1', 'Tag2', '_']},
                 '&Arg': {ref: true},
             '&Tag:Arg': {ref: true, tag: 'Tag'},
 '&{Tag1, Tag2, _}:Arg': {ref: true, tag: ['Tag1', 'Tag2', '_']},
                'Arg[]': {dim: [null]},
              'Arg[][]': {dim: [null, null]},
            'Arg[][][]': {dim: [null, null, null]},
               'Arg[1]': {dim: [1]},
            'Arg[Tag:]': {dim: ['Tag:']},
            'Arg[1][2]': {dim: [1, 2]},
         'Arg[1][2][3]': {dim: [1, 2, 3]},
          'Arg[1][][a]': {dim: [1, null, 'a']},
              'Arg = 1': {default: '1'},
      'Arg[] = {1,2,3}': {dim: [null], default: '{1,2,3}'},
                   '..': {name: null},
                  '...': {name: null},
              'Tag:...': {name: null, tag: 'Tag'},
     '{Tag1, Tag2}:...': {name: null, tag: ['Tag1', 'Tag2']}
};

var argValues = [];
var failed = false;

for (var rawArg in args) {
  args[rawArg] = arg(args[rawArg]);

  if (!findFunction('Function(' + rawArg + ');', {type: 'function', args: [args[rawArg]]})) {
    failed = true;
  }

  argValues.push(args[rawArg]);
}

var rawArgs = Object.keys(args);

// If all individual tests passed, try all args together
if (!failed) {
  failed = !findFunction('Function(' + rawArgs.join(',') + ');', {type: 'function', args: argValues});
}

if (!failed) {
  failed = !findFunction('Function(' + rawArgs.reverse().join(',') + ');', {type: 'function', args: argValues.reverse()});
}