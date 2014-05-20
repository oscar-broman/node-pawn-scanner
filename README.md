node-pawn-scanner
=================

Scan Pawn source files to gather intel.

## Using the scripts

Simply invoke `bin/scan-dir.js` or `bin/scan-file.js` to generate JSON output from a directory (recursively) or a single file.

### Output JSON

The output has the following format:

```javascript
{
  // The function name
  name: 'MyFunction',
  // The function has a forward declaration
  forward: true,
  // Function type (native, public, stock, static, function)
  type: 'public',
  // The functions return tag, `null` if there is none
  tag: 'Float',
  // If a native function has an address override, like this:
  // native ppprint(str[]) = print;
  addr: null,
  // Array of arguments
  args: [
    {
      // The argument's tag. Will be an array if there are multiple tags
      tag: null,
      // Is the variable declared as a constant?
      const: false,
      // Pass by reference (with &)?
      ref: false,
      // The variable name
      name: 'Arg1',
      // If the variable has array dimensions, this will be an array containing their sizes
      // If the size is not specified, it will be null. Some examples:
      // arg       =>  dim: null
      // arg[123]  =>  dim: [123]
      // arg[]     =>  dim: [null]
      // arg[][5]  =>  dim: [null, 5]
      dim: null,
      // The argument's default value, null if there is none
      def: null
    }
  ]
}
```
