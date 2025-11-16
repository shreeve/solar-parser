// ==============================================================================
// Simple Calculator Grammar - Solar Parser Example
// ==============================================================================
//
// This grammar demonstrates Solar's s-expression mode with a basic calculator
// that handles numbers, parentheses, and the four basic arithmetic operators.
//
// Generate parser:
//   solar calculator.js -o calculator-parser.js
//
// Test grammar info:
//   solar --info calculator.js
//
// Example input:  2 + 3 * 4
// Example output: ["+", "2", ["*", "3", "4"]]
//
// The s-expression output clearly shows the parse tree with correct precedence.
// Multiplication has higher precedence than addition, so 3 * 4 is evaluated first.

export default {
  // Mode: s-expression (returns nested arrays representing the parse tree)
  mode: 'sexp',

  // Grammar rules
  grammar: {
    // Program is one or more expressions
    Program: [
      ['Expression', '1']
    ],

    // Expressions: numbers, operations, and parentheses
    Expression: [
      ['NUMBER', '1'],                              // Just return the number
      ['Expression + Expression', '["+", 1, 3]'],   // Addition
      ['Expression - Expression', '["-", 1, 3]'],   // Subtraction
      ['Expression * Expression', '["*", 1, 3]'],   // Multiplication
      ['Expression / Expression', '["/", 1, 3]'],   // Division
      ['( Expression )', '2'],                      // Parentheses (return inner)
      ['- Expression', '["-", 2]', { prec: 'UMINUS' }]  // Unary minus
    ]
  },

  // Operator precedence (lowest to highest)
  operators: [
    ['left', '+', '-'],   // Addition and subtraction (lowest precedence)
    ['left', '*', '/'],   // Multiplication and division (medium precedence)
    ['right', 'UMINUS']   // Unary minus (highest precedence)
  ]
};

// ==============================================================================
// Usage Example
// ==============================================================================
//
// After generating the parser, use it like this:
//
// import { Parser } from './calculator-parser.js';
//
// // You'll need a lexer that tokenizes: NUMBER, +, -, *, /, (, )
// const parser = new Parser();
// parser.lexer = myLexer;
//
// const result = parser.parse('2 + 3 * 4');
// // Result: ["+", "2", ["*", "3", "4"]]
//
// const result2 = parser.parse('(2 + 3) * 4');
// // Result: ["*", ["+", "2", "3"], "4"]
//
// const result3 = parser.parse('-5 + 10');
// // Result: ["+", ["-", "5"], "10"]
//
// ==============================================================================
// Lexer Requirements
// ==============================================================================
//
// Your lexer should return tokens in this format:
//
// Token types:
//   NUMBER  - A numeric value (e.g., "42", "3.14")
//   +       - Plus operator
//   -       - Minus operator
//   *       - Multiply operator
//   /       - Divide operator
//   (       - Left parenthesis
//   )       - Right parenthesis
//
// Example lexer implementation:
//
// class SimpleLexer {
//   setInput(input) {
//     this.input = input;
//     this.index = 0;
//   }
//
//   lex() {
//     // Skip whitespace
//     while (this.index < this.input.length &&
//            /\s/.test(this.input[this.index])) {
//       this.index++;
//     }
//
//     if (this.index >= this.input.length) return 'EOF';
//
//     const char = this.input[this.index];
//
//     // Check for operators and parentheses
//     if ('+-*/()'.includes(char)) {
//       this.yytext = char;
//       this.index++;
//       return char;
//     }
//
//     // Check for numbers
//     if (/\d/.test(char)) {
//       let num = '';
//       while (this.index < this.input.length &&
//              /[\d.]/.test(this.input[this.index])) {
//         num += this.input[this.index++];
//       }
//       this.yytext = num;
//       return 'NUMBER';
//     }
//
//     throw new Error(`Unexpected character: ${char}`);
//   }
// }
