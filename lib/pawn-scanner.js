'use strict';

var fs = require('fs');
var path = require('path');

var RE_SYMBOL = '[a-zA-Z@_][a-zA-Z0-9@_]*';
var RE_NESTED_BRACKETS = (function () {
  var re = '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|' +
           '{(?:@R*)}|\\((?:@R*)\\)|\\[(?:@R*)\\]';
  var repl = /@R/g;

  return re.replace(repl, '(?:' + re + '|[^)}\\]])')
           .replace(repl, '(?:' + re + '|[^)}\\]])')
           .replace(repl, '[^)}\\]]');
}());

function noCapture(re) {
  return re.replace(/([^\\]|^)\((?!\?\:)/g, '$1(?:');
}

var reCollapseLines = /\\\s*?\n\s*/g;
var reStripCommentSingle = /\/\/.*?$/gm;
var reStripCommentMulti = /\/\*[\s\S]*?\*\//g;
var reCommaSplit = /\s*,\s*/;
var reNestedBrackets = new RegExp();
var reVariableDimension = new RegExp(
  '\\[\\s*' +
  // Allow anything for now, since it's common to use expressions here
  '((?:' + RE_NESTED_BRACKETS + '|[^\\]])*)' +
  '\\s*\\]',
  'g'
);
var reVariable = new RegExp(
  // Constant declaration
  '(const\\s+)?' +
  // Reference
  '(&\\s*)?' +
  // Tag
  '(?:(' + RE_SYMBOL + '|\\{\\s*' + RE_SYMBOL + '(?:\\s*,\\s*' +
  RE_SYMBOL + ')*\\s*\\})\\s*:\\s*)?' +
  // Name
  '(' + RE_SYMBOL + '|\\.{2,3})' +
  // Array dimensions
  '(?:\\s*' + reVariableDimension.source + '\\s*)?' +
  '(?:\\s*' + reVariableDimension.source + '\\s*)?' +
  '(?:\\s*' + reVariableDimension.source + '\\s*)?' +
  // Default value
  '(?:\\s*=\\s*((?:' + RE_NESTED_BRACKETS +
  '|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|[^,)};])+))?',
  'g'
);
var reFunction = new RegExp(
  // Forward declaration and/or function type
  '\\b(forward\\s+)?(?:(native|public|stock|static|forward)\\s+)' +
  // Optional return tag
  '(?:(' + RE_SYMBOL + ')\\s*:\\s*)?' +
  // Name
  '(' + RE_SYMBOL + ')\\s*' +
  // Arguments
  '\\(\\s*' +
    '((?:' + noCapture(reVariable.source) + ')(?:\\s*,\\s*' + noCapture(reVariable.source) + ')*)?' +
  '\\s*\\)\\s*' +
  // Accept both dummy functions and functions with bodies
  '({|(?:=\\s*([^;]+)\\s*)?;)',
  'g'
);
var reMacro = new RegExp(
  '^[ \\t]*#define[ \\t]*' +
  // Prefix
  '(' + RE_SYMBOL + ')' +
  // Pattern
  '([^\\s]*)' +
  // Substitution
  '[ \\t]*(\\S.*?)?$',
  'gm'
);
var reEnum = new RegExp(
  '\\benum\\s*' +
  // Optional tag
  '(?:(' + RE_SYMBOL + ')\\s*:\\s*)?' +
  // Optional name
  '(' + RE_SYMBOL + ')?\\s*' +
  // Optional increment
  '(?:\\(\\s*((?:' + RE_NESTED_BRACKETS + '|[^)])*?)\\s*\\)\\s*)?' +
  // Body
  '{\\s*(' +
  '((?:' + noCapture(reVariable.source) + ')(?:\\s*,\\s*' + noCapture(reVariable.source) + ')*)?' +
  ')\\s*}',
  'g'
);

function findLineNumber(lineNumbers, index) {
  var len = lineNumbers.length;
  var idx = 0;

  if (len === 1 || index === 0) {
    return 1;
  }

  for (var i = 0; i < len; i++) {
    idx += lineNumbers[i];

    if (idx > index) {
      return i;
    }
  }

  return lineNumbers.length;
}

function findLineNumberStatic(lineNumbers, index, lastLine) {
  var len = lineNumbers.length;

  lastLine = lastLine || 1;

  if (index === 0 || len <= 1) {
    return 1;
  }

  for (var i = lastLine - 1; i < len; i++) {
    if (lineNumbers[i] > index) {
      return i;
    }
  }

  return lineNumbers.length;
}

function scanCode(code, options, intel) {
  intel = intel || {
    functions: [],
    macros: [],
    enums: []
  };

  options = options || {};

  // Keep track of line numbers
  var lineNumbers = [0];
  var line = 1;
  var idx = -1;
  var lastIdx = 0;

  while ((idx = code.indexOf('\n', ++idx)) !== -1) {
    lineNumbers.push(idx - lastIdx);

    lastIdx = idx;
  }

  // Strip comments while retaining the line number mapping
  if (!options.scanComments) {
    idx = 0;
    code = code.replace(reStripCommentMulti, function($0, index) {
      index += idx;

      var lines = $0.split('\n');
      var startLine = findLineNumber(lineNumbers, index) - 1;
      var diff;

      for (var i = 0; i < lines.length; i++) {
        diff = lines[i].length + (i !== lines.length - 1);
        lineNumbers[startLine + i] -= diff;
        idx -= diff;
      }

      return '';
    });

    idx = 0;
    code = code.replace(reStripCommentSingle, function($0, index) {
      index += idx;
      idx -= $0.length;

      lineNumbers[findLineNumber(lineNumbers, index) - 1] -= $0.length;

      return '';
    });
  }

  // Collapse line continuations
  idx = 0;
  code = code.replace(reCollapseLines, function($0, index) {
    index += idx;
    idx -= $0.length - 1;

    lineNumbers[findLineNumber(lineNumbers, index) - 1] -= $0.length - 1;

    return ' ';
  });

  idx = 0;

  var lineNumbersStatic = lineNumbers.map(function(v) {
    idx += v;

    return idx;
  });

  var match, argMatch, lastLine;

  reFunction.lastIndex = 0;
  lastLine = 1;

  while ((match = reFunction.exec(code))) {
    var args = [];

    reVariable.lastIndex = 0;

    while ((argMatch = reVariable.exec(match[5] || ''))) {
      var dim = [];

      // Add array dimensions
      for (var i = 5; i < 8; i += 1) {
        if (argMatch[i] !== undefined) {
          if (argMatch[i] === '') {
            dim.push(null);
          } else if (isFinite(argMatch[i])) {
            dim.push(parseInt(argMatch[i], 10));
          } else {
            dim.push(argMatch[i].trim());
          }
        }
      }

      var name = argMatch[4];

      if (name === '..' || name === '...') {
        name = null;
      }

      var tag = argMatch[3] || null;

      if (tag && tag[0] === '{') {
        tag = tag.substr(1, tag.length - 2).trim().split(reCommaSplit);
      }

      line = findLineNumberStatic(lineNumbersStatic, argMatch.index, lastLine);

      args.push({
        tag: tag,
        const: !!argMatch[1],
        ref: !!argMatch[2],
        name: name,
        dim: dim,
        def: argMatch[8] ? argMatch[8].trim() : null,
        line: line
      });
    }

    var addr = match[7];

    if (addr === undefined) {
      addr = null;
    } else if (isFinite(addr)) {
      addr = parseInt(addr, 10);
    } else {
      addr = addr.trim();
    }

    line = findLineNumberStatic(lineNumbersStatic, match.index, lastLine);
    lastLine = line - 1;

    var info = {
      forward: !!match[1] || match[2] === 'forward',
      type: match[2] === 'forward' ? 'function' : match[2],
      tag: match[3] || null,
      name: match[4],
      args: args,
      addr: addr,
      line: line
    };

    intel.functions.push(info);
  }

  reMacro.lastIndex = 0;
  lastLine = 1;

  while ((match = reMacro.exec(code))) {
    line = findLineNumberStatic(lineNumbersStatic, match.index, lastLine);
    lastLine = line - 1;

    intel.macros.push({
      prefix: match[1],
      pattern: match[2] || null,
      substitution: match[3] || null,
      line: line
    });
  }

  reEnum.lastIndex = 0;
  lastLine = 1;

  while ((match = reEnum.exec(code))) {
    delete match.input;

    var vars = [];

    reVariable.lastIndex = 0;

    while ((argMatch = reVariable.exec(match[5] || ''))) {
      var dim = [];

      // Add array dimensions
      for (var i = 5; i < 8; i += 1) {
        if (argMatch[i] !== undefined) {
          if (argMatch[i] === '') {
            dim.push(null);
          } else if (isFinite(argMatch[i])) {
            dim.push(parseInt(argMatch[i], 10));
          } else {
            dim.push(argMatch[i].trim());
          }
        }
      }

      var name = argMatch[4];

      if (name === '..' || name === '...') {
        name = null;
      }

      var tag = argMatch[3] || null;

      if (tag && tag[0] === '{') {
        tag = tag.substr(1, tag.length - 2).trim().split(reCommaSplit);
      }

      vars.push({
        tag: tag,
        name: name,
        dim: dim,
        value: argMatch[8] ? argMatch[8].trim() : null,
        line: findLineNumberStatic(lineNumbersStatic, argMatch.index, lastLine)
      });
    }

    line = findLineNumberStatic(lineNumbersStatic, match.index, lastLine);
    lastLine = line - 1;

    intel.enums.push({
      tag: match[1] || null,
      name: match[2] || null,
      increment: match[3] || null,
      variables: vars,
      line: line
    });
  }

  return intel;
}

function iterateFiles(dir, cb) {
  var files = fs.readdirSync(dir);

  files.forEach(function(file) {
    file = path.resolve(dir, file);
    var stats = fs.statSync(file);

    if (stats.isDirectory()) {
      return iterateFiles(file, cb);
    } else if (stats.isFile()) {
      cb(file);
    }
  });
}

function scanFile(filename, options, intel) {
  var code = fs.readFileSync(filename, { encoding: 'utf-8' });

  return scanCode(code, options, intel);
}

function scanDir(dirname, options, intel) {
  options = options || {};

  options.extnames = options.extnames || ['.pwn', '.inc'];

  iterateFiles(dirname, function(filename) {
    if (options.extnames.indexOf(path.extname(filename.toLowerCase())) === -1) {
      return;
    }

    intel = scanFile(filename, options, intel);
  });

  return intel;
}

exports.scanCode = scanCode;
exports.scanFile = scanFile;
exports.scanDir = scanDir;