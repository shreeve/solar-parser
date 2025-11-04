<p align="center">
  <img src="docs/solar-1280w.png" alt="Solar Logo" width="800">
</p>

# Solar

**Fast SLR(1) Parser Generator with S-Expression Mode**

Solar is a standalone parser generator (like Yacc/Bison/Jison) that generates parsers **~215× faster** than Jison while producing cleaner, simpler output. Instead of complex AST class hierarchies, Solar offers **s-expression mode** - outputting simple nested arrays that are trivial to transform and debug.

```bash
# Jison:  12,500ms to generate parser 😴
# Solar:      58ms to generate parser ⚡

bun add solar-parser      # Recommended (fastest)
npm install solar-parser  # Also works
```

**One self-contained JavaScript file. Zero dependencies. Maximum simplicity.**

---

## Why Solar?

**If you've ever wished Jison was:**
- ⚡ **~215× faster** at generating parsers
- 🎯 **Simpler** - arrays instead of AST classes
- 📦 **Smaller** - 45% less code (1,273 LOC vs Jison's 2,285)
- 🚀 **Zero dependencies** - completely standalone
- 🎨 **More flexible** - output s-expressions OR traditional AST nodes

**Then Solar is for you.**

---

## Quick Start

### Installation

```bash
# With Bun (recommended - fastest):
bun add -g solar-parser

# With npm:
npm install -g solar-parser

# Now use the 'solar' command:
solar grammar.js -o parser.js
solar --help
```

### Your First Grammar

```javascript
// calculator.js
export default {
  grammar: {
    Expression: [
      ['NUMBER'],
      ['Expression + Expression', '["+", 1, 3]'],
      ['Expression * Expression', '["*", 1, 3]'],
      ['( Expression )', '2']
    ]
  },

  operators: [
    ['left', '+', '-'],
    ['left', '*', '/']
  ]
};
```

Generate parser:
```bash
solar calculator.js -o parser.js
```

Input: `2 + 3 * 4`  
Output: `['+', '2', ['*', '3', '4']]`

---

## The S-Expression Advantage

### Traditional AST (Complex)

```javascript
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
```

**Problems:** Hundreds of node classes, complex inheritance, hard to extend

### Solar's S-Expressions (Simple)

```javascript
// Grammar action:
['Expression + Expression', '["+", 1, 3]']

// Output:
['+', left, right]

// Your compiler (simple pattern matching):
switch (op) {
  case '+': return `(${gen(left)} + ${gen(right)})`;
  case '*': return `(${gen(left)} * ${gen(right)})`;
}
```

**Benefits:**
- ✅ Simple pattern matching (switch on first element)
- ✅ Easy to inspect (`console.log()` shows everything)
- ✅ Easy to transform (tree transformations are trivial)
- ✅ **64% less code** (proven: Rip 9,450 LOC vs CoffeeScript 17,760 LOC)

---

## Performance

**Solar generates parsers in ~58ms. Jison takes ~12,500ms.**

### Benchmark Results

**Real-world test:** Rip's CoffeeScript-compatible grammar (91 types, 406 rules, 802 lines)

| Metric | Jison | Solar (Bun) | Solar (Node) | Winner |
|--------|-------|-------------|--------------|--------|
| **Generation time** | 12,500ms | 58ms | 180ms | **Solar ~215×** |
| **Dependencies** | Many | Zero | Zero | **Solar** |
| **Code size** | 2,285 LOC | 1,273 LOC | 1,273 LOC | **Solar 45%** |
| **Output** | AST classes | S-expressions | S-expressions | **Solar (simpler)** |

**Performance breakdown** (Solar on Bun):
```
processGrammar:     ~3ms   (5%)
buildLRAutomaton:  ~40ms  (69%)
processLookaheads: ~11ms  (19%)
buildParseTable:   ~10ms  (17%)
──────────────────────────
Total:             ~58ms
```

**Why speed matters:** 58ms feels instant. Edit grammar → test → iterate. Jison's 12.5 seconds kills your flow.

---

## CLI Usage

```bash
# Generate parser
solar grammar.js -o parser.js

# Show grammar information
solar --info grammar.js

# Show grammar as s-expression
solar --sexpr grammar.js

# Show version
solar --version

# Help
solar --help
```

---

## Grammar Syntax

### Basic Structure

```javascript
// grammar.js
export default {
  // S-expression mode is default (no mode field needed!)
  
  grammar: {
    RuleName: [
      ['pattern', 'action'],
      ['another pattern', 'action', { prec: 'OPERATOR' }]
    ]
  },
  
  operators: [
    ['left', '+', '-'],
    ['left', '*', '/']
  ]
};
```

Each rule: `[pattern, action?, options?]`

### Three Action Styles

#### Style 1: Pass-Through (Default)

Omit action or use `1` to return first token:

```javascript
Expression: [
  ['Value'],        // Omit action (defaults to 1)
  ['Operation', 1]  // Explicit 1
]
```

**Generated:** `return $$[$0];`

#### Style 2: Simple S-Expression (Most Common)

**Bare numbers** become token references:

```javascript
// Pattern positions:  1  2          3     4    5
If: [
  ['IF Expression Block', '["if", 2, 3]'],
  ['IF Expression Block ELSE Block', '["if", 2, 3, 5]']
]
```

**How it works:**
- `2` → `$$[$0-3]` (Expression)
- `3` → `$$[$0-2]` (Block)
- `5` → `$$[$0]` (Block after ELSE)

**Output:** `["if", condition, thenBlock, elseBlock?]`

**Use this for 90% of your rules!**

#### Style 3: Advanced ($n References)

Use `$n` syntax when you need conditional logic or literal numbers:

```javascript
Parenthetical: [
  ['( Body )', '$2.length === 1 ? $2[0] : $2']
]
```

**Key:** The `1` in `.length === 1` and `0` in `[0]` are **NOT** replaced because you used `$n`.

### Spread Operator

Build arrays incrementally:

```javascript
Body: [
  ['Line', '[1]'],                       // Wrap: [Line]
  ['Body TERMINATOR Line', '[...1, 3]']  // Spread: [...Body, Line]
]
```

### Precedence & Associativity

```javascript
operators: [
  ['right', '=', ':'],      // Lowest precedence
  ['left', '+', '-'],
  ['left', '*', '/', '%'],
  ['right', '**'],
  ['left', '&&'],
  ['left', '||'],
  ['nonassoc', '++', '--'], // Highest precedence
]
```

Listed from **lowest to highest** precedence.

---

## API Reference

### Programmatic Usage

```javascript
import { Generator } from 'solar-parser';

const grammar = {
  grammar: {
    Expression: [
      ['NUMBER'],
      ['Expression + Expression', '["+", 1, 3]']
    ]
  },
  operators: [['left', '+']]
};

// Generate parser code
const generator = new Generator(grammar);
const parserCode = generator.generate();

// Write to file
import fs from 'fs';
fs.writeFileSync('parser.js', parserCode);
```

### Using Generated Parser

```javascript
import { Parser } from './parser.js';

const parser = new Parser();
parser.lexer = myLexer;  // Attach your lexer

const result = parser.parse('2 + 3 * 4');
console.log(result);  // ['+', '2', ['*', '3', '4']]
```

### Lexer Interface

Solar works with any lexer implementing this interface:

```javascript
class MyLexer {
  setInput(input, yy) {
    this.input = input;
    // Initialize lexer state
  }
  
  lex() {
    // Return token name (string) or EOF (1)
    return 'NUMBER';
  }
  
  // Required properties:
  // - yytext: matched text
  // - yyleng: match length
  // - yylineno: line number (0-based)
  // - yylloc: { first_line, last_line, first_column, last_column }
}
```

**Compatible with:**
- CoffeeScript's lexer
- Jison's lexer
- Your custom lexer

---

## S-Expression Reference

### Common Node Types

```javascript
// Variables & Assignment
['=', target, value]
['+=', target, value]

// Functions
['def', name, params, body]
['->', params, body]         // Arrow function
['=>', params, body]         // Fat arrow (bound this)

// Calls & Access
[callee, ...args]            // Function call
['.', obj, 'prop']           // Property access
['[]', arr, index]           // Array index

// Operators
['+', left, right]           // Binary
['!', expr]                  // Unary
['?:', cond, then, else]     // Ternary

// Control Flow
['if', condition, thenBlock, elseBlock?]
['while', condition, body]
['for-in', vars, iterable, guard?, body]

// Data Structures
['array', ...elements]
['object', ...pairs]         // pairs: [key, value]
['...', expr]                // Spread

// Other
['block', ...statements]
['return', expr?]
```

### Disambiguation by Arity

```javascript
['...', expr]          // Unary spread (1 operand)
['...', from, to]      // Exclusive range (2 operands)
['..', from, to]       // Inclusive range (2 operands)
```

Your codegen checks operand count to determine meaning.

---

## Grammar Development

### Tips for Writing Grammars

1. **Start simple** - Build incrementally
2. **Test often** - 58ms makes testing pleasant!
3. **Use Style 2 actions** - `'["+", 1, 3]'` for most rules
4. **Document positions** - Add comments for clarity:
   ```javascript
   ['IF Expression Block ELSE Block', '["if", 2, 3, 5]']
   // 1   2          3     4    5            cond then else
   ```

### Common Patterns

```javascript
// Assignment
['Assignable = Expression', '["=", 1, 3]']

// Binary operator
['Expression + Expression', '["+", 1, 3]']

// Unary operator
['! Expression', '["!", 2]']

// Function definition
['FUNCTION Identifier ( ParamList ) Block', '["function", 2, 4, 6]']

// Unwrap parentheses
['( Expression )', '2']

// Build array from single element
['Line', '[1]']

// Build array incrementally
['Lines Line', '[...1, 2]']
```

### Debugging

```bash
# View generated code
cat parser.js | head -50

# Find specific case
grep -A 2 "case 123:" parser.js

# Check grammar structure
solar --sexpr grammar.js
```

---

## Jison Compatibility Mode

Solar also supports traditional Jison grammars:

```javascript
const grammar = {
  bnf: {  // Use 'bnf' instead of 'grammar' for Jison mode
    Expression: [
      ['NUMBER', 'return new NumberNode($1)'],
      ['Expression + Expression', 'return new BinaryOp("+", $1, $3)']
    ]
  },
  operators: [['left', '+']]
};
```

**Named symbol references** (Jison feature):
```javascript
Rule: [
  ['Var[name] = Expr[value]', 'return assign($name, $value)']
  // Clearer than: 'return assign($1, $3)'
]
```

---

## Installation & Runtime

### Choose Your Runtime

Solar works with Bun, Node.js, and Deno. The shebang is `#!/usr/bin/env node` which all three can execute.

**Install with Bun (recommended):**
```bash
bun add -g solar-parser
solar grammar.js  # Runs on Bun (~58ms) ⚡
```

**Install with npm:**
```bash
npm install -g solar-parser
solar grammar.js  # Runs on Node.js (~180ms) ✅
```

**Force Bun if you have both:**
```bash
# One-time:
bun $(which solar) grammar.js -o parser.js

# Or create alias:
alias solar-bun='bun $(which solar)'
solar-bun grammar.js  # Always uses Bun
```

### As a Library

```bash
bun add solar-parser      # For projects
npm install solar-parser
```

```javascript
import { Generator } from 'solar-parser';
```

---

## Real-World Example

Complete calculator with s-expression output:

```javascript
// calculator.js
export default {
  grammar: {
    Program: [
      ['Expression', '[1]']
    ],
    
    Expression: [
      ['NUMBER'],
      ['Expression + Expression', '["+", 1, 3]'],
      ['Expression - Expression', '["-", 1, 3]'],
      ['Expression * Expression', '["*", 1, 3]'],
      ['Expression / Expression', '["/", 1, 3]'],
      ['( Expression )', '2'],
      ['- Expression', '["-", 2]', { prec: 'UMINUS' }]
    ]
  },
  
  operators: [
    ['left', '+', '-'],
    ['left', '*', '/'],
    ['right', 'UMINUS']
  ]
};
```

**Generate and test:**
```bash
solar calculator.js -o calc-parser.js

# Show statistics
solar --info calculator.js
# Output:
# • Tokens: 8
# • Types: 3
# • Rules: 9
# • States: 17
# • Conflicts: 0
```

**Simple evaluator:**
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

**Notice:** No AST classes, no visitor pattern, no complex traversal. Just pattern matching.

---

## Grammar Modes

### S-Expression Mode (Default)

```javascript
export default {
  grammar: {
    Expression: [
      ['NUMBER'],
      ['Expression + Expression', '["+", 1, 3]']
    ]
  }
};
```

**Output:** Simple nested arrays

### Jison Mode (Compatible)

```javascript
export default {
  bnf: {  // 'bnf' triggers Jison mode
    Expression: [
      ['NUMBER', 'return new NumberNode($1)'],
      ['Expression + Expression', 'return new BinaryOp("+", $1, $3)']
    ]
  }
};
```

**Output:** Whatever your actions return (AST nodes, objects, etc.)

---

## Architecture

### How Solar Works

```
Grammar Spec → processGrammar → buildLRAutomaton → processLookaheads → buildParseTable → Generate Code
     ↓              ↓                  ↓                    ↓                  ↓              ↓
  Parse rules    Build IR        Build states       Compute FIRST/      Create action   Output
  & operators    structures                         FOLLOW sets         table           parser.js
```

### Core Algorithm (SLR(1))

1. **Process Grammar** (~3ms)
   - Parse rules and operators
   - Build symbol tables
   - Assign precedences

2. **Build LR Automaton** (~40ms)
   - Compute closures
   - Build state transitions
   - Group items by nextSymbol

3. **Process Lookaheads** (~11ms)
   - Compute NULLABLE sets
   - Compute FIRST sets
   - Compute FOLLOW sets
   - Assign item lookaheads

4. **Build Parse Table** (~10ms)
   - Generate shift/reduce/accept actions
   - Resolve conflicts with precedence
   - Compute default actions

**Result:** Efficient SLR(1) parse table ready for code generation

---

## Advanced Features

### Token Metadata

Your lexer can attach metadata to tokens, which Solar preserves:

```javascript
// String tokens
token.quote = '"';        // Preserve quote style
token.double = true;

// Number tokens  
token.parsedValue = 42;   // Pre-parsed value

// All tokens
token.range = [start, end];  // For source maps
```

These properties are available in your grammar actions via `$n`.

### Named Symbol References

For complex patterns:

```javascript
Rule: [
  ['Var[name] = Expr[value]', '$name = $value']
  // Instead of: '$1 = $3'
]
```

Solar strips `[name]` from patterns and maps them in actions.

### Error Handling

```javascript
// Override parseError for custom handling
parser.yy.parseError = (str, hash) => {
  console.error(`Syntax error at line ${hash.line}: ${str}`);
  console.error(`Expected: ${hash.expected.join(' or ')}`);
};
```

### Debug Mode

```javascript
const generator = new Generator(grammar, { debug: true });
```

Enables trace output during parsing.

---

## Comparison with Other Tools

### vs Jison

| Feature | Jison | Solar |
|---------|-------|-------|
| Generation speed | 12,500ms | 58ms (~215× faster) |
| Output | AST classes | S-expressions or AST |
| Dependencies | Many | Zero |
| Code size | 2,285 LOC | 1,273 LOC |
| Self-hosting | No | Yes |
| Learning curve | Steep | Gentle |

### vs PEG.js

| Feature | PEG.js | Solar |
|---------|--------|-------|
| Algorithm | PEG | SLR(1) |
| Left recursion | No (manual workaround) | Yes (native) |
| Precedence | Manual rewriting | Built-in |
| Output | Custom | S-expressions or AST |

### vs Hand-Written

| Feature | Hand-Written | Solar |
|---------|--------------|-------|
| Development time | Weeks | Hours |
| Maintenance | Hard | Easy (just edit grammar) |
| Correctness | Error-prone | Proven algorithm |
| Flexibility | Ultimate | Very high |

---

## Design Philosophy

### Simplicity Over Complexity

**Three core principles:**

1. **Plain Data** - S-expressions are just arrays. Easy to inspect, transform, serialize.

2. **Separation of Concerns** - Structure (grammar) separate from behavior (your codegen).

3. **Fast Feedback** - 58ms generation enables rapid experimentation.

### When to Use S-Expressions

**Use s-expression mode when:**
- Building a compiler or transpiler
- You want clean intermediate representation
- You'll traverse the tree multiple times
- You value simplicity and debuggability

**Use Jison mode when:**
- Integrating with existing Jison grammars
- You need complex node behaviors
- You're already invested in AST classes

---

## Source Code

Solar is **one self-contained JavaScript file:**

```bash
git clone https://github.com/shreeve/solar
cd solar/lib/
ls -lh solar.js  # 47KB, 1,273 lines
```

**Architecture:**
- Classes: Token, Type, Rule, Item, State, Generator
- Core algorithms: Closure, FIRST/FOLLOW, conflict resolution
- Code generation: Creates standalone parser modules
- CLI interface: Argument parsing, file I/O

**No build step required!** Edit `lib/solar.js` directly and test immediately.

---

## Contributing

### Development Workflow

```bash
# Clone
git clone https://github.com/shreeve/solar
cd solar

# Make changes
vi lib/solar.js    # Edit directly - no build!

# Test
bun lib/solar.js docs/calculator.js -o test.js

# Publish
# 1. Update version in package.json
# 2. Update VERSION in lib/solar.js (line 24)
# 3. Update @version in JSDoc (line 17)
npm publish
```

### Philosophy

- Keep it simple
- Zero runtime dependencies
- Fast feedback (don't sacrifice generation speed)
- S-expressions first
- Pure JavaScript (ES2022)

---

## Real-World Usage

**Rip Language Compiler** - Production usage of Solar

- **Complexity:** 91 types, 406 production rules
- **Result:** Complete self-hosting compiler in 9,450 LOC
- **Comparison:** CoffeeScript (similar language) is 17,760 LOC
- **Reduction:** 46% smaller codebase using s-expressions

**Learn more:** https://github.com/shreeve/rip-lang

---

## FAQ

**Q: Is Solar production-ready?**  
A: Yes. Battle-tested in the Rip compiler (864/864 tests passing).

**Q: Can I use my existing Jison grammar?**  
A: Yes! Use `bnf` instead of `grammar` in your spec.

**Q: What about LR(1) or LALR(1)?**  
A: Solar is SLR(1). Sufficient for most languages. Need stronger? Use Jison.

**Q: Why not PEG?**  
A: PEG doesn't handle left recursion naturally. SLR(1) does.

**Q: Can I output JSON/XML/etc instead of s-expressions?**  
A: Yes! Your actions can return anything. S-expressions are just recommended.

**Q: How do I handle errors?**  
A: Override `parser.yy.parseError()` for custom error handling.

**Q: Does it work with TypeScript?**  
A: Solar is pure JavaScript, but you can write grammars in .ts files (they're imported dynamically).

**Q: Why one file instead of modules?**  
A: Simplicity. One file is easier to understand, debug, and distribute.

---

## Examples

### Calculator (see docs/calculator.js)

Basic arithmetic with precedence and parentheses.

### Your Grammar Here!

Solar shines when building:
- Programming languages
- DSLs (Domain Specific Languages)
- Config file parsers
- Template languages
- Query languages

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

**Built by:** Steve Shreeve

**Performance enabled by:** Clean algorithms + modern JavaScript + simple data structures

---

**Start simple. Build incrementally. Ship elegantly.** ✨

**Try Solar today and rediscover the joy of fast iteration.**

