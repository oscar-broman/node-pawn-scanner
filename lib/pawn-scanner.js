'use strict';

var fs = require('fs');

exports.scanFile = scanFile;
exports.scanCode = scanCode;

var RE_SYMBOL = '[a-zA-Z@_][a-zA-Z0-9@_]*';

var reCollapseLines = /\\\\\s*?\n\s*/g;
var reStripCommentSingle = /\/\/.*$/m;
var reStripCommentMulti = /\/\*[\s\S]*?\*\//;
var reVariableDimension = new RegExp(
  '\\[\\s*' +
  // Allow anything for now, since it's common to use expressions here
  '(.*?)' +
  '\\s*\\]',
  'g'
);
var reVariable = new RegExp(
  // Constant declaration
  '(const\\s+)?' +
  // Reference
  '(&\\s*)?' +
  // Tag
  '(?:(' + RE_SYMBOL + ')\\s*:\\s*)?' +
  // Name
  '(' + RE_SYMBOL + '|\\.{2,3})' +
  // Array dimensions
  '(?:\\s*' + reVariableDimension.source + '\\s*)?' +
  '(?:\\s*' + reVariableDimension.source + '\\s*)?' +
  '(?:\\s*' + reVariableDimension.source + '\\s*)?' +
  // Default value
  '(?:\\s*=\\s*([^,;{]+))?'
  ,
  'g'
);
var reFunction = new RegExp(
  // Optional forward declaration and function type
  '\\b(forward\\s)?(?:(native|public|stock|static)\\s+)?' +
  // Optional return tag
  '(?:(' + RE_SYMBOL + ')\\s*:\\s*)?' +
  // Name
  '(' + RE_SYMBOL + ')\\s*' +
  // Arguments
  '\\(\\s*' +
    '((?:\\s*' + reVariable.source + '\\s*,?)*)' +
  '\\s*\\)\\s*' +
  // Accept both dummy functions and functions with bodies
  '(}|(?:=\\s*([^;]+)\\s*)?;)',
  'g'
);

function scanCode(code, options) {
  var intel = {
    functions: []
  };
  var options = options || {};

  // Collapse line continuations
  code = code.replace(reCollapseLines, ' ');

  // Strip comments
  if (!options.scanComments) {
    code = code.replace(reStripCommentSingle, '');
    code = code.replace(reStripCommentMulti, '');
  }

  var functions = [];

  reFunction.lastIndex = 0;

  for (;;) {
    var match = reFunction.exec(code);

    if (match === null) {
      break;
    }

    var args = [];

    reVariable.lastIndex = 0;

    for (;;) {
      var argMatch = reVariable.exec(match[5]);

      if (argMatch === null) {
        break;
      }

      var dim = [];

      // Add array dimensions
      for (var i = 5; i < 8; i++) {
        if (argMatch[i] !== undefined) {
          if (argMatch[i] === '') {
            dim.push(null);
          } else if (isFinite(argMatch[i])) {
            dim.push(parseInt(argMatch[i]));
          } else {
            dim.push(argMatch[i]);
          }
        }
      }

      var name = argMatch[4];

      if (name === '..' || name === '...') {
        name = null;
      }

      args.push({
        tag: argMatch[3] || null,
        const: !!argMatch[1],
        ref: !!argMatch[2],
        name: name,
        dim: dim,
        default: argMatch[8] || null
      });
    }

    var addr = match[15];

    if (addr === undefined) {
      addr = null;
    } else if (isFinite(addr)) {
      addr = parseInt(addr);
    }

    var info = {
      forward: !!match[1],
      type: match[2] || 'function',
      tag: match[3] || null,
      name: match[4],
      args: args,
      addr: addr
    };

    functions.push(info);
  }

  intel.functions = functions;

  return intel;
}

function scanFile(filename, options) {
  var code = fs.readFileSync(filename, { encoding: 'utf-8' });

  return scanCode(code, options);
};