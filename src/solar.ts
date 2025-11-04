#!/usr/bin/env node

/**
 * Solar - SLR(1) Parser Generator
 *
 * Fast, zero-dependency parser generator with s-expression mode.
 * Clean implementation influenced by Jison, rewritten in TypeScript for
 * type safety, readability, and maintainability.
 *
 * Relative performance for another grammar: ~58ms on Bun, ~180ms on Node.js
 * For best performance, install and run with Bun:
 *   bun add -g solar-parser
 *   solar grammar.js -o parser.js
 *
 * Works with Node.js too:
 *   npm install -g solar-parser
 *   solar grammar.js -o parser.js
 *
 * @author Steve Shreeve <steve.shreeve@gmail.com>
 * @version 1.1.0
 * @license MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const VERSION = '1.1.0';

// ==============================================================================
// Type Definitions
// ==============================================================================

interface Grammar {
  mode?: 'sexp' | 'jison';
  bnf?: Record<string, GrammarRules>;
  grammar?: Record<string, GrammarRules>;
  operators?: Operator[];
  start?: string;
  options?: Record<string, any>;
  parseParams?: string[];
}

type GrammarRules = string | GrammarRule[];
type GrammarRule = string | [string | string[], any?, any?];

type Operator = [string, ...string[]]; // ['left', '+', '-'] or ['right', '**']

interface OperatorInfo {
  precedence: number;
  assoc: string;
}

interface GeneratorOptions {
  debug?: boolean;
  [key: string]: any;
}

interface ParseError {
  text?: string;
  token?: string | number;
  line?: number;
  loc?: any;
  expected?: string[];
  recoverable?: boolean;
}

// ==============================================================================
// Terminal Symbol (Token)
// ==============================================================================

/**
 * Token - A terminal symbol that cannot be broken down further
 */
class Token {
  readonly id: number;
  readonly name: string;

  constructor(name: string, id: number) {
    this.id = id;
    this.name = name;
  }
}

// ==============================================================================
// Non-terminal Symbol (Type)
// ==============================================================================

/**
 * Type - A nonterminal symbol that can be matched by one or more rules
 */
class Type {
  readonly id: number;
  readonly name: string;
  readonly rules: Rule[];
  nullable: boolean;
  readonly firsts: Set<string>;
  readonly follows: Set<string>;

  constructor(name: string, id: number) {
    this.id = id;
    this.name = name;
    this.rules = [];
    this.nullable = false;
    this.firsts = new Set();
    this.follows = new Set();
  }
}

// ==============================================================================
// Production Rule
// ==============================================================================

/**
 * Rule - One possible match for a type (Expr → Expr + Term)
 */
class Rule {
  readonly id: number;
  readonly type: string;
  readonly symbols: string[];
  nullable: boolean;
  readonly firsts: Set<string>;
  precedence: number;

  constructor(type: string, symbols: string[], id: number) {
    this.id = id;
    this.type = type;
    this.symbols = symbols;
    this.nullable = false;
    this.firsts = new Set();
    this.precedence = 0;
  }
}

// ==============================================================================
// LR Item
// ==============================================================================

/**
 * Item - A rule with a dot position and lookaheads (Expr → Expr • + Term)
 */
class Item {
  readonly rule: Rule;
  readonly dot: number;
  readonly id: string;
  readonly lookaheads: Set<string>;
  readonly nextSymbol: string | undefined;

  constructor(rule: Rule, lookaheads?: Iterable<string> | null, dot: number = 0) {
    this.rule = rule;
    this.dot = dot;
    this.id = `${this.rule.id}:${this.dot}`;
    this.lookaheads = new Set(lookaheads || []);
    this.nextSymbol = this.rule.symbols[this.dot];
  }
}

// ==============================================================================
// LR State
// ==============================================================================

/**
 * State - A set of items with transitions to other states
 */
class State {
  id: number | null;
  readonly items: Set<Item>;
  readonly transitions: Map<string, number>;
  readonly reductions: Set<Item>;
  hasShifts: boolean;
  hasConflicts: boolean;
  signature?: string;

  constructor(...items: Item[]) {
    this.id = null;
    this.items = new Set(items);
    this.transitions = new Map();
    this.reductions = new Set();
    this.hasShifts = false;
    this.hasConflicts = false;
  }
}

// ==============================================================================
// SLR(1) Parser Generator
// ==============================================================================

/**
 * Generator - Main parser generator class
 */
class Generator {
  // Configuration
  readonly options: GeneratorOptions;
  readonly parseParams: string[];
  readonly yy: Record<string, any>;
  readonly indent: string;
  readonly mode: 'sexp' | 'jison';

  // Grammar structures
  readonly types: Record<string, Type>;
  readonly rules: Rule[];
  readonly operators: Record<string, OperatorInfo>;
  conflicts: number;
  readonly symbolTable: Map<string, Token | Type>;
  symbolIds: Record<string, number>;
  tokenNames: Record<number, string>;
  ruleData: number[][];
  performAction: string;
  states: State[];
  parseTable: any[];
  defaultActions: Record<number, any>;
  start: string;
  acceptRuleIndex: number;
  lexer?: any;
  moduleInclude?: string;

  constructor(grammar: Grammar, options: GeneratorOptions = {}) {
    // Configuration
    this.options = { ...grammar.options, ...options };
    this.parseParams = grammar.parseParams || [];
    this.yy = {};
    this.indent = '  ';

    // Detect grammar mode based on export structure
    if (grammar.mode === 'sexp') {
      this.mode = 'sexp';   // S-expression mode with compact syntax
    } else if (grammar.bnf != null) {
      this.mode = 'jison';  // Jison grammar with AST nodes (CoffeeScript compatibility)
    } else {
      throw new Error("Unknown grammar format: expected mode='sexp' or grammar.bnf property");
    }

    // Grammar structures
    this.types = {};
    this.rules = [];
    this.operators = {};
    this.conflicts = 0;

    // Initialize symbol table with special symbols
    this.symbolTable = new Map();
    this.symbolTable.set("$accept", new Type("$accept", 0));
    this.symbolTable.set("$end", new Token("$end", 1));
    this.symbolTable.set("error", new Token("error", 2));

    // Initialize other properties
    this.symbolIds = {};
    this.tokenNames = {};
    this.ruleData = [];
    this.performAction = '';
    this.states = [];
    this.parseTable = [];
    this.defaultActions = {};
    this.start = '';
    this.acceptRuleIndex = 0;

    // Build parser
    this.timing('💥 Total time', () => {
      this.timing('processGrammar', () => this.processGrammar(grammar));
      this.timing('buildLRAutomaton', () => this.buildLRAutomaton());
      this.timing('processLookaheads', () => this.processLookaheads());
      this.timing('buildParseTable', () => this.buildParseTable());
    });
  }

  // ============================================================================
  // Helper Functions
  // ============================================================================

  dedent(s: string, indent?: string): string {
    const m = s.match(/^[ \t]+(?=\S)/gm);
    const i = m ? Math.min(...m.map(x => x.length)) : 0;
    s = s.replace(new RegExp(`^[ \t]{${i}}`, 'gm'), '').trim();
    if (indent) s = s.replace(/^/gm, indent);
    return s;
  }

  timing<T>(label: string, fn: () => T): T {
    console.time(label);
    const result = fn();
    console.timeEnd(label);
    return result;
  }

  // ============================================================================
  // Grammar Processing
  // ============================================================================

  /**
   * Process the grammar specification and build internal structures
   * @param grammar - Grammar specification object
   */
  processGrammar(grammar: Grammar): void {
    if (grammar.operators) this._processOperators(grammar.operators);
    this._buildRules(grammar.grammar || grammar.bnf!);
    this._augmentGrammar(grammar);
  }

  private _processOperators(ops: Operator[]): void {
    for (let i = 0; i < ops.length; i++) {
      const precedence = ops[i];
      for (let k = 1; k < precedence.length; k++) {
        this.operators[precedence[k]] = {
          precedence: i + 1,
          assoc: precedence[0]
        };
      }
    }
  }

  private _buildRules(grammar: Record<string, GrammarRules>): void {
    const actionGroups: Record<string, string[]> = {};
    const ruleTable: number[][] = [[0]];
    this.symbolIds = { "$accept": 0, "$end": 1, "error": 2 };
    let symbolId = 3; // Next available symbol ID (after special symbols)

    // Add symbol to symbol table if not already present
    const addSymbol = (name: string): void => {
      if (!name || this.symbolIds[name]) return;

      // Use existing symbol or create a new one
      let symbol = this.symbolTable.get(name);
      if (!symbol) {
        const id = symbolId++;
        symbol = grammar[name] ? new Type(name, id) : new Token(name, id);
        this.symbolTable.set(name, symbol);
      }
      this.symbolIds[name] = symbol.id;
    };

    // Process types and their rules
    for (const type in grammar) {
      if (!Object.hasOwn(grammar, type)) continue;

      addSymbol(type);
      this.types[type] = this.symbolTable.get(type) as Type;

      const rules = grammar[type];
      const handles = typeof rules === 'string'
        ? rules.split(/\s*\|\s*/g)
        : [...rules];

      for (const handle of handles) {
        const [symbols, action, precedence] = this._parseHandle(handle);

        // Add symbols to grammar
        for (const symbol of symbols) {
          addSymbol(symbol);
        }

        // Process semantic actions
        let processedAction = '';
        if (action != null) {
          processedAction = this._processGrammarAction(action, symbols);
          const label = 'case ' + (this.rules.length + 1) + ':';
          if (actionGroups[processedAction]) {
            actionGroups[processedAction].push(label);
          } else {
            actionGroups[processedAction] = [label];
          }
        }

        // Create rule
        const rule = new Rule(type, symbols, this.rules.length + 1);

        // Set precedence
        this._assignPrecedence(rule, precedence);

        this.rules.push(rule);
        ruleTable.push([
          this.symbolIds[type],
          symbols[0] === '' ? 0 : symbols.length
        ]);
        this.types[type].rules.push(rule);
      }
    }

    // Generate parser components
    const actionsCode = this._generateActionCode(actionGroups);
    this.ruleData = ruleTable;
    this._buildTokenMappings();

    let parameters = "yytext, yyleng, yylineno, yy, yystate, $$, _$";
    if (this.parseParams?.length) {
      parameters += ', ' + this.parseParams.join(', ');
    }

    this.performAction = `function anonymous(${parameters}) {\n${actionsCode}\n}`;
  }

  private _parseHandle(handle: GrammarRule): [string[], any, any] {
    if (Array.isArray(handle)) {
      let symbols: string[];
      if (typeof handle[0] === 'string') {
        symbols = handle[0].trim().split(' ');
      } else {
        symbols = [...handle[0]];
      }
      symbols = symbols.map(e => e.replace(/\[[a-zA-Z_][a-zA-Z0-9_-]*\]/g, ''));

      const action = (typeof handle[1] === 'string' || handle.length === 3)
        ? handle[1]
        : null;
      const precedence = handle[2]
        ? handle[2]
        : (handle[1] && typeof handle[1] !== 'string' ? handle[1] : null);

      return [symbols, action, precedence];
    } else {
      const cleaned = handle.replace(/\[[a-zA-Z_][a-zA-Z0-9_-]*\]/g, '');
      const symbols = cleaned.trim().split(' ');
      return [symbols, null, null];
    }
  }

  private _processGrammarAction(action: any, symbols: string[]): string {
    switch (this.mode) {
      case 'sexp': {
        const getToken = (_: any, n: string): string => {
          const offset = parseInt(n, 10) - symbols.length;
          return `$$[$0${offset || ''}]`;
        };

        switch (typeof action) {
          case 'string': {
            // Look for $n (capture just digits) or all bare numbers
            let regex = /(?<!\$)\$(-?\d+)/gm;
            const hasDollar = regex.test(action);
            regex = hasDollar ? /(?<!\$)\$(-?\d+)/gm : /(-?\d+)/g;
            const result = action.replace(regex, getToken).trim();
            return `return ${result};`;
          }
          case 'number':
          case 'undefined': {
            const result = getToken('', String(action || 1));
            return `return ${result};`;
          }
          default:
            return 'return null;';
        }
      }

      case 'jison':
        switch (typeof action) {
          case 'string':
            return this._generateClassAction(action, symbols);
          case 'undefined':
            // Default: for empty rules, return ε/null, otherwise $$[1]
            return symbols.length === 0 ? 'return null;' : 'return $$[1];';
        }
        break;
    }

    throw new Error(`Invalid action type for mode ${this.mode}: ${typeof action}`);
  }

  private _generateClassAction(action: string, symbols: string[]): string {
    // Jison mode: process string actions like "-> new Value $1"
    // Process named semantic values
    if (action.match(/[$@][a-zA-Z][a-zA-Z0-9_]*/)) {
      const count: Record<string, number> = {};
      const names: Record<string, number> = {};

      for (let i = 0; i < symbols.length; i++) {
        const token = symbols[i];
        const match = token.match(/\[[a-zA-Z][a-zA-Z0-9_-]*\]/);
        const symbolsI = match ? match[0].slice(1, -1) : token;

        if (names[symbolsI]) {
          names[symbolsI + (++count[symbolsI])] = i + 1;
        } else {
          names[symbolsI] = i + 1;
          names[symbolsI + "1"] = i + 1;
          count[symbolsI] = 1;
        }
      }

      action = action
        .replace(/\$([a-zA-Z][a-zA-Z0-9_]*)/g, (str, pl) =>
          names[pl] ? '$' + names[pl] : str)
        .replace(/@([a-zA-Z][a-zA-Z0-9_]*)/g, (str, pl) =>
          names[pl] ? '@' + names[pl] : str);
    }

    // Transform $$ and positional references
    return action
      .replace(/([^'"])\$\$|^\$\$/g, '$1this.$')
      .replace(/@[0$]/g, "this._$")
      .replace(/\$(-?\d+)/g, (_, n) =>
        `$$[$0${parseInt(n, 10) - symbols.length || ''}]`)
      .replace(/@(-?\d+)/g, (_, n) =>
        `_$[$0${parseInt(n, 10) - symbols.length || ''}]`);
  }

  private _assignPrecedence(rule: Rule, precedence: any): void {
    if (precedence?.prec && this.operators[precedence.prec]) {
      rule.precedence = this.operators[precedence.prec].precedence;
    } else if (rule.precedence === 0) {
      // Use rightmost token's precedence
      for (let i = rule.symbols.length - 1; i >= 0; i--) {
        const token = rule.symbols[i];
        if (this.operators[token] && !this.types[token]) {
          rule.precedence = this.operators[token].precedence;
          break;
        }
      }
    }
  }

  private _generateActionCode(actionGroups: Record<string, string[]>): string {
    const actions: string[] = [];

    // Add $0 variable for token position references
    actions.push('const $0 = $$.length - 1;');

    actions.push('switch (yystate) {');
    for (const action in actionGroups) {
      if (!Object.hasOwn(actionGroups, action)) continue;
      const labels = actionGroups[action];

      if (action.includes('\n')) {
        actions.push(this.indent + labels.join(' '));
        actions.push(this.dedent(action, this.indent));
      } else {
        actions.push(this.indent + labels.concat(action).join(' '));
      }
      if (!action.trimStart().startsWith('return')) {
        actions.push(this.indent + 'break;');
      }
    }
    actions.push('}');

    return actions.join('\n')
      .replace(/YYABORT/g, 'return false')
      .replace(/YYACCEPT/g, 'return true');
  }

  private _buildTokenMappings(): void {
    this.tokenNames = {};

    for (const name in this.symbolIds) {
      if (!Object.hasOwn(this.symbolIds, name)) continue;
      const id = this.symbolIds[name];
      if (id >= 2 && !this.types[name]) {
        this.tokenNames[id] = name;
      }
    }
  }

  private _augmentGrammar(grammar: Grammar): void {
    if (this.rules.length === 0) {
      throw new Error("Grammar error: no rules defined.");
    }

    this.start = grammar.start || this.rules[0].type;
    if (!this.types[this.start]) {
      throw new Error(`Grammar error: no start symbol '${this.start}' defined.`);
    }

    const acceptRule = new Rule("$accept", [this.start, "$end"], 0);
    this.rules.push(acceptRule);
    this.acceptRuleIndex = this.rules.length - 1;

    this.types.$accept = this.symbolTable.get("$accept") as Type;
    this.types.$accept.rules.push(acceptRule);
    this.types[this.start].follows.add("$end");
  }

  // ============================================================================
  // LR Automaton Construction
  // ============================================================================

  /**
   * Build the LR(0) automaton by computing closures and transitions
   */
  buildLRAutomaton(): void {
    const acceptItem = new Item(this.rules[this.acceptRuleIndex]);
    const firstState = this._closure(new State(acceptItem));
    firstState.id = 0;
    firstState.signature = `${acceptItem.rule.id}.${acceptItem.dot}`;

    const states: State[] = [firstState];
    const stateMap = new Map<string, number>();
    stateMap.set(firstState.signature, 0);

    // Build automaton by exploring all transitions
    let marked = 0;
    while (marked < states.length) {
      const itemSet = states[marked++];

      // Single pass: group items by nextSymbol
      const symbolItems = new Map<string, Item[]>();
      for (const item of itemSet.items) {
        if (item.nextSymbol && item.nextSymbol !== '$end') {
          let items = symbolItems.get(item.nextSymbol);
          if (!items) {
            items = [];
            symbolItems.set(item.nextSymbol, items);
          }
          items.push(item);
        }
      }

      // Process each symbol with its pre-collected items
      for (const [symbol, items] of symbolItems) {
        this._insertStateWithItems(symbol, items, itemSet, states, stateMap);
      }
    }

    this.states = states;
  }

  private _closure(itemSet: State): State {
    const closureSet = new State();
    let workingSet = new Set(itemSet.items);
    const itemCores = new Map<string, Item>();

    // Process all items
    while (workingSet.size > 0) {
      const newItems = new Set<Item>();

      // Only process item cores we haven't yet seen
      for (const item of workingSet) {
        if (!itemCores.has(item.id)) {
          // Add item to closure
          closureSet.items.add(item);
          itemCores.set(item.id, item);

          // Check item type
          const { nextSymbol } = item;

          if (!nextSymbol) {
            // Reduction item
            closureSet.reductions.add(item);
            closureSet.hasConflicts = closureSet.reductions.size > 1 || closureSet.hasShifts;
          } else if (!this.types[nextSymbol]) {
            // Shift item (token)
            closureSet.hasShifts = true;
            closureSet.hasConflicts = closureSet.reductions.size > 0;
          } else {
            // Type - add items for all its rules
            const type = this.types[nextSymbol];
            for (const rule of type.rules) {
              // Create [B → •γ] with empty lookaheads (will be filled by FOLLOW sets later)
              const newItem = new Item(rule);
              if (!itemCores.has(newItem.id)) {
                newItems.add(newItem);
              }
            }
          }
        }
      }

      workingSet = newItems;
    }

    return closureSet;
  }

  private _goto(itemSet: State, symbol: string): State {
    const gotoSet = new State();

    for (const item of itemSet.items) {
      if (item.nextSymbol === symbol) {
        // Create advanced item (lookaheads will be set from FOLLOW sets later)
        const newItem = new Item(item.rule, null, item.dot + 1);
        gotoSet.items.add(newItem);
      }
    }

    return gotoSet.items.size === 0 ? gotoSet : this._closure(gotoSet);
  }

  private _insertStateWithItems(
    symbol: string,
    items: Item[],
    itemSet: State,
    states: State[],
    stateMap: Map<string, number>
  ): void {
    // Build kernel signature from provided items (already filtered)
    const kernel: [number, number][] = items.map(item => [item.rule.id, item.dot + 1]);
    if (!kernel.length) return;

    kernel.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const kernelSig = kernel.map(([pid, pos]) => `${pid}.${pos}`).join('|');

    const existing = stateMap.get(kernelSig);
    if (existing != null) {
      itemSet.transitions.set(symbol, existing);
      return;
    }

    // Kernel is new; compute closure now
    const gotoSet = this._goto(itemSet, symbol);
    if (!(gotoSet.items.size > 0)) return;

    gotoSet.signature = kernelSig;
    gotoSet.id = states.length;
    stateMap.set(kernelSig, gotoSet.id);
    itemSet.transitions.set(symbol, gotoSet.id);
    states.push(gotoSet);
  }

  // ============================================================================
  // Lookahead Computation - SLR(1) Algorithm
  // ============================================================================

  /**
   * Compute lookahead sets using SLR(1) algorithm (FIRST/FOLLOW sets)
   */
  processLookaheads(): void {
    // Computes once; no-op on subsequent calls
    this.processLookaheads = () => {};
    this._computeNullableSets();
    this._computeFirstSets();
    this._computeFollowSets();
    this._assignItemLookaheads();
  }

  private _computeNullableSets(): void {
    let changed = true;
    while (changed) {
      changed = false;

      // Mark rules nullable if all handle symbols are nullable
      for (const rule of this.rules) {
        if (!rule.nullable) {
          if (rule.symbols.every(symbol => this._isNullable(symbol))) {
            rule.nullable = true;
            changed = true;
          }
        }
      }

      // Propagate to types
      for (const symbol in this.types) {
        if (!Object.hasOwn(this.types, symbol)) continue;
        const type = this.types[symbol];
        if (!this._isNullable(symbol)) {
          if (type.rules.some(p => p.nullable)) {
            type.nullable = true;
            changed = true;
          }
        }
      }
    }
  }

  private _isNullable(symbol: string | string[]): boolean {
    if (symbol === '') return true;
    if (Array.isArray(symbol)) {
      return symbol.every(s => this._isNullable(s));
    }
    return this.types[symbol]?.nullable || false;
  }

  private _computeFirstSets(): void {
    let changed = true;
    while (changed) {
      changed = false;

      for (const rule of this.rules) {
        const firsts = this._computeFirst(rule.symbols);
        const oldSize = rule.firsts.size;
        rule.firsts.clear();
        firsts.forEach(item => rule.firsts.add(item));
        if (rule.firsts.size > oldSize) changed = true;
      }

      for (const symbol in this.types) {
        if (!Object.hasOwn(this.types, symbol)) continue;
        const type = this.types[symbol];
        const oldSize = type.firsts.size;
        type.firsts.clear();
        for (const rule of type.rules) {
          rule.firsts.forEach(s => type.firsts.add(s));
        }
        if (type.firsts.size > oldSize) changed = true;
      }
    }
  }

  private _computeFirst(symbols: string | string[]): Set<string> {
    if (symbols === '') return new Set();
    if (Array.isArray(symbols)) return this._computeFirstOfSequence(symbols);
    if (!this.types[symbols]) return new Set([symbols]);
    return this.types[symbols].firsts;
  }

  private _computeFirstOfSequence(symbols: string[]): Set<string> {
    const firsts = new Set<string>();
    for (const symbol of symbols) {
      if (this.types[symbol]) {
        this.types[symbol].firsts.forEach(s => firsts.add(s));
      } else {
        firsts.add(symbol);
      }
      if (!this._isNullable(symbol)) break;
    }
    return firsts;
  }

  private _computeFollowSets(): void {
    let changed = true;
    while (changed) {
      changed = false;

      for (const rule of this.rules) {
        for (let i = 0; i < rule.symbols.length; i++) {
          const symbol = rule.symbols[i];
          if (!this.types[symbol]) continue;

          const oldSize = this.types[symbol].follows.size;

          if (i === rule.symbols.length - 1) {
            // Symbol at end: add FOLLOW(LHS)
            this.types[rule.type].follows.forEach(item => {
              this.types[symbol].follows.add(item);
            });
          } else {
            // Add FIRST(β) where β follows symbol
            const beta = rule.symbols.slice(i + 1);
            const firstSet = this._computeFirst(beta);

            firstSet.forEach(item => this.types[symbol].follows.add(item));

            // If β is nullable, also add FOLLOW(LHS)
            if (this._isNullable(beta)) {
              this.types[rule.type].follows.forEach(item => {
                this.types[symbol].follows.add(item);
              });
            }
          }

          if (this.types[symbol].follows.size > oldSize) changed = true;
        }
      }
    }
  }

  private _assignItemLookaheads(): void {
    for (const state of this.states) {
      for (const item of state.reductions) {
        const follows = this.types[item.rule.type]?.follows;
        if (follows) {
          item.lookaheads.clear();
          for (const token of follows) {
            item.lookaheads.add(token);
          }
        }
      }
    }
  }

  // ============================================================================
  // Parse Table Generation
  // ============================================================================

  /**
   * Build the parse table with shift/reduce/accept actions
   * @param itemSets - LR states to process (defaults to this.states)
   */
  buildParseTable(itemSets: State[] = this.states): void {
    const states: any[] = [];
    const { types, operators } = this;
    const [NONASSOC, SHIFT, REDUCE, ACCEPT] = [0, 1, 2, 3];

    for (let k = 0; k < itemSets.length; k++) {
      const itemSet = itemSets[k];
      const state: any = (states[k] = {});

      // Shift and goto actions
      for (const [stackSymbol, gotoState] of itemSet.transitions) {
        if (this.symbolIds[stackSymbol] == null) continue;

        if (types[stackSymbol]) {
          state[this.symbolIds[stackSymbol]] = gotoState;
        } else {
          state[this.symbolIds[stackSymbol]] = [SHIFT, gotoState];
        }
      }

      // Accept action
      for (const item of itemSet.items) {
        if (item.nextSymbol === "$end" && this.symbolIds["$end"] != null) {
          state[this.symbolIds["$end"]] = [ACCEPT];
        }
      }

      // Reduce actions
      for (const item of itemSet.reductions) {
        for (const stackSymbol of item.lookaheads) {
          if (this.symbolIds[stackSymbol] == null) continue;

          let action = state[this.symbolIds[stackSymbol]];
          const op = operators[stackSymbol];

          if (action) {
            // Resolve conflict
            const which = Array.isArray(action[0]) ? action[0] : action;
            const solution = this._resolveConflict(
              item.rule,
              op,
              [REDUCE, item.rule.id],
              which
            );

            if (solution.bydefault) {
              this.conflicts++;
            } else {
              action = solution.action;
            }
          } else {
            action = [REDUCE, item.rule.id];
          }

          if (action?.length) {
            state[this.symbolIds[stackSymbol]] = action;
          } else if (action === NONASSOC) {
            state[this.symbolIds[stackSymbol]] = undefined;
          }
        }
      }
    }

    this._computeDefaultActions(this.parseTable = states);
  }

  private _resolveConflict(
    rule: Rule,
    op: OperatorInfo | undefined,
    reduce: number[],
    shift: number[]
  ): any {
    const solution: any = { rule, operator: op, r: reduce, s: shift };
    const [NONASSOC, SHIFT, REDUCE] = [0, 1, 2];

    if (shift[0] === REDUCE) {
      solution.action = shift[1] < reduce[1] ? shift : reduce;
      if (shift[1] !== reduce[1]) solution.bydefault = true;
      return solution;
    }

    if (rule.precedence === 0 || !op) {
      solution.bydefault = true;
      solution.action = shift;
    } else if (rule.precedence < op.precedence) {
      solution.action = shift;
    } else if (rule.precedence === op.precedence) {
      switch (op.assoc) {
        case "right":
          solution.action = shift;
          break;
        case "left":
          solution.action = reduce;
          break;
        case "nonassoc":
          solution.action = NONASSOC;
          break;
        default:
          solution.action = shift;
      }
    } else {
      solution.action = reduce;
    }

    return solution;
  }

  private _computeDefaultActions(states: any[]): void {
    const defaults: Record<number, any> = {};
    for (let k = 0; k < states.length; k++) {
      const state = states[k];
      let actionCount = 0;
      let lastAction: any = null;

      for (const action in state) {
        if (!Object.hasOwn(state, action)) continue;
        actionCount++;
        lastAction = state[action];
      }

      if (actionCount === 1 && lastAction[0] === 2) {
        defaults[k] = lastAction;
      }
    }

    this.defaultActions = defaults;
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  /**
   * Generate the complete parser code as a string
   * @returns JavaScript code for the generated parser
   */
  generate(): string {
    const module = this._generateModuleCore();
    const pureHint = "/*#__PURE__*/";
    return `// ES6 Parser generated by Solar ${VERSION}
const hasProp = {}.hasOwnProperty
${module.commonCode}
const parserInstance = ${module.moduleCode}

function createParser(yyInit = {}) {
  const p = Object.create(parserInstance);
  Object.defineProperty(p, "yy", {
    value: { ...yyInit },
    enumerable: false,
    writable: true,
    configurable: true,
  })
  return p
}

const parser = ${pureHint}createParser()

export { parser }
export const Parser = createParser
export const parse = parser.parse.bind(parser)
export default parser
`;
  }

  private _generateModuleCore(): { commonCode: string; moduleCode: string } {
    const tableCode = this._generateTableCode(this.parseTable);

    const moduleCode = `{
  symbolIds: ${JSON.stringify(this.symbolIds)},
  tokenNames: ${JSON.stringify(this.tokenNames).replace(/"([0-9]+)":/g, "$1:")},
  ruleData: ${JSON.stringify(this.ruleData)},
  parseTable: ${tableCode.moduleCode},
  defaultActions: ${JSON.stringify(this.defaultActions).replace(/"([0-9]+)":/g, "$1:")},
  performAction: ${this.performAction},
  ${String(this.parseError).replace(/^function /, '')},
  ${String(this.parse).replace(/^function /, '')},
  trace() {},
  yy: {},
}`;

    return { commonCode: tableCode.commonCode, moduleCode };
  }

  private _generateTableCode(stateTable: any[]): { commonCode: string; moduleCode: string } {
    const moduleCode = JSON.stringify(stateTable, null, 0).replace(/"([0-9]+)"(?=:)/g, "$1");
    return { commonCode: '', moduleCode };
  }

  // ============================================================================
  // Runtime Parser
  // ============================================================================

  /**
   * Handle parse errors with detailed error information
   * @param str - Error message string
   * @param hash - Error context with location and token information
   */
  parseError(str: string, hash: ParseError): void {
    if (hash.recoverable) {
      this.trace(str);
    } else {
      // Format error with line/column information
      const line = (hash.line || 0) + 1;  // Convert 0-based to 1-based
      const col = (hash.loc?.first_column) || 0;
      const token = hash.token ? ` (token: ${hash.token})` : '';
      const text = hash.text ? ` near '${hash.text}'` : '';
      const location = `line ${line}, column ${col}`;
      const message = `Parse error at ${location}${token}${text}: ${str}`;

      const error: any = new Error(message);
      error.hash = hash;
      throw error;
    }
  }

  /**
   * Parse input string using the generated parser
   * @param input - String to parse
   * @returns Parsed result (type depends on grammar actions)
   */
  parse(input: string): any {
    const stk = [0];
    const val: any[] = [null];
    const loc: any[] = [];
    const { parseTable } = this;
    let yytext = '';
    let yylineno = 0;
    let yyleng = 0;
    let recovering = 0;
    const [TERROR, EOF] = [2, 1];

    const lexer = Object.create(this.lexer);
    const sharedState: any = { yy: {} };
    for (const k in this.yy) {
      if (Object.hasOwn(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;

    if (!lexer.yylloc) lexer.yylloc = {};
    let yyloc = lexer.yylloc;
    loc.push(yyloc);

    const ranges = lexer.options?.ranges;

    this.parseError = typeof sharedState.yy.parseError === 'function'
      ? sharedState.yy.parseError
      : Object.getPrototypeOf(this).parseError;

    const lex = (): number => {
      let token: any = lexer.lex() || EOF;
      if (typeof token !== 'number') {
        token = this.symbolIds[token] || token;
      }
      return token;
    };

    let symbol: number | null = null;
    let preErrorSymbol: number | null = null;
    let state: number;
    let action: any;
    let r: any;
    const yyval: any = {};
    let p: number;
    let len: number;
    let newState: number;
    let expected: string[] | null = null;

    while (true) {
      state = stk.at(-1)!;
      action = this.defaultActions[state] || (
        symbol == null && (symbol = lex()),
        parseTable[state]?.[symbol]
      );

      if (!(action?.length && action[0])) {
        let errStr = '';
        if (!recovering) {
          expected = [];
          for (const p in parseTable[state]) {
            const pNum = Number(p);
            if (Object.hasOwn(parseTable[state], p) && this.tokenNames[pNum] && pNum > TERROR) {
              expected.push(`'${this.tokenNames[pNum]}'`);
            }
          }
        }
        errStr = lexer.showPosition
          ? `Parse error on line ${yylineno + 1}:\n${lexer.showPosition()}\nExpecting ${expected?.join(', ')}, got '${this.tokenNames[symbol!] || symbol}'`
          : `Parse error on line ${yylineno + 1}: Unexpected ${symbol === EOF ? "end of input" : `'${this.tokenNames[symbol!] || symbol}'`}`;

        this.parseError(errStr, {
          text: lexer.match,
          token: this.tokenNames[symbol!] || symbol || undefined,
          line: lexer.yylineno,
          loc: yyloc,
          expected: expected || undefined
        });
        throw new Error(errStr);
      }

      if (Array.isArray(action[0]) && action.length > 1) {
        throw new Error(`Parse Error: multiple actions possible at state: ${state}, token: ${symbol}`);
      }

      switch (action[0]) {
        case 1: // shift
          stk.push(symbol!, action[1]);
          val.push(lexer.yytext);
          loc.push(lexer.yylloc);
          symbol = null;
          if (!preErrorSymbol) {
            yyleng = lexer.yyleng;
            yytext = lexer.yytext;
            yylineno = lexer.yylineno;
            yyloc = lexer.yylloc;
            if (recovering > 0) recovering--;
          } else {
            symbol = preErrorSymbol;
            preErrorSymbol = null;
          }
          break;

        case 2: // reduce
          len = this.ruleData[action[1]][1];
          yyval.$ = val[val.length - len];
          const locFirst = loc[loc.length - (len || 1)];
          const locLast = loc.at(-1)!;
          yyval._$ = {
            first_line: locFirst.first_line,
            last_line: locLast.last_line,
            first_column: locFirst.first_column,
            last_column: locLast.last_column
          };
          if (ranges) {
            yyval._$.range = [locFirst.range[0], locLast.range[1]];
          }

          const performActionFn = eval(`(${this.performAction})`);
          r = performActionFn.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], val, loc]);
          if (r != null) yyval.$ = r;

          if (len) {
            stk.length -= len * 2;
            val.length -= len;
            loc.length -= len;
          }

          stk.push(this.ruleData[action[1]][0]);
          val.push(yyval.$);
          loc.push(yyval._$);
          newState = parseTable[stk.at(-2)!][stk.at(-1)!];
          stk.push(newState);
          break;

        case 3: // accept
          return val.at(-1);
      }
    }
  }

  trace(msg: string): void {
    if (this.options?.debug) {
      console.log(msg);
    }
  }

  /**
   * Create a runtime parser instance
   * @returns Parser instance ready to parse input
   */
  createParser(): any {
    const module = this._generateModuleCore();
    const moduleExpr = `(function(){
  const hasProp = {}.hasOwnProperty
  ${module.commonCode}
  const parserInstance = ${module.moduleCode}
  ${this.moduleInclude || ''}
  class Parser { yy = {} }
  Parser.prototype = parserInstance
  parserInstance.Parser = Parser
  return new Parser()
})()`;
    const parser = eval(moduleExpr);
    parser.rules = this.rules;
    parser.lexer = this.lexer;
    return parser;
  }
}

// ==============================================================================
// Exports
// ==============================================================================

export { Generator, Token, Type, Rule, Item, State };

export function Parser(grammar: Grammar, options?: GeneratorOptions): any {
  const generator = new Generator(grammar, options);
  return generator.createParser();
}

export default {
  Generator: (g: Grammar, options?: GeneratorOptions) => {
    return new Generator(g, { ...g.options, ...options });
  },

  Parser: (grammar: Grammar, options?: GeneratorOptions) => {
    const generator = new Generator(grammar, options);
    return generator.createParser();
  }
};

// ==============================================================================
// CLI Interface
// ==============================================================================

// Check if running as CLI (handles symlinks from global install)
const scriptPath = fileURLToPath(import.meta.url);
const isRunAsScript = process.argv[1] === scriptPath ||
                      fs.realpathSync(process.argv[1]) === scriptPath ||
                      fs.realpathSync(process.argv[1]) === fs.realpathSync(scriptPath);

if (isRunAsScript) {
  (async () => {
    const showVersion = () => {
      console.log(`
Solar ${VERSION} - SLR(1) Parser Generator
`);
    };

    const showHelp = () => {
      showVersion();
      console.log(`Usage: solar [options] <grammar-file>

Options:
  -h, --help              Show this help
  -v, --version           Show version
  -i, --info              Show grammar information
  -s, --sexpr             Show grammar as s-expression
  -o, --output <file>     Output file (default: parser.js)

Examples:
  solar grammar.js
  solar --info grammar.js
  solar --sexpr grammar.js
  solar -o parser.js grammar.js
`);
    };

    const showStats = (generator: Generator) => {
      const tokens = Object.keys(generator.tokenNames || {}).length;
      const types = Object.keys(generator.types || {}).length;
      const rules = generator.rules?.length || 0;
      const states = generator.states?.length || 0;
      const conflicts = generator.conflicts || 0;

      console.log(`
⏱️ Statistics:
• Tokens: ${tokens}
• Types: ${types}
• Rules: ${rules}
• States: ${states}
• Conflicts: ${conflicts}
`);
    };

    // Parse command line
    const options: any = {
      help: false,
      version: false,
      info: false,
      sexpr: false,
      output: 'parser.js'
    };
    let grammarFile: string | null = null;

    let i = 0;
    while (i < process.argv.length - 2) {
      const arg = process.argv[i + 2];
      switch (arg) {
        case '-h':
        case '--help':
          options.help = true;
          break;
        case '-v':
        case '--version':
          options.version = true;
          break;
        case '-i':
        case '--info':
          options.info = true;
          break;
        case '-s':
        case '--sexpr':
          options.sexpr = true;
          break;
        case '-o':
        case '--output':
          options.output = process.argv[++i + 2];
          break;
        default:
          if (!arg.startsWith('-')) grammarFile = arg;
      }
      i++;
    }

    if (options.help) {
      showHelp();
      process.exit(0);
    }

    if (options.version) {
      showVersion();
      process.exit(0);
    }

    if (!grammarFile) {
      showHelp();
      process.exit(1);
    }

    try {
      if (!fs.existsSync(grammarFile)) {
        console.error(`Grammar file not found: ${grammarFile}`);
        process.exit(1);
      }

      // Load grammar
      let grammar: Grammar;
      if (grammarFile.endsWith('.js') || grammarFile.endsWith('.ts') || grammarFile.endsWith('.rip')) {
        const module = await import(pathToFileURL(path.resolve(grammarFile)).href);
        grammar = module.default;
      } else if (grammarFile.endsWith('.json')) {
        grammar = JSON.parse(fs.readFileSync(grammarFile, 'utf8'));
      } else {
        throw new Error("Unsupported format. Use .js, .ts, .json, or .rip (with Bun loader)");
      }
      if (!grammar) {
        throw new Error("Failed to load grammar");
      }

      // Show grammar as s-expression
      if (options.sexpr) {
        // Build s-expression structure
        const parts: string[] = ['(grammar'];

        if (grammar.mode) {
          parts.push(`  (mode ${grammar.mode})`);
        }

        if (grammar.grammar) {
          parts.push('  (rules');
          for (const [name, productions] of Object.entries(grammar.grammar)) {
            parts.push(`    (${name}`);
            for (const prod of productions as any[]) {
              // Format production as s-expression: (pattern action options?)
              const pattern = prod[0] || '';
              const action = prod[1] !== undefined ? prod[1] : 1;
              const options = prod[2];

              let prodStr = `(${pattern}`;
              if (action !== undefined) {
                prodStr += ` ${typeof action === 'string' ? action : JSON.stringify(action)}`;
              }
              if (options) {
                prodStr += ` ${JSON.stringify(options)}`;
              }
              prodStr += ')';

              parts.push(`      ${prodStr}`);
            }
            parts.push(`    )`);
          }
          parts.push('  )');
        }

        if (grammar.operators && grammar.operators.length > 0) {
          parts.push('  (operators');
          for (const op of grammar.operators) {
            const opStr = Array.isArray(op) ? `(${op.join(' ')})` : String(op);
            parts.push(`    ${opStr}`);
          }
          parts.push('  )');
        }

        parts.push(')');
        console.log(parts.join('\n'));
        return;
      }

      // Generate parser
      const generator = new Generator(grammar, options);

      if (options.info) {
        showStats(generator);
      }

      if (!options.info) {
        const parserCode = generator.generate();
        fs.writeFileSync(options.output, parserCode);
        console.log(`\nParser generated: ${options.output}`);
      }
    } catch (error: any) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  })();
}
