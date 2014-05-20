#!/usr/bin/env node
'use strict';

var util = require('util');
var assert = require('assert');
var pawnScanner = require('../lib/pawn-scanner');
var numSuccess = 0;
var numFail = 0;

function findFunction(code, expected, argsOverride) {
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
    type: expected.type || 'stock',
    tag: expected.tag,
    name: expected.name,
    args: argsOverride || expected.args,
    addr: expected.addr || null
  }];

  try {
    assert.deepEqual(intel.functions, expected);

    numSuccess++;

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

    numFail++;

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

function safeTrim(str) {
  return str.replace(/\s+/g, ' ')
            .replace(/([a-z0-9@_])\s+([^a-z0-9@_])/ig, '$1$2')
            .replace(/([^a-z0-9@_])\s+([a-z0-9@_])/ig, '$1$2');
}

function doubleSpacing(str) {
  return str.replace(/ /g, '  ');
}

var funcs = {
                 'stock Function ( $A );': { type: 'stock' },
                'static Function ( $A );': { type: 'static' },
                'public Function ( $A );': { type: 'public' },
               'forward Function ( $A );': { forward: true, type: 'function' },
        'forward public Function ( $A );': { forward: true, type: 'public' },
         'forward stock Function ( $A );': { forward: true, type: 'stock' },
           'stock Tag : Function ( $A );': { type: 'stock', tag: 'Tag' },
          'static Tag : Function ( $A );': { type: 'static', tag: 'Tag' },
          'public Tag : Function ( $A );': { type: 'public', tag: 'Tag' },
         'forward Tag : Function ( $A );': { forward: true, type: 'function', tag: 'Tag' },
  'forward public Tag : Function ( $A );': { forward: true, type: 'public', tag: 'Tag' },
   'forward stock Tag : Function ( $A );': { forward: true, type: 'stock', tag: 'Tag' },
                'native Function ( $A ) = OtherFunction ;': { type: 'native', addr: 'OtherFunction' },
                'native Function ( $A ) = -1 ;': { type: 'native', addr: -1 }
};

var args = {
                        ' Arg ': {},
                  ' const Arg ': {const: true},
                  ' Tag : Arg ': {tag: 'Tag'},
    ' { Tag1, Tag2, _ } : Arg ': {tag: ['Tag1', 'Tag2', '_']},
                      ' & Arg ': {ref: true},
                ' & Tag : Arg ': {ref: true, tag: 'Tag'},
  ' & { Tag1, Tag2, _ } : Arg ': {ref: true, tag: ['Tag1', 'Tag2', '_']},
                    ' Arg [ ] ': {dim: [null]},
                ' Arg [ ] [ ] ': {dim: [null, null]},
             ' Arg [ ] [ ] [] ': {dim: [null, null, null]},
                  ' Arg [ 1 ] ': {dim: [1]},
               ' Arg [ Tag: ] ': {dim: ['Tag:']},
            ' Arg [ 1 ] [ 2 ] ': {dim: [1, 2]},
      ' Arg [ 1 ] [ 2 ] [ 3 ] ': {dim: [1, 2, 3]},
        ' Arg [ 1 ] [ ] [ a ] ': {dim: [1, null, 'a']},
      ' Arg [ sieof(test[]) ] ': {dim: ['sieof(test[])']},
    ' Arg [ sieof(test[][]) ] ': {dim: ['sieof(test[][])']},
                    ' Arg = 1 ': {default: '1'},
        ' Arg[][] = {{1},{2}} ': {dim: [null, null], default: '{{1},{2}}'},
  ' Arg[][][] = {{{1}},{{2}}} ': {dim: [null, null, null], default: '{{{1}},{{2}}}'},
                         ' .. ': {name: null},
                        ' ... ': {name: null},
                    ' Tag:... ': {name: null, tag: 'Tag'},
           ' {Tag1, Tag2}:... ': {name: null, tag: ['Tag1', 'Tag2']}
};

var argValues = [];
var failed = false;

// Try each function
for (var rawFunc in funcs) {
  failed = !findFunction(rawFunc.replace('$A', ''), funcs[rawFunc]) || failed;
}

// Try each arg
for (var rawArg in args) {
  args[rawArg] = arg(args[rawArg]);

  failed = !findFunction('stock Function(' + rawArg + ');', {args: [args[rawArg]]}) || failed;
  failed = !findFunction('stock Function(' + safeTrim(rawArg) + ');', {args: [args[rawArg]]}) || failed;
  failed = !findFunction('stock Function(' + doubleSpacing(rawArg) + ');', {args: [args[rawArg]]}) || failed;

  argValues.push(args[rawArg]);
}

// Try each arg in each functions
for (var rawArg in args) {
  for (var rawFunc in funcs) {
    failed = failed || !findFunction(rawFunc.replace('$A', rawArg), funcs[rawFunc], [args[rawArg]]);
    failed = failed || !findFunction(safeTrim(rawFunc.replace('$A', rawArg)), funcs[rawFunc], [args[rawArg]]);
    failed = failed || !findFunction(doubleSpacing(rawFunc.replace('$A', rawArg)), funcs[rawFunc], [args[rawArg]]);
  }
}

var rawArgs = Object.keys(args);

// If all individual tests passed, try all args together in each function
for (var rawFunc in funcs) {
  failed = failed || !findFunction(rawFunc.replace('$A', rawArgs.join(',')), funcs[rawFunc], argValues);
  failed = failed || !findFunction(rawFunc.replace('$A', rawArgs.reverse().join(',')), funcs[rawFunc], argValues.reverse());
  failed = failed || !findFunction(safeTrim(rawFunc.replace('$A', rawArgs.join(','))), funcs[rawFunc], argValues);
  failed = failed || !findFunction(safeTrim(rawFunc.replace('$A', rawArgs.reverse().join(','))), funcs[rawFunc], argValues.reverse());
  failed = failed || !findFunction(doubleSpacing(rawFunc.replace('$A', rawArgs.join(','))), funcs[rawFunc], argValues);
  failed = failed || !findFunction(doubleSpacing(rawFunc.replace('$A', rawArgs.reverse().join(','))), funcs[rawFunc], argValues.reverse());
}

console.log('Ran ' + (numSuccess + numFail) + ' tests. ' + numFail + ' failed.');