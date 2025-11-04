# Solar - Technical Reference

**Solar** is a fast, standalone SLR(1) parser generator that generates parsers ~215× faster than Jison.

**Key Features:**
- Zero dependencies
- S-expression mode (optional)
- Jison-compatible mode
- Works with JavaScript, TypeScript, JSON, and Rip grammar files
- Generates clean, efficient parsers

**Type:** SLR(1) parser generator (similar to Yacc/Bison/Jison)

---

## Overview

### What is Solar?

Solar is an SLR(1) parser generator that generates parsers from grammar specifications. It supports two output modes:

1. **S-expression mode** (recommended) - Outputs nested arrays for easy transformation
2. **Jison-compatible mode** - Traditional AST node style

**Key Innovation:** S-expressions as intermediate representation can reduce compiler complexity by 50% or more.

**Real-world example:** The Rip language compiler uses Solar's s-expression mode and achieves 9,450 LOC vs CoffeeScript's 17,760 LOC (46% reduction).

### Typical Pipeline

```
Source Code → Lexer → Solar Parser → S-Expressions → Codegen → Output
             (your)   (generated)    (arrays!)      (your)
```

Solar handles the middle part - generating an efficient parser from your grammar.

---

## S-Expression Mode

### Enabling S-Expression Mode

In your grammar file (JavaScript example):

```javascript
// grammar.js
export default {
  grammar: {
    // Your grammar rules...
  },

  operators: [
    // Your precedence rules...
  ]
};
```

This tells Solar to generate a parser that builds s-expressions (nested arrays) instead of AST objects.

### S-Expression Structure

S-expressions are plain JavaScript arrays:
- **Head:** String identifying node type (`"if"`, `"def"`, `"+"`, etc.)
- **Rest:** Arguments/children for that node

**Examples:**
```javascript
// Assignment
['=', 'x', 42]

// Function call
['add', 5, 10]

// Binary operator
['+', 'a', 'b']

// Nested
['=', 'result', ['+', ['*', 2, 3], 4]]
```

---

## Grammar Syntax

### Basic Grammar Structure

Grammar rules in JavaScript:

```javascript
// grammar.js
export default {
  grammar: {
    RuleName: [
      ['TOKEN1 TOKEN2', 'action'],
      ['OTHER PATTERN', 'action', { prec: 'OPERATOR' }]
    ],

    Expression: [
      ['NUMBER', '1'],  // Return first token
      ['Expression + Expression', '["+", 1, 3]']  // Build s-expression
    ]
  },

  operators: [
    ['left', '+', '-'],
    ['left', '*', '/']
  ]
};
```

Each rule is: `[pattern, action, options?]`

### Action Syntax - Three Styles

Solar's sexp mode auto-detects action style based on content:

#### Style 1: Default (Pass-Through)

**When:** Action is `1`, `'1'`, or omitted (defaults to `1`)

**Behavior:** Returns first token

```javascript
// grammar.js
Expression: [
  ['Value'],           // Omit action (defaults to 1)
  ['Operation', 1],    // Number works
  ['Code', '1'],       // String works too
]
```

**Generated code:**
```javascript
case 46: return $$[$0];  // Position 1
```

---

#### Style 2: Simple S-Expression (Bare Numbers)

**When:** Action string contains **no `$` references**

**Behavior:** All bare numbers become `$$[$n]` token references

**Example:**
```javascript
// grammar.js
For: [
  ['FOR ForVariables FOROF Expression Block', '["for-of", 2, 4, null, 5]']
]
```

**Token positions:**
- `FOR` (1), `ForVariables` (2), `FOROF` (3), `Expression` (4), `Block` (5)

**Generated:**
```javascript
case 327: return ["for-of", $$[$0-3], $$[$0-1], null, $$[$0]];
```

**Replacement:**
- `2` → `$$[$0-3]` (ForVariables)
- `4` → `$$[$0-1]` (Expression)
- `5` → `$$[$0]` (Block)
- `null` stays as `null`

**Use for:** Most grammar rules - clean and simple!

---

#### Style 3: Advanced (Dollar References)

**When:** Action string contains `$n` patterns

**Behavior:** Only `$n` replaced; bare numbers preserved as literals

**Example:**
```javascript
// grammar.js
Parenthetical: [
  ['( Body )', '$2.length === 1 ? $2[0] : $2']
]
```

**Generated:**
```javascript
case 303: return $$[$0-1].length === 1 ? $$[$0-1][0] : $$[$0-1];
```

**Key:** The `1` in `.length === 1` and `0` in `[0]` are **NOT** replaced!

**Use for:** Conditional logic, array access, transformations

---

### Spread Operator in Actions

Spread arrays into parent array:

```javascript
// grammar.js
Body: [
  ['Line', '[1]'],                         // Wrap: [Line]
  ['Body TERMINATOR Line', '[...1, 3]']    // Spread: [...Body, Line]
]
```

**Generated:**
```javascript
case 3: return [$$[$0]];
case 4: return [...$$[$0-2], $$[$0]];
```

---

## When to Use Each Style

### Style 1 (Default) - Pass-Through

**Use when:** Rule just forwards a single alternative

```javascript
// grammar.js
Expression: [
  ['Value'],       // Just return Value
  ['Code'],        // Just return Code
  ['Operation']    // Just return Operation
]
```

### Style 2 (Bare Numbers) - S-Expression Building

**Use when:** Building simple s-expressions with token references

```javascript
// grammar.js
If: [
  ['IF Expression Block', '["if", 2, 3]'],
  ['IF Expression Block ELSE Block', '["if", 2, 3, 5]']
],

Assignment: [
  ['Assignable = Expression', '["=", 1, 3]']
]
```

**Best practice:** Use this for 90% of rules!

### Style 3 ($n) - Advanced Transformations

**Use when you need:**
- Conditional logic
- Array/object manipulation
- Literal numbers in output
- Complex transformations

```javascript
// grammar.js
Parenthetical: [
  ['( Body )', '$2.length === 1 ? $2[0] : $2']
],

While: [
  ['WhileSource Block', '$1.length === 2 ? [$1[0], $1[1], $2] : [$1[0], $1[1], $1[2], $2]']
]
```

---

## S-Expression Reference

### Complete Node Type List

This is what Solar outputs and what Rip's codegen expects:

#### Top Level
```javascript
['program', ...statements]
```

#### Variables & Assignment
```javascript
['=', target, value]
['+=', target, value]  // And all compound assigns: -=, *=, /=, %=, **=
['&&=', target, value]
['||=', target, value]
['?=', target, value]   // Maps to ??=
['??=', target, value]
```

#### Functions
```javascript
// Named function
['def', name, params, body]

// Thin arrow (unbound this)
['->', params, body]

// Fat arrow (bound this)
['=>', params, body]

// Parameters can be:
'name'                    // Simple param
['rest', 'name']          // Rest: ...name
['default', 'name', expr] // Default: name = expr
['expansion']             // Expansion marker: (a, ..., b)
['object', ...]           // Object destructuring
['array', ...]            // Array destructuring
```

#### Calls & Property Access
```javascript
[callee, ...args]              // Function call
['await', expr]                // Await
['.', obj, 'prop']             // Property: obj.prop
['?.', obj, 'prop']            // Optional: obj?.prop
['::', obj, 'prop']            // Prototype: obj.prototype.prop
['?::', obj, 'prop']           // Soak prototype
['[]', arr, index]             // Index: arr[index]
['?[]', arr, index]            // Soak index
['optindex', arr, index]       // ES6 optional: arr?.[index]
['optcall', fn, ...args]       // ES6 optional: fn?.(args)
['?call', fn, ...args]         // Soak call: fn?(args)
['new', constructorExpr]       // Constructor
['super', ...args]             // Super call
['tagged-template', tag, str]  // Tagged template
```

#### Data Structures
```javascript
['array', ...elements]         // Array literal
['object', ...pairs]           // Object literal (pairs: [key, value])
['...', expr]                  // Spread (unary)
```

#### Operators
```javascript
// Arithmetic
['+', left, right]
['-', left, right]
['*', left, right]
['/', left, right]
['%', left, right]
['**', left, right]

// Comparison
['==', left, right]   // Compiles to ===
['!=', left, right]   // Compiles to !==
['<', left, right]
['<=', left, right]
['>', left, right]
['>=', left, right]

// Logical
['&&', left, right]
['||', left, right]
['??', left, right]

// Bitwise
['&', left, right]
['|', left, right]
['^', left, right]
['<<', left, right]
['>>', left, right]
['>>>', left, right]

// Unary
['!', expr]
['~', expr]
['-', expr]           // Unary minus
['+', expr]           // Unary plus
['++', expr, isPostfix]  // Increment
['--', expr, isPostfix]  // Decrement
['typeof', expr]
['delete', expr]
['not', expr]         // Alias for !

// Special
['instanceof', expr, type]
['?', expr]           // Existence check
```

#### Control Flow
```javascript
['if', condition, thenBlock, elseBlock?]
['unless', condition, body]
['?:', condition, thenExpr, elseExpr]  // Ternary
['switch', discriminant, cases, defaultCase?]
```

#### Loops
```javascript
['for-in', vars, iterable, step?, guard?, body]
['for-of', vars, object, guard?, body]
['while', condition, body]
['until', condition, body]
['loop', body]
['break']
['continue']
['break-if', condition]
['continue-if', condition]
```

**vars arrays:**
- `['item']` or `['item', 'index']` for for-in
- `['key']` or `['key', 'value']` for for-of

#### Comprehensions
```javascript
['comprehension', expr, iterators, guards]
['object-comprehension', keyExpr, valueExpr, iterators, guards]
```

**iterators format:**
```javascript
[
  ['for-in', ['item'], iterable, null],
  ['for-of', ['key', 'value'], object]
]
```

**guards format:**
```javascript
[condition1, condition2, ...]
```

#### Exceptions
```javascript
['try', tryBlock, [catchParam, catchBlock]?, finallyBlock?]
['throw', expr]

// Catch param can be:
// - String (identifier)
// - ['object', ...] (destructuring)
// - ['array', ...] (destructuring)
// - null (no param)
```

#### Classes
```javascript
['class', name, parent?, ...members]
```

**Members:**
```javascript
['constructor', ['->', params, body]]
[methodName, ['->', params, body]]     // Instance method
['static', methodName, ['->', params, body]]
```

#### Ranges & Slicing
```javascript
['..', from, to]      // Inclusive range
['...', from, to]     // Exclusive range

// Used in:
['for-in', ['i'], ['..', 1, 10], null, null, body]  // Loop
['[]', arr, ['..', 1, 3]]  // Slice: arr[1..3]
```

#### Blocks
```javascript
['block', ...statements]  // Multiple statements
['do-iife', expr]         // Do expression (IIFE)
```

#### Modules
```javascript
['import', specifiers, source]
['export', statement]
['export-default', expr]
['export-all', source]
['export-from', specifiers, source]
```

#### Other
```javascript
['return', expr?]
'this'
'@'                    // this shorthand
['str', ...parts]      // Template literal
```

---

## Working with Grammars

### Creating a Grammar File

Create `grammar.js`:

```javascript
// grammar.js
export default {
  grammar: {
    Assignment: [
      ['Assignable = Expression', '["=", 1, 3]'],
      ['Assignable = TERMINATOR Expression', '["=", 1, 4]'],
      ['Assignable = INDENT Expression OUTDENT', '["=", 1, 4]']
    ]
  },

  operators: [
    ['right', '=', ':', 'COMPOUND_ASSIGN'],
    ['left', '+', '-'],
    ['left', '*', '/']
  ]
};
```

### Generate Parser

```bash
# Using the CLI:
solar grammar.js -o parser.js

# Or programmatically:
import { Generator } from 'solar-parser';
const generator = new Generator(grammar);
const parserCode = generator.generate();
```

### Example Rule Breakdown

```javascript
Assignment: [
  ['Assignable = Expression', '["=", 1, 3]']
]
```

**How it works:**
- **Pattern:** `Assignable = Expression`
- **Tokens:** Position 1 (Assignable), 2 (=), 3 (Expression)
- **Action:** `'["=", 1, 3]'` becomes `["=", $$[$0-2], $$[$0]]`
- **Output:** `["=", assignableValue, expressionValue]`

### Precedence & Associativity

Define operator precedence:

```javascript
// grammar.js
export default {
  operators: [
    ['right', '=', ':', 'COMPOUND_ASSIGN'],
    ['left', '+', '-'],
    ['left', '*', '/', '%'],
    ['right', '**'],
    ['left', '<<', '>>', '>>>'],
    ['left', '<', '>', '<=', '>='],
    ['left', '==', '!=', '===', '!=='],
    ['left', '&'],
    ['left', '^'],
    ['left', '|'],
    ['left', '&&'],
    ['left', '||'],
    ['left', '??'],
    ['nonassoc', '++', '--'],
    ['left', '.']
  ]
};
```

Operators are listed from **lowest to highest precedence**.

---

## Debugging Grammars

### View Generated Parser

After generating a parser, inspect the action code:

```bash
# See the generated parser
cat parser.js | head -50

# Find specific rule
grep -A 2 "case NN:" parser.js
```

### Test Your Parser

```javascript
// test.js
import { Parser } from './parser.js';

const parser = new Parser();
parser.lexer = myLexer;  // Attach your lexer

const result = parser.parse('x = 42');
console.log(result);  // See the s-expression output
```

### Common Issues

**Issue:** Action using wrong token position

**Solution:** Count tokens in pattern carefully:
```javascript
// Pattern: IF Expression Block ELSE Block
//          1   2          3     4    5
['IF Expression Block ELSE Block', '["if", 2, 3, 5]']
//                                          ↑  ↑  ↑
//                                       Expr Then Else
```

**Issue:** Numbers being replaced incorrectly

**Solution:** Use Style 3 with `$n` for complex logic:
```javascript
// WRONG (Style 2): '1' would become token reference
['Body', '$1[0]']

// RIGHT (Style 3): Use $ prefix to mark what to replace
['Body', '$1.length === 1 ? $1[0] : $1']
```

---

## S-Expression Specification

### Design Principles

1. **Simplicity:** Plain arrays, no metadata
2. **Uniformity:** Consistent structure across all nodes
3. **Inspectable:** Easy to debug with `console.log`
4. **Transformable:** Tree transformations are trivial

### Type Conventions

- **Identifiers:** Plain strings (`"x"`, `"myVar"`)
- **String literals:** Quoted strings (`"\"hello\""`, `"'world'"`)
- **Numbers:** Primitives (`42`, `3.14`) or String objects with metadata
- **Arrays:** `['array', ...]` for array literals
- **Objects:** `['object', ...]` for object literals
- **Null:** JavaScript `null` for optional/missing values

### Disambiguation Rules

**Spread vs Range:**
- `['...', expr]` - Unary spread (one operand)
- `['...', from, to]` - Exclusive range (two operands)
- `['..', from, to]` - Inclusive range (two operands)

**Context determines:** Codegen checks operand count.

**Call vs Property Access:**
- `[callee, ...args]` - If head is expression, it's a call
- `['.', obj, 'prop']` - Explicit property access node

---

## Advanced Features

### Lexer Integration

Solar works with any lexer that provides a token stream. The generated parser expects:

**Token format:**
```javascript
{
  yytext: string,    // Token text
  yylloc: {          // Location (optional)
    first_line: number,
    last_line: number,
    first_column: number,
    last_column: number
  }
}
```

**Lexer interface:**
```javascript
lexer = {
  setInput(input, yy) { /* ... */ },
  lex() { /* return token id */ },
  yytext: string,
  yyleng: number,
  yylineno: number,
  yylloc: object
}
```

### Token Metadata (Optional)

Your lexer can attach metadata to tokens as properties. This is preserved through the parse and available in actions.

**Examples:**
- String tokens: `.quote`, `.double` (for quote preservation)
- Number tokens: `.parsedValue` (for pre-parsed values)
- All tokens: location data for source maps

**Note:** The CoffeeScript/Rip lexer does this extensively, but it's optional for your parser.

---

## Grammar Tips

### 1. Use Style 2 for Most Rules

```javascript
// Clean and simple s-expression building
For: [
  ['FOR ForVariables IN Expression Block', '["for-in", 2, 4, null, null, 5]']
]
```

### 2. Use Style 3 Sparingly

Only when you need conditional logic:

```javascript
// Unwrap single-element bodies
Parenthetical: [
  ['( Body )', '$2.length === 1 ? $2[0] : $2']
]
```

### 3. Test Incrementally

```bash
# After each grammar change:
solar grammar.js -o parser.js

# Test with your lexer:
node test-parser.js
```

### 4. Check Generated Code

```bash
# Verify Solar generated correct action
grep -A 2 "case NNN:" parser.js
```

### 5. Document Token Positions

```javascript
// Makes rules self-documenting
If: [
  ['IF Expression Block ELSE Block', '["if", 2, 3, 5]']
  // 1   2          3     4    5            cond then else
]
```

---

## Integration Checklist

For using Solar's s-expression mode effectively:

- ✅ Actions return plain arrays (no metadata needed)
- ✅ Use string heads for node types (`"if"`, `"def"`, `"+"`, etc.)
- ✅ Use `null` for optional/missing values
- ✅ Design your s-expression format to match your codegen needs
- ✅ Document your node type conventions
- ✅ Keep s-expressions simple and consistent
- ✅ Test with small examples first
- ✅ Verify generated parser output matches expectations

---

## Why S-Expressions Work

### Traditional AST Approach

```javascript
// CoffeeScript-style AST node
class BinaryOp {
  constructor(operator, left, right) {
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  compile(options) {
    // 50+ lines of compilation logic
    // Track context, handle precedence, etc.
  }
}
```

**Problems:**
- Hundreds of node classes
- Complex inheritance hierarchies
- Tight coupling between structure and behavior
- Hard to extend

### S-Expression Approach

```javascript
// Just arrays!
['+', left, right]

// In codegen:
case '+': {
  const [left, right] = rest;
  return `(${this.generate(left)} + ${this.generate(right)})`;
}
```

**Benefits:**
- ✅ Simple pattern matching
- ✅ Easy to extend (add a case)
- ✅ Easy to inspect/debug
- ✅ Easy to transform
- ✅ **64% less code**

---

## Solar Generator Details

### Implementation

**Source:** `lib/solar.js` (Pure JavaScript ES2022)  
**Size:** ~1,260 lines, 47KB  
**Dependencies:** Zero  

**Features:**
- Single self-contained file
- Lexer-agnostic (works with any token stream)
- S-expression mode (default) + Jison-compatible mode
- Automatic precedence handling
- Intelligent conflict resolution
- Clean, efficient parse table generation
- No build step required

### Generated Parsers

**Typical output size:** 300-400 LOC (depends on grammar)

**Contains:**
- Compact parse table (state machine)
- Action functions (from your grammar)
- LR parser runtime (~100 LOC)

**Best practice:** Regenerate from grammar when making changes, don't edit parser.js directly!

---

## Quick Reference

### Common Grammar Patterns

**Assignment:**
```javascript
['Assignable = Expression', '["=", 1, 3]']
```

**Binary operator:**
```javascript
['Expression + Expression', '["+", 1, 3]']
```

**Unary operator:**
```javascript
['! Expression', '["!", 2]']
```

**Function:**
```javascript
['FUNCTION Identifier ( ParamList ) Block', '["function", 2, 4, 6]']
```

**If/else:**
```javascript
['IF Expression Block', '["if", 2, 3]'],
['IF Expression Block ELSE Block', '["if", 2, 3, 5]']
```

**For loop:**
```javascript
['FOR Variable IN Expression Block', '["for-in", 2, 4, 5]']
```

### Complete Example Grammar

```javascript
// simple-calc.js
export default {
  grammar: {
    Program: [
      ['Expression', '[1]']
    ],

    Expression: [
      ['NUMBER'],
      ['Expression + Expression', '["+", 1, 3]'],
      ['Expression * Expression', '["*", 1, 3]'],
      ['( Expression )', '2']
    ]
  },

  operators: [
    ['left', '+'],
    ['left', '*']
  ]
};
```

Generate parser:
```bash
solar simple-calc.js -o calc-parser.js
```

---

## Performance

### Parser Generation Speed

**Solar generates Rip's parser in ~58ms!**

**Real-world benchmark (Rip grammar):**
- **Grammar size:** 91 types, 406 production rules, 802 lines
- **Generated parser:** 250 states, SLR(1) parse table
- **Solar:** ~58ms total (on Bun)
- **Jison:** ~12,500ms (12.5 seconds) for comparable grammar
- **Speedup:** **~215× faster!**

**Breakdown of Solar's 58ms (average of 10 runs):**
```
~3ms   processGrammar     (5%)   - Parse grammar spec
~40ms  buildLRAutomaton   (69%)  - Build state machine
~11ms  processLookaheads  (19%)  - Compute FIRST/FOLLOW
~10ms  buildParseTable    (17%)  - Generate parse table
────────
~58ms  Total
```

### Why Solar is So Fast

**1. Optimized Algorithms:**
- Single-pass item grouping (no redundant scanning)
- Efficient kernel signature computation
- Direct state map lookups
- Minimal object allocations

**2. Clean Implementation:**
- No intermediate representations
- Direct Map/Set usage (V8 optimized)
- Void operators prevent unnecessary returns
- Simple data structures (arrays, not classes)

**3. Comparison with Jison:**

| Metric | Jison | Solar | Winner |
|--------|-------|-------|--------|
| **Parse time** | 12,500ms | 58ms | **Solar ~215×** |
| **Dependencies** | Many | Zero | **Solar** |
| **Self-hosting** | No | Yes | **Solar** |
| **Code size** | 2,285 LOC | 1,047 LOC | **Solar 54%** |
| **Output** | AST classes | S-expressions | **Solar (simpler)** |

### Iteration Speed Matters

**Why 58ms vs 12.5s matters in practice:**

With Jison (12.5s):
- Edit grammar → wait → coffee break → check result
- ~5-10 iterations per hour
- Slow feedback loop discourages experimentation

With Solar (58ms):
- Edit grammar → instant feedback → iterate
- ~100+ iterations per hour
- Rapid experimentation enabled Rip's development

**Solar's speed made Rip possible.** The ability to modify the grammar and see results instantly (58ms feels instant) enabled the rapid iteration needed to develop and refine Rip's syntax.

### Generated Parser Performance

**Runtime performance:** Identical to Jison (both generate SLR(1) state machines)
**Overhead:** Minimal - simple array construction for s-expressions
**Output quality:** Clean, efficient parse tables

The speedup is in **generation time**, not runtime. Both produce equally fast parsers.

---

## Summary

Solar's s-expression mode is a powerful approach for building compilers and interpreters:

1. **Simple IR:** Arrays instead of AST classes (easy to inspect and debug)
2. **Grammar-driven:** Modify spec, regenerate parser (fast iteration)
3. **Battle-tested:** Proven approach used in production compilers
4. **Maintainable:** Significantly less code than traditional AST approaches
5. **Extensible:** Add features by adding switch cases (no class hierarchies)

**Real-world results:** The Rip compiler achieves 9,450 LOC using s-expressions vs CoffeeScript's 17,760 LOC with traditional ASTs (46% reduction).

---

## Learn More

**Package:** `npm install solar-parser` or `bun add solar-parser`
**Repository:** https://github.com/shreeve/solar
**Examples:** See README.md for complete usage examples
**Real-world usage:** The Rip language compiler (https://github.com/shreeve/rip-lang)

**Questions?** Open an issue on GitHub!
