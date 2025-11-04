<p align="center">
  <img src="docs/solar-1280w.png" alt="Solar Logo" width="800">
</p>

# Solar

**The Fast SLR(1) Parser Generator with S-Expression Mode**

Solar is a standalone parser generator (like Yacc/Bison/Jison) that generates parsers **~215× faster** than Jison while producing cleaner, simpler output. Instead of forcing you into complex AST class hierarchies, Solar offers **s-expression mode** - outputting simple nested arrays that are trivial to transform and debug.

```bash
# Jison:  12,500ms to generate parser 😴
# Solar:      58ms to generate parser ⚡

# Install with Bun (recommended):
bun add solar-parser

# Or with npm:
npm install solar-parser
```

---

## Why Solar?

**If you've ever wished Jison was:**
- ⚡ **~215× faster** at generating parsers
- 🎯 **Simpler** - arrays instead of AST classes
- 📦 **Smaller** - 45% less code (1,260 LOC vs Jison's 2,285)
- 🚀 **Zero dependencies** - completely standalone
- 🎨 **More flexible** - output s-expressions OR traditional AST nodes

**Then Solar is for you.**

---

## The S-Expression Advantage

### Traditional Parser Generators (Jison, Bison, Yacc)

Force you into verbose AST class definitions:

```javascript
// You write:
class BinaryOp {
  constructor(operator, left, right) {
    this.operator = operator;
    this.left = left;
    this.right = right;
  }

  compile(options) {
    // 50+ lines of compilation logic
    // Complex inheritance hierarchies
    // Tight coupling everywhere
  }
}

// Grammar action:
Expression '+' Expression  { new BinaryOp('+', $1, $3) }
```

**Problems:**
- Hundreds of node classes to maintain
- Complex inheritance hierarchies
- Structure tightly coupled to behavior
- Hard to extend, hard to debug

### Solar's S-Expression Mode

Clean, simple nested arrays:

```javascript
// Grammar action:
Expression '+' Expression  { ['+', $1, $3] }

// Output:
['+', left, right]

// In your compiler:
case '+': {
  const [left, right] = rest;
  return `(${generate(left)} + ${generate(right)})`;
}
```

**Benefits:**
- ✅ **Simple pattern matching** - just switch on the first element
- ✅ **Easy to inspect** - `console.log()` shows everything
- ✅ **Easy to transform** - tree transformations are trivial
- ✅ **Easy to extend** - add a case, done
- ✅ **64% less code** - proven in production (Rip compiler: 9,450 LOC vs CoffeeScript: 17,760 LOC)

---

## Performance That Matters

**Solar generates parsers in ~58ms. Jison takes ~12,500ms.**

Why does this matter? **Iteration speed.**

**With Jison (12.5 seconds):**
- Edit grammar → wait → coffee break → check result
- ~5-10 iterations per hour
- Slow feedback discourages experimentation

**With Solar (58ms):**
- Edit grammar → instant feedback → iterate
- ~100+ iterations per hour
- Rapid experimentation enabled

### Benchmark Results

**Real-world test:** Rip's CoffeeScript-compatible grammar (91 types, 406 production rules, 802 lines)

| Metric | Jison | Solar (Bun) | Solar (Node) | Winner |
|--------|-------|-------------|--------------|--------|
| **Generation time** | 12,500ms | 58ms | 180ms | **Solar ~215×** |
| **Dependencies** | Many | Zero | Zero | **Solar** |
| **Code size** | 2,285 LOC | 1,260 LOC | 1,260 LOC | **Solar 45%** |
| **Output** | AST classes | S-expressions | S-expressions | **Solar (simpler)** |

**Performance breakdown** (Solar on Bun, average of 10 runs):
```
processGrammar:     ~3ms   (5%)
buildLRAutomaton:  ~40ms   (69%)
processLookaheads: ~11ms   (19%)
buildParseTable:   ~10ms   (17%)
──────────────────────────
Total:             ~58ms   (range: 56-61ms)
```

**Note:** Jison took 12.5 seconds on a comparable grammar. Solar's runtime parser performance is identical to Jison (both generate SLR(1) state machines). The speedup is in *generation time*, enabling rapid iteration.

---

## Quick Start

### Installation

**With Bun (recommended):**

```bash
# As a library
bun add solar-parser

# As a global CLI tool
bun add -g solar-parser

# Now you can use the 'solar' command anywhere:
solar grammar.js -o parser.js
solar --help
```

**With Node.js:**

```bash
# As a library
npm install solar-parser

# As a global CLI tool
npm install -g solar-parser

# Now you can use the 'solar' command anywhere:
solar grammar.js -o parser.js
solar --help

# Or use without installing:
npx solar-parser grammar.js -o parser.js
```

**Runtime Selection:**

Solar works with both Bun and Node.js. The runtime is automatically determined by how you install:

- **Bun only installed:** `solar` runs on Bun (~58ms) ⚡
- **npm only installed:** `solar` runs on Node.js (~180ms) ✅
- **Both installed:** `solar` uses the package manager that installed it

**Force Bun for best performance** (if you have both):

```bash
# One-time command:
bun $(which solar) grammar.js -o parser.js

# Or create an alias for convenience:
alias solar-bun='bun $(which solar)'
solar-bun grammar.js -o parser.js  # Always uses Bun
```

### Basic Usage (S-Expression Mode)

```javascript
import { Generator } from 'solar-parser';

// Define your grammar
const grammar = {
  mode: 'sexp',  // Enable s-expression output

  // Grammar rules
  grammar: {
    Program: [
      ['Statement', '[1]'],
      ['Program Statement', '[...1, 2]']
    ],

    Statement: [
      ['Expression ;', '1']
    ],

    Expression: [
      ['NUMBER', '1'],
      ['Expression + Expression', '["+", 1, 3]'],
      ['Expression * Expression', '["*", 1, 3]']
    ]
  },

  // Operator precedence
  operators: [
    ['left', '+', '-'],
    ['left', '*', '/']
  ]
};

// Generate parser
const generator = new Generator(grammar);
const parserCode = generator.generate();

// Write to file
import fs from 'fs';
fs.writeFileSync('parser.js', parserCode);
```

**Output for `2 + 3 * 4`:**
```javascript
['+', '2', ['*', '3', '4']]
```

### Traditional AST Mode (Jison-Compatible)

Solar also supports traditional Jison-style grammars:

```javascript
const grammar = {
  bnf: {
    Expression: [
      ['NUMBER', 'return new NumberNode($1)'],
      ['Expression + Expression', 'return new BinaryOp("+", $1, $3)']
    ]
  },
  operators: [['left', '+']]
};
```

---

## Grammar Syntax

### The `o` Helper (Optional but Recommended)

```javascript
const o = (pattern, action, options) => {
  pattern = pattern.trim().replace(/\s{2,}/g, ' ');
  return [pattern, action ?? 1, options];
};

// Usage:
grammar = {
  Expression: [
    o('NUMBER'),                           // Pass-through
    o('Expression + Expression', '["+", 1, 3]'),
    o('( Expression )', '2'),              // Unwrap parens
    o('Expression * Expression', '["*", 1, 3]', {prec: '*'})
  ]
}
```

### S-Expression Action Styles

Solar's sexp mode has three action styles:

#### Style 1: Pass-Through (Default)

When you omit the action (defaults to `1`), returns the first token:

```javascript
Expression: [
  o('Value'),      // Returns Value (position 1)
  o('Operation')   // Returns Operation (position 1)
]
```

#### Style 2: Simple S-Expression (Recommended)

**Most common style** - bare numbers become token references:

```javascript
// Pattern positions:  1    2          3     4    5
If: [
  o('IF Expression Block', '["if", 2, 3]'),
  o('IF Expression Block ELSE Block', '["if", 2, 3, 5]')
]
```

**Generated output:**
```javascript
["if", condition, thenBlock]
["if", condition, thenBlock, elseBlock]
```

**How it works:** Solar automatically converts:
- `2` → `$$[$0-3]` (Expression)
- `3` → `$$[$0-2]` (Block)
- `5` → `$$[$0]` (Block after ELSE)

**Use for:** 90% of your grammar rules!

#### Style 3: Advanced ($n References)

When you need conditional logic or literal numbers:

```javascript
Parenthetical: [
  o('( Body )', '$2.length === 1 ? $2[0] : $2')
]
```

The `1` in `.length === 1` and `0` in `[0]` are **NOT** replaced because you used `$n` syntax.

**Use for:** Conditional logic, array manipulation, transformations

### Spread Operator

Build arrays incrementally:

```javascript
Body: [
  o('Line', '[1]'),                        // Wrap: [Line]
  o('Body TERMINATOR Line', '[...1, 3]')   // Spread: [...Body, Line]
]
```

---

## S-Expression Reference

### Common Node Types

```javascript
// Variables & Assignment
['=', target, value]
['+=', target, value]
['&&=', target, value]
['??=', target, value]

// Functions
['def', name, params, body]          // Named function
['->', params, body]                 // Anonymous (unbound this)
['=>', params, body]                 // Arrow (bound this)

// Calls & Property Access
[callee, ...args]                    // Function call
['await', expr]                      // Await
['.', obj, 'prop']                   // Property: obj.prop
['?.', obj, 'prop']                  // Optional: obj?.prop
['[]', arr, index]                   // Index: arr[index]
['?[]', arr, index]                  // Optional: arr?.[index]

// Operators
['+', left, right]                   // Binary
['!', expr]                          // Unary
['?:', condition, thenExpr, elseExpr] // Ternary

// Control Flow
['if', condition, thenBlock, elseBlock?]
['while', condition, body]
['for-in', vars, iterable, guard?, body]

// Data Structures
['array', ...elements]
['object', ...pairs]                 // pairs: [key, value]
['...', expr]                        // Spread

// Other
['block', ...statements]
['return', expr?]
```

### Why Arrays?

**Disambiguation is by operand count:**

```javascript
['...', expr]           // Unary spread (1 operand)
['...', from, to]       // Exclusive range (2 operands)
['..', from, to]        // Inclusive range (2 operands)
```

Your codegen just checks `rest.length` to determine meaning.

---

## Grammar Modes

Solar supports two grammar modes:

### 1. S-Expression Mode (Recommended)

```javascript
const grammar = {
  mode: 'sexp',
  grammar: {
    Expression: [
      o('NUMBER', '1'),
      o('Expression + Expression', '["+", 1, 3]')
    ]
  }
};
```

**Output:** Simple nested arrays

### 2. Jison Mode (Compatible)

```javascript
const grammar = {
  bnf: {
    Expression: [
      ['NUMBER', 'return new NumberNode($1)'],
      ['Expression + Expression', 'return new BinaryOp("+", $1, $3)']
    ]
  }
};
```

**Output:** Whatever your actions return (AST nodes, objects, etc.)

---

## CLI Usage

After installing globally (see Installation above), use the `solar` command:

```bash
# Generate parser from grammar file
solar grammar.js -o parser.js

# Show statistics
solar --stats grammar.js

# Combine stats and generation
solar --stats --output parser.js grammar.js

# Get help
solar --help
```

**Without global install:**

```bash
# With Bun:
bun x solar-parser grammar.js -o parser.js

# With npm/npx:
npx solar-parser grammar.js -o parser.js

# Or run directly:
node node_modules/solar-parser/lib/solar.js grammar.js -o parser.js
```

---

## API Reference

### Generator Class

```javascript
import { Generator } from 'solar-parser';

const generator = new Generator(grammar, options);
```

**Options:**
- `debug: boolean` - Enable debug tracing output

**Methods:**
- `generate()` - Returns parser code as string
- `createParser()` - Returns parser instance (for runtime use)

### Parser Class

```javascript
import { Parser } from './parser.js';

const parser = new Parser();
parser.lexer = myLexer;  // Attach your lexer

const result = parser.parse(input);
```

---

## Versions Available

Solar is distributed as **pure JavaScript (ES2022)**:

### **Production Package**
```bash
# With Bun (recommended):
bun add solar-parser

# With npm:
npm install solar-parser
```

**What you get:**
- ✅ Pure JavaScript (ES2022) - no build step
- ✅ Single self-contained file (~47KB)
- ✅ Zero dependencies
- ✅ Works with Bun, Node.js, and Deno
- ✅ CLI command included

### **Source Code**

Solar is pure JavaScript with zero dependencies:

```bash
# Clone the repo to see the source:
git clone https://github.com/shreeve/solar
cd solar/lib/

# File:
# - solar.js   (Single JavaScript source file)
```

**Note:** Solar is a single, self-contained JavaScript file (~47KB, 1,260 lines). No build step required! The original concept was prototyped in Rip, then implemented in TypeScript, and is now maintained as clean JavaScript for maximum simplicity.

---

## Real-World Example

Here's a simple calculator grammar:

```javascript
const grammar = {
  mode: 'sexp',

  grammar: {
    Program: [
      o('Expression', '[1]')
    ],

    Expression: [
      o('NUMBER', '1'),
      o('( Expression )', '2'),
      o('Expression + Expression', '["+", 1, 3]'),
      o('Expression - Expression', '["-", 1, 3]'),
      o('Expression * Expression', '["*", 1, 3]'),
      o('Expression / Expression', '["/", 1, 3]')
    ]
  },

  operators: [
    ['left', '+', '-'],
    ['left', '*', '/']
  ]
};
```

**Input:** `2 + 3 * 4`

**S-Expression Output:**
```javascript
['+', '2', ['*', '3', '4']]
```

**Simple Evaluator:**
```javascript
function evaluate(sexpr) {
  if (typeof sexpr === 'string') return parseFloat(sexpr);

  const [op, ...args] = sexpr;
  const values = args.map(evaluate);

  switch (op) {
    case '+': return values[0] + values[1];
    case '-': return values[0] - values[1];
    case '*': return values[0] * values[1];
    case '/': return values[0] / values[1];
  }
}

evaluate(['+', '2', ['*', '3', '4']]);  // → 14
```

**Notice:** No AST classes, no visitor pattern, no complex traversal logic. Just pattern matching.

---

## Integration with Lexers

Solar is **lexer-agnostic** - use any lexer that implements the expected interface:

```javascript
// Minimal lexer interface
class MyLexer {
  setInput(input, yy) {
    this.input = input;
    // ... initialize
  }

  lex() {
    // Return token name or EOF
    return 'NUMBER';
  }

  // Properties expected:
  // - yytext: matched text
  // - yyleng: match length
  // - yylineno: line number
  // - yylloc: location {first_line, first_column, last_line, last_column}
}

parser.lexer = new MyLexer();
```

**Works great with:**
- CoffeeScript's lexer (used by Rip)
- Jison's lexer
- Your custom lexer
- Any lexer implementing the interface

---

## Debugging

### View S-Expression Output

If you're building a Rip-style compiler:

```bash
echo 'x = 42' | ./bin/rip -s
# Output: ["=", "x", 42]
```

### Check Generated Parser

```bash
# View specific case in generated parser
grep -A 2 "case 123:" parser.js
```

### Grammar Development Tips

1. **Start simple** - Build grammar incrementally
2. **Test each rule** - Generate parser after each change (80ms makes this pleasant!)
3. **Use style 2 actions** - `'["+", 1, 3]'` for 90% of rules
4. **Document token positions** - Makes rules self-documenting
   ```javascript
   o('IF Expression Block ELSE Block', '["if", 2, 3, 5]')
   #  1   2          3     4    5            cond then else
   ```

---

## Comparison with Other Tools

### vs Jison

| Feature | Jison | Solar |
|---------|-------|-------|
| Generation speed | 12,500ms | 58ms (~215× faster) |
| Output | AST classes | S-expressions or AST |
| Dependencies | Many | Zero |
| Code size | 2,285 LOC | 1,260 LOC |
| Self-hosting | No | Yes |
| Learning curve | Steep | Gentle |

### vs PEG.js

| Feature | PEG.js | Solar |
|---------|--------|-------|
| Algorithm | PEG | SLR(1) |
| Left recursion | No | Yes |
| Precedence | Manual | Built-in |
| Output | Custom | S-expressions or AST |
| Speed | Fast | Faster generation |

### vs Hand-Written Parsers

| Feature | Hand-Written | Solar |
|---------|--------------|-------|
| Development time | Weeks | Hours |
| Maintenance | Hard | Easy (change grammar) |
| Correctness | Error-prone | Proven algorithm |
| Flexibility | Ultimate | Very high |

---

## Design Philosophy

### Simplicity Over Complexity

Solar embraces the philosophy that **simple data structures** (arrays) are better than **complex object hierarchies** (AST classes).

**Three design principles:**

1. **Plain Data** - S-expressions are just arrays. Easy to inspect, transform, serialize.

2. **Separation of Concerns** - Structure (grammar) is separate from behavior (your codegen). Change one without touching the other.

3. **Fast Feedback** - 80ms generation enables rapid experimentation. Your grammar changes should feel instant.

### When to Use S-Expressions

**Use s-expression mode when:**
- Building a compiler or transpiler
- You want clean intermediate representation
- You'll traverse the tree multiple times (optimizations, analysis, etc.)
- You value simplicity and debuggability

**Use traditional AST mode when:**
- Integrating with existing Jison grammars
- You need complex node behaviors
- You're already invested in AST class hierarchies

---

## About Rip

Solar was originally developed as part of **Rip** - a modern scripting language that's like "CoffeeScript 3". Rip proved the s-expression approach works: it's a **complete, self-hosting compiler in 9,450 LOC** compared to CoffeeScript's 17,760 LOC (50% reduction).

Solar is now being extracted as a standalone tool because the approach is valuable for **any** language implementation.

**Learn more about Rip:** https://github.com/shreeve/rip-lang

---

## Contributing

Solar is designed to be clean-room simple:

1. **Repository structure:**
   ```
   lib/
     solar.js        # Source code & entry point (ONE FILE!)
   scripts/
     sync-version.cjs # Version sync utility
   ```

2. **Development workflow:**
   ```bash
   # Clone and setup
   git clone https://github.com/shreeve/solar
   cd solar

   # Make changes
   vi lib/solar.js    # Edit directly - no build!

   # Test immediately
   bun lib/solar.js --help
   bun lib/solar.js docs/calculator.js -o test.js
   
   # Publish (syncs version automatically)
   npm publish
   ```

3. **Philosophy:**
   - Keep it simple
   - Zero runtime dependencies
   - Fast feedback (don't sacrifice generation speed)
   - S-expressions first
   - ES2022 modern JavaScript

---

## License

MIT

---

## Credits

**Inspired by:**
- Yacc/Bison (algorithm)
- Jison (API design)
- CoffeeScript (lexer integration)
- Lisp/Scheme (s-expressions)

**Built by:** Developers who believe simplicity scales

**Performance enabled by:** Clean algorithms + void operators + simple data structures

---

## FAQ

**Q: Is Solar production-ready?**
A: Yes. It's been battle-tested as part of the Rip compiler (864/864 tests passing).

**Q: Can I use my existing Jison grammar?**
A: Yes! Solar supports Jison-compatible grammars (just use `bnf` instead of `grammar`).

**Q: What about LR(1) or LALR(1)?**
A: Solar is SLR(1). For most languages, this is sufficient. If you need stronger parsing, use Jison.

**Q: Why not PEG?**
A: PEG doesn't handle left recursion naturally. Solar/SLR(1) does.

**Q: Do I need to know Rip?**
A: No! Solar is pure JavaScript (ES2022). The original concept was prototyped in Rip, but the current implementation is standalone JavaScript.

**Q: Can I output JSON/XML/etc instead of s-expressions?**
A: Yes! Your grammar actions can return anything. S-expressions are just the recommended approach.

**Q: How do I handle errors?**
A: Solar generates standard LR parsers with error recovery. Override `parseError()` for custom handling.

**Q: Is this used in production?**
A: Yes - the Rip compiler uses Solar in production, compiling itself and all Rip code.

---

**Start simple. Build incrementally. Ship elegantly.** ✨

**Try Solar today and rediscover the joy of fast iteration.**
