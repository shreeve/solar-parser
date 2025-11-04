// == JavaScript output by Rip 1.2.2 == //

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
let VERSION;

VERSION = '1.0.0';
class Token {
  constructor(name, id) {
    this.id = id;
    this.name = name;
  }
};
class Type {
  constructor(name, id) {
    this.id = id;
    this.name = name;
    this.rules = [];
    this.nullable = false;
    this.firsts = new Set();
    this.follows = new Set();
  }
};
class Rule {
  constructor(type, symbols, id) {
    this.id = id;
    this.type = type;
    this.symbols = symbols;
    this.nullable = false;
    this.firsts = new Set();
    this.precedence = 0;
  }
};
class Item {
  constructor(rule, lookaheads, dot = 0) {
    this.rule = rule;
    this.dot = dot;
    this.id = `${this.rule.id}:${this.dot}`;
    this.lookaheads = new Set((lookaheads || []));
    this.nextSymbol = this.rule.symbols[this.dot];
  }
};
class State {
  constructor(...items) {
    this.id = null;
    this.items = new Set(items);
    this.transitions = new Map();
    this.reductions = new Set();
    this.hasShifts = false;
    this.hasConflicts = false;
  }
};
class Generator {
  constructor(grammar, options = {}) {
    this.options = {...grammar.options, ...options};
    this.parseParams = grammar.parseParams;
    this.yy = {};
    this.indent = '  ';
    if ((grammar.mode === 'sexp')) {
      this.mode = 'sexp';
    } else if ((grammar.bnf != null)) {
      this.mode = 'jison';
    } else {
      throw new Error("Unknown grammar format: expected mode='sexp' or grammar.bnf property");
    };
    this.types = {};
    this.rules = [];
    this.operators = {};
    this.conflicts = 0;
    this.symbolTable = new Map();
    this.symbolTable.set("$accept", new Type("$accept", 0));
    this.symbolTable.set("$end", new Token("$end", 1));
    this.symbolTable.set("error", new Token("error", 2));
    this.timing('💥 Total time', () => {
      this.timing('processGrammar', () => this.processGrammar(grammar));
      this.timing('buildLRAutomaton', () => this.buildLRAutomaton());
      this.timing('processLookaheads', () => this.processLookaheads());
      return this.timing('buildParseTable', () => this.buildParseTable());
    });
  }
  dedent(s, indent) {
    let i, m;
    m = s.match(/^[ \t]+(?=\S)/gm);
    i = Math.min(...(m ?? []).map((x) => x.length));
    s = s.replace(RegExp(`^[ \t]{${i}}`, 'gm'), '').trim();
    if (indent) s = s.replace(/^/gm, indent);
    return s;
  }
  timing(label, fn) {
    let result;
    console.time(label);
    if (fn) result = fn();
    console.timeEnd(label);
    return result;
  }
  processGrammar(grammar) {
    if (grammar.operators) this._processOperators(grammar.operators);
    this._buildRules((grammar.grammar || grammar.bnf));
    return this._augmentGrammar(grammar);
  }
  _processOperators(ops) {
    for (let i = 0; i < ops.length; i++) {
    const precedence = ops[i];
    for (let k = 1; k < precedence.length; k++) {
        this.operators[precedence[k]] = {precedence: (i + 1), assoc: precedence[0]};
      };
    };
  }
  _buildRules(grammar) {
    let action, actionGroups, actionsCode, addSymbol, handles, label, parameters, precedence, rule, ruleTable, symbolId, symbols;
    actionGroups = {};
    ruleTable = [0];
    this.symbolIds = {"$accept": 0, "$end": 1, "error": 2};
    symbolId = 3;
    addSymbol = (name) => {
      let id, symbol;
      if ((!name || this.symbolIds[name])) return;
      if (!(symbol = this.symbolTable.get(name))) {
        id = (symbolId++);
        symbol = (grammar[name] ? new Type(name, id) : new Token(name, id));
        this.symbolTable.set(name, symbol);
      };
      return (this.symbolIds[name] = symbol.id);
    };
    for (const type in grammar) {
      if (grammar.hasOwnProperty(type)) {
        const rules = grammar[type];
        addSymbol(type);
        this.types[type] = this.symbolTable.get(type);
        handles = ((typeof rules === 'string') ? rules.split(/\s*\|\s*/g) : rules.slice());
        for (const handle of handles) {
          [symbols, action, precedence] = this._parseHandle(handle);
          for (const symbol of symbols) {
            addSymbol(symbol);
          }
          if (action) {
            action = this._processGrammarAction(action, symbols);
            label = (('case ' + (this.rules.length + 1)) + ':');
            (actionGroups[action]?.push(label) || (actionGroups[action] = [label]));
          };
          rule = new Rule(type, symbols, (this.rules.length + 1));
          this._assignPrecedence(rule, precedence);
          this.rules.push(rule);
          ruleTable.push([this.symbolIds[type], ((symbols[0] === '') ? 0 : symbols.length)]);
          this.types[type].rules.push(rule);
        };
      }
    };
    actionsCode = this._generateActionCode(actionGroups);
    this.ruleData = ruleTable;
    this._buildTokenMappings();
    parameters = "yytext, yyleng, yylineno, yy, yystate, $$, _$";
    if (this.parseParams?.length) parameters += (', ' + this.parseParams.join(', '));
    return (this.performAction = `function anonymous(${parameters}) {\n${actionsCode}\n}`);
  }
  _parseHandle(handle) {
    let action, precedence, symbols;
    if (Array.isArray(handle)) {
      symbols = ((typeof handle[0] === 'string') ? handle[0].trim().split(' ') : handle[0].slice());
      symbols = symbols.map((function(e) {
        return e.replace(/\[[a-zA-Z_][a-zA-Z0-9_-]*\]/g, '');
      }));
      action = (((typeof handle[1] === 'string') || (handle.length === 3)) ? handle[1] : null);
      precedence = (handle[2] ? handle[2] : ((handle[1] && (typeof handle[1] !== 'string')) ? handle[1] : null));
      return [symbols, action, precedence];
    } else {
      handle = handle.replace(/\[[a-zA-Z_][a-zA-Z0-9_-]*\]/g, '');
      symbols = handle.trim().split(' ');
      return [symbols, null, null];
    }  }
  _processGrammarAction(action, symbols) {
    let getToken, regex, result;
    switch (this.mode) {
      case 'sexp':
        getToken = (function(_, n) {
          return `$$[$0${((parseInt(n, 10) - symbols.length) || '')}]`;
        });
        switch (typeof action) {
          case 'string':
            regex = /(?<!\$)\$(-?\d+)/gm;
            if (!regex.test(action)) regex = /(-?\d+)/g;
            result = action.replace(regex, getToken).trim();
            break;
          case 'number':
          case 'undefined':
            result = getToken('', (action || 1));
            break;
          default:
            result = 'null';
            break;
        };
        return `return ${result};`;
      case 'jison':
        switch (typeof action) {
          case 'string':
            return this._generateClassAction(action, symbols);
          case 'undefined':
            return ((symbols.length === 0) ? 'return null;' : 'return $$[1];');
        };
        break;
    };
    throw new Error(`Invalid action type for mode ${this.mode}: ${typeof action}`);
  }
  _generateClassAction(action, symbols) {
    let count, names, symbols_i;
    if (action.match(/[$@][a-zA-Z][a-zA-Z0-9_]*/)) {
      count = {};
      names = {};
      for (let i = 0; i < symbols.length; i++) {
      const token = symbols[i];
      symbols_i = token.match(/\[[a-zA-Z][a-zA-Z0-9_-]*\]/);
      if (symbols_i) {
          symbols_i = symbols_i[0].slice(1, (-1));
        } else {
          symbols_i = token;
        };
      if (names[symbols_i]) {
          names[(symbols_i + (++count[symbols_i]))] = (i + 1);
        } else {
          names[symbols_i] = (i + 1);
          names[(symbols_i + "1")] = (i + 1);
          count[symbols_i] = 1;
        };
      };
      action = action.replace(/\$([a-zA-Z][a-zA-Z0-9_]*)/g, (function(str, pl) {
        return (names[pl] ? ('$' + names[pl]) : str);
      })).replace(/@([a-zA-Z][a-zA-Z0-9_]*)/g, (function(str, pl) {
        return (names[pl] ? ('@' + names[pl]) : str);
      }));
    };
    return action.replace(/([^'"])\$\$|^\$\$/g, '$1this.$').replace(/@[0$]/g, "this._$").replace(/\$(-?\d+)/g, (function(_, n) {
      return (("$$[$0" + ((parseInt(n, 10) - symbols.length) || '')) + "]");
    })).replace(/@(-?\d+)/g, (function(_, n) {
      return (("_$[$0" + ((n - symbols.length) || '')) + "]");
    }));
  }
  _assignPrecedence(rule, precedence) {
    return ((precedence?.prec && this.operators[precedence.prec]) ? (rule.precedence = this.operators[precedence.prec].precedence) : ((rule.precedence === 0) ? (() => {
      const result = [];
      for (let _i = rule.symbols.length - 1; _i >= 0; _i += (-1)) {
        const token = rule.symbols[_i];
        if ((this.operators[token] && !this.types[token])) {
          rule.precedence = this.operators[token].precedence;
          break;
        };
      }
      return result;
    })() : undefined));
  }
  _generateActionCode(actionGroups) {
    let actions;
    actions = [];
    actions.push('const $0 = $$.length - 1;');
    actions.push('switch (yystate) {');
    for (const action in actionGroups) {
    const labels = actionGroups[action];
    if ((Array.isArray(action) || typeof action === 'string' ? action.includes('\n') : ('\n' in action))) {
        actions.push((this.indent + labels.join(' ')));
        actions.push(this.dedent(action, this.indent));
      } else {
        actions.push((this.indent + labels.concat(action).join(' ')));
      };
    if (!action.trimStart().startsWith('return')) actions.push((this.indent + 'break;'));
    };
    actions.push('}');
    return actions.join('\n').replace(/YYABORT/g, 'return false').replace(/YYACCEPT/g, 'return true');
  }
  _buildTokenMappings() {
    this.tokenNames = {};
    for (const name in this.symbolIds) {
      if (this.symbolIds.hasOwnProperty(name)) {
        const id = this.symbolIds[name];
        if ((id >= 2)) {
          if (!this.types[name]) {
            this.tokenNames[id] = name;
          };
        }
      }
    };
  }
  _augmentGrammar(grammar) {
    let acceptRule;
    if ((this.rules.length === 0)) throw new Error("Grammar error: no rules defined.");
    this.start = (grammar.start || this.rules[0].type);
    if (!this.types[this.start]) {
      throw new Error(`Grammar error: no start symbol '${this.start}' defined.`);
    };
    acceptRule = new Rule("$accept", [this.start, "$end"], 0);
    this.rules.push(acceptRule);
    this.acceptRuleIndex = (this.rules.length - 1);
    this.types.$accept = this.symbolTable.get("$accept");
    this.types.$accept.rules.push(acceptRule);
    return this.types[this.start].follows.add("$end");
  }
  buildLRAutomaton() {
    let acceptItem, firstState, itemSet, items, marked, stateMap, states, symbolItems;
    acceptItem = new Item(this.rules[this.acceptRuleIndex]);
    firstState = this._closure(new State(acceptItem));
    firstState.id = 0;
    firstState.signature = `${acceptItem.rule.id}.${acceptItem.dot}`;
    states = [firstState];
    stateMap = new Map();
    stateMap.set(firstState.signature, 0);
    marked = 0;
    while ((marked < states.length)) {
      itemSet = states[(marked++)];
      symbolItems = new Map();
      for (const item of itemSet.items) {
        if ((item.nextSymbol && (item.nextSymbol !== '$end'))) {
          items = symbolItems.get(item.nextSymbol);
          if (!items) {
            items = [];
            symbolItems.set(item.nextSymbol, items);
          };
          items.push(item);
        }
      };
      for (const [symbol, items] of symbolItems) {
        this._insertStateWithItems(symbol, items, itemSet, states, stateMap);
      };
    };
    return (this.states = states);
  }
  _closure(itemSet) {
    let closureSet, itemCores, newItem, newItems, nextSymbol, type, workingSet;
    closureSet = new State();
    workingSet = new Set(itemSet.items);
    itemCores = new Map();
    while ((workingSet.size > 0)) {
      newItems = new Set();
      for (const item of workingSet) {
        if ((!itemCores.has(item.id))) {
          closureSet.items.add(item);
          itemCores.set(item.id, item);
          ({nextSymbol} = item);
          if (!nextSymbol) {
            closureSet.reductions.add(item);
            closureSet.hasConflicts = ((closureSet.reductions.size > 1) || closureSet.hasShifts);
          } else if (!this.types[nextSymbol]) {
            closureSet.hasShifts = true;
            closureSet.hasConflicts = (closureSet.reductions.size > 0);
          } else {
            type = this.types[nextSymbol];
            for (const rule of type.rules) {
              newItem = new Item(rule);
              if (!itemCores.has(newItem.id)) newItems.add(newItem);
            };
          };
        }
      };
      workingSet = newItems;
    };
    return closureSet;
  }
  _goto(itemSet, symbol) {
    let gotoSet, newItem;
    gotoSet = new State();
    for (const item of itemSet.items) {
      if (item.nextSymbol === symbol) {
        newItem = new Item(item.rule, null, (item.dot + 1));
        gotoSet.items.add(newItem);
      }
    };
    return ((gotoSet.items.size === 0) ? gotoSet : this._closure(gotoSet));
  }
  _insertStateWithItems(symbol, items, itemSet, states, stateMap) {
    let existing, gotoSet, kernel, kernelSig;
    kernel = (() => {
      const result = [];
      for (const item of items) {
        result.push([item.rule.id, (item.dot + 1)]);
      }
      return result;
    })();
    if (!kernel.length) return;
    kernel.sort((function(a, b) {
      return ((a[0] - b[0]) || (a[1] - b[1]));
    }));
    kernelSig = (() => {
      const result = [];
      for (const [pid, pos] of kernel) {
        result.push(((pid + '.') + pos));
      }
      return result;
    })().join('|');
    existing = stateMap.get(kernelSig);
    if ((existing != null)) {
      itemSet.transitions.set(symbol, existing);
      return;
    };
    gotoSet = this._goto(itemSet, symbol);
    if (!(gotoSet.items.size > 0)) return;
    gotoSet.signature = kernelSig;
    gotoSet.id = states.length;
    stateMap.set(kernelSig, gotoSet.id);
    itemSet.transitions.set(symbol, gotoSet.id);
    return states.push(gotoSet);
  }
  processLookaheads() {
    this.processLookaheads = (function() {
    });
    this._computeNullableSets();
    this._computeFirstSets();
    this._computeFollowSets();
    return this._assignItemLookaheads();
  }
  _computeNullableSets() {
    let changed;
    changed = true;
    while (changed) {
      changed = false;
      for (const rule of this.rules) {
        if (!rule.nullable) {
          if (rule.symbols.every((symbol) => this._isNullable(symbol))) {
            rule.nullable = (changed = true);
          };
        }
      };
      for (const symbol in this.types) {
        const type = this.types[symbol];
        if ((!this._isNullable(symbol))) {
          if (type.rules.some((function(p) { return p.nullable; }))) {
            type.nullable = (changed = true);
          };
        }
      };
    };
  }
  _isNullable(symbol) {
    if ((symbol === '')) return true;
    if (Array.isArray(symbol)) return symbol.every((s) => this._isNullable(s));
    return (this.types[symbol]?.nullable || false);
  }
  _computeFirstSets() {
    let changed, firsts, oldSize;
    changed = true;
    while (changed) {
      changed = false;
      for (const rule of this.rules) {
        firsts = this._computeFirst(rule.symbols);
        oldSize = rule.firsts.size;
        rule.firsts.clear();
        firsts.forEach((item) => rule.firsts.add(item));
        if ((rule.firsts.size > oldSize)) changed = true;
      };
      for (const symbol in this.types) {
      const type = this.types[symbol];
      oldSize = type.firsts.size;
      type.firsts.clear();
      for (const rule of type.rules) {
          rule.firsts.forEach((s) => type.firsts.add(s));
        };
      if ((type.firsts.size > oldSize)) changed = true;
      };
    };
  }
  _computeFirst(symbols) {
    if ((symbols === '')) return new Set();
    if (Array.isArray(symbols)) return this._computeFirstOfSequence(symbols);
    if (!this.types[symbols]) return new Set([symbols]);
    return this.types[symbols].firsts;
  }
  _computeFirstOfSequence(symbols) {
    let firsts;
    firsts = new Set();
    for (const symbol of symbols) {
      if (this.types[symbol]) {
        this.types[symbol].firsts.forEach((s) => firsts.add(s));
      } else {
        firsts.add(symbol);
      };
      if (!this._isNullable(symbol)) break;
    };
    return firsts;
  }
  _computeFollowSets() {
    let beta, changed, firstSet, oldSize;
    changed = true;
    while (changed) {
      changed = false;
      for (const rule of this.rules) {
        for (let i = 0; i < rule.symbols.length; i++) {
        const symbol = rule.symbols[i];
        if (this.types[symbol]) {
                    oldSize = this.types[symbol].follows.size;
                    if ((i === (rule.symbols.length - 1))) {
              this.types[rule.type].follows.forEach((item) => this.types[symbol].follows.add(item));
            } else {
              beta = rule.symbols.slice((i + 1));
              firstSet = this._computeFirst(beta);
              firstSet.forEach((item) => this.types[symbol].follows.add(item));
              if (this._isNullable(beta)) {
                this.types[rule.type].follows.forEach((item) => this.types[symbol].follows.add(item));
              };
            };
                    if ((this.types[symbol].follows.size > oldSize)) changed = true;
                  }
        };
      };
    };
  }
  _assignItemLookaheads() {
    let follows;
    for (const state of this.states) {
      for (const item of state.reductions) {
        follows = this.types[item.rule.type]?.follows;
        if (follows) {
          item.lookaheads.clear();
          for (const token of follows) {
            item.lookaheads.add(token);
          };
        };
      };
    };
  }
  buildParseTable(itemSets = this.states) {
    let ACCEPT, NONASSOC, REDUCE, SHIFT, action, op, operators, solution, state, states, types, which;
    states = [];
    ({types, operators} = this);
    [NONASSOC, SHIFT, REDUCE, ACCEPT] = [0, 1, 2, 3];
    for (let k = 0; k < itemSets.length; k++) {
    const itemSet = itemSets[k];
    state = (states[k] = {});
    for (const [stackSymbol, gotoState] of itemSet.transitions) {
        if (this.symbolIds[stackSymbol] != null) {
          if (types[stackSymbol]) {
            state[this.symbolIds[stackSymbol]] = gotoState;
          } else {
            state[this.symbolIds[stackSymbol]] = [SHIFT, gotoState];
          };
        }
      };
    for (const item of itemSet.items) {
        if (((item.nextSymbol === "$end") && (this.symbolIds["$end"] != null))) {
          state[this.symbolIds["$end"]] = [ACCEPT];
        }
      };
    for (const item of itemSet.reductions) {
        for (const stackSymbol of item.lookaheads) {
          if (this.symbolIds[stackSymbol] != null) {
            action = state[this.symbolIds[stackSymbol]];
            op = operators[stackSymbol];
            if (action) {
              which = ((action[0] instanceof Array) ? action[0] : action);
              solution = this._resolveConflict(item.rule, op, [REDUCE, item.rule.id], which);
              if (solution.bydefault) {
                (this.conflicts++);
              } else {
                action = solution.action;
              };
            } else {
              action = [REDUCE, item.rule.id];
            };
            if (action?.length) {
              state[this.symbolIds[stackSymbol]] = action;
            } else if ((action === NONASSOC)) {
              state[this.symbolIds[stackSymbol]] = undefined;
            };
          }
        };
      };
    };
    return this._computeDefaultActions((this.parseTable = states));
  }
  _resolveConflict(rule, op, reduce, shift) {
    let NONASSOC, REDUCE, SHIFT, solution;
    solution = {rule, operator: op, r: reduce, s: shift};
    [NONASSOC, SHIFT, REDUCE] = [0, 1, 2];
    if ((shift[0] === REDUCE)) {
      solution.action = ((shift[1] < reduce[1]) ? shift : reduce);
      if ((shift[1] !== reduce[1])) solution.bydefault = true;
      return solution;
    };
    if (((rule.precedence === 0) || !op)) {
      solution.bydefault = true;
      solution.action = shift;
    } else if ((rule.precedence < op.precedence)) {
      solution.action = shift;
    } else if ((rule.precedence === op.precedence)) {
      solution.action = (() => { switch (op.assoc) {
        case 'right':
          return shift;
        case 'left':
          return reduce;
        case 'nonassoc':
          return NONASSOC;
        default:
          return shift;
      } })();
    } else {
      solution.action = reduce;
    };
    return solution;
  }
  _computeDefaultActions(states) {
    let actionCount, defaults, lastAction;
    defaults = {};
    for (let k = 0; k < states.length; k++) {
    const state = states[k];
    actionCount = 0;
    lastAction = null;
    for (const action in state) {
        if (state.hasOwnProperty(action)) {
          (actionCount++);
          lastAction = state[action];
        }
      };
    if (((actionCount === 1) && (lastAction[0] === 2))) defaults[k] = lastAction;
    };
    return (this.defaultActions = defaults);
  }
  generate() {
    let module, pureHint;
    module = this._generateModuleCore();
    pureHint = "/*#__PURE__*/";
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
export default parser`;
  }
  _generateModuleCore() {
    let moduleCode, tableCode;
    tableCode = this._generateTableCode(this.parseTable);
    moduleCode = `{
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
    return {commonCode: tableCode.commonCode, moduleCode};
  }
  _generateTableCode(stateTable) {
    let moduleCode;
    moduleCode = JSON.stringify(stateTable, null, 0).replace(/"([0-9]+)"(?=:)/g, "$1");
    return {commonCode: '', moduleCode};
  }
  parseError(str, hash) {
    let col, error, line, location, message, text, token;
    if (hash.recoverable) {
      return this.trace(str);
    } else {
      line = ((hash.line || 0) + 1);
      col = (hash.loc?.first_column || 0);
      token = (hash.token ? ` (token: ${hash.token})` : '');
      text = (hash.text ? ` near '${hash.text}'` : '');
      location = `line ${line}, column ${col}`;
      message = `Parse error at ${location}${token}${text}: ${str}`;
      error = new Error(message);
      error.hash = hash;
      throw error;
    }  }
  parse(input) {
    let EOF, TERROR, action, errStr, expected, len, lex, lexer, loc, locFirst, locLast, newState, p, parseTable, preErrorSymbol, r, ranges, recovering, sharedState, state, stk, symbol, val, yyleng, yylineno, yyloc, yytext, yyval;
    [stk, val, loc] = [[0], [null], []];
    [parseTable, yytext, yylineno, yyleng, recovering] = [this.parseTable, '', 0, 0, 0];
    [TERROR, EOF] = [2, 1];
    lexer = Object.create(this.lexer);
    sharedState = {yy: {}};
    for (const k in this.yy) {
      if (this.yy.hasOwnProperty(k)) {
        const v = this.yy[k];
        sharedState.yy[k] = v;
      }
    }
    lexer.setInput(input, sharedState.yy);
    [sharedState.yy.lexer, sharedState.yy.parser] = [lexer, this];
    if (!(lexer.yylloc != null)) lexer.yylloc = {};
    yyloc = lexer.yylloc;
    loc.push(yyloc);
    ranges = lexer.options?.ranges;
    this.parseError = ((typeof sharedState.yy.parseError === 'function') ? sharedState.yy.parseError : Object.getPrototypeOf(this).parseError);
    lex = () => {
      let token;
      token = (lexer.lex() || EOF);
      if (!(typeof token === 'number')) token = (this.symbolIds[token] || token);
      return token;
    };
    [symbol, preErrorSymbol, state, action, r, yyval, p, len, newState, expected] = [null, null, null, null, null, {}, null, null, null, null];
    while (true) {
      state = stk[(stk.length - 1)];
      action = (this.defaultActions[state] || (((!(symbol != null)) ? (symbol = lex()) : undefined), (parseTable[state] != null ? parseTable[state][symbol] : undefined)));
      if (!(action?.length && action[0])) {
        errStr = '';
        if (!recovering) {
          expected = (() => {
            const result = [];
            for (const p in parseTable[state]) {
              if (!parseTable[state].hasOwnProperty(p)) continue;
              if ((this.tokenNames[p] && (p > TERROR))) {
                result.push(`'${this.tokenNames[p]}'`);
              }
            }
            return result;
          })();
        };
        errStr = (() => { if (lexer.showPosition) {
          return `Parse error on line ${(yylineno + 1)}:\n${lexer.showPosition()}\nExpecting ${expected.join(', ')}, got '${(this.tokenNames[symbol] || symbol)}'`;
        } else {
          `Parse error on line ${(yylineno + 1)}: Unexpected ${((symbol === EOF) ? "end of input" : `'${(this.tokenNames[symbol] || symbol)}'`)}`;
          return this.parseError(errStr, {text: lexer.match, token: (this.tokenNames[symbol] || symbol), line: lexer.yylineno, loc: yyloc, expected});
        } })();
        throw new Error(errStr);
      };
      if (((action[0] instanceof Array) && (action.length > 1))) throw new Error(`Parse Error: multiple actions possible at state: ${state}, token: ${symbol}`);
      switch (action[0]) {
        case 1:
          stk.push(symbol, action[1]);
          val.push(lexer.yytext);
          loc.push(lexer.yylloc);
          symbol = null;
          if (!preErrorSymbol) {
            [yyleng, yytext, yylineno, yyloc] = [lexer.yyleng, lexer.yytext, lexer.yylineno, lexer.yylloc];
            if ((recovering > 0)) (recovering--);
          } else {
            [symbol, preErrorSymbol] = [preErrorSymbol, null];
          };
          break;
        case 2:
          len = this.ruleData[action[1]][1];
          yyval.$ = val[(val.length - len)];
          [locFirst, locLast] = [loc[(loc.length - (len || 1))], loc[(loc.length - 1)]];
          yyval._$ = {first_line: locFirst.first_line, last_line: locLast.last_line, first_column: locFirst.first_column, last_column: locLast.last_column};
          if (ranges) yyval._$.range = [locFirst.range[0], locLast.range[1]];
          r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], val, loc]);
          if ((r != null)) yyval.$ = r;
          if (len) {
            stk.length -= (len * 2);
            val.length -= len;
            loc.length -= len;
          };
          stk.push(this.ruleData[action[1]][0]);
          val.push(yyval.$);
          loc.push(yyval._$);
          newState = parseTable[stk[(stk.length - 2)]][stk[(stk.length - 1)]];
          stk.push(newState);
          break;
        case 3:
          return val[(val.length - 1)];
      };
    };
  }
  trace(msg) {
    return (this.options?.debug ? msg : undefined);
  }
  createParser() {
    let module, moduleExpr, parser;
    module = this._generateModuleCore();
    moduleExpr = `(function(){
  const hasProp = {}.hasOwnProperty
  ${module.commonCode}
  const parserInstance = ${module.moduleCode}
  ${this.moduleInclude}
  class Parser { yy = {} }
  Parser.prototype = parserInstance
  parserInstance.Parser = Parser
  return new Parser()
})()`;
    parser = eval(moduleExpr);
    parser.rules = this.rules;
    parser.lexer = this.lexer;
    return parser;
  }
};
if ((process.argv[1] === fileURLToPath(import.meta.url))) {
  (async function() {
    let arg, generator, grammar, grammarFile, i, options, parserCode, showHelp, showStats;
    showHelp = (function() {
      return console.log(`Solar - SLR(1) Parser Generator
===============================

Usage: rip solar.rip [options] [grammar-file]

Options:
  -h, --help              Show this help
  -s, --stats             Show grammar statistics
  -g, --generate          Generate parser (default)
  -o, --output <file>     Output file (default: parser.js)
  -v, --verbose           Verbose output

Examples:
  rip solar.rip grammar.rip
  rip solar.rip --stats grammar.rip
  rip solar.rip -o parser.js grammar.rip
  rip solar.rip --output parser.js grammar.rip
      `);
    });
    showStats = (function(generator) {
      let conflicts, rules, states, tokens, types;
      tokens = Object.keys((generator.tokenNames || {})).length;
      types = Object.keys((generator.types || {})).length;
      rules = (generator.rules?.length || 0);
      states = (generator.states?.length || 0);
      conflicts = (generator.conflicts || 0);
      return console.log(`
⏱️ Statistics:
• Tokens: ${tokens}
• Types: ${types}
• Rules: ${rules}
• States: ${states}
• Conflicts: ${conflicts}`);
    });
    options = {help: false, stats: false, generate: false, output: 'parser.js', verbose: false};
    grammarFile = null;
    i = 0;
    while ((i < (process.argv.length - 2))) {
      arg = process.argv[(i + 2)];
      switch (arg) {
        case '-h':
        case '--help':
          options.help = true;
          break;
        case '-s':
        case '--stats':
          options.stats = true;
          break;
        case '-g':
        case '--generate':
          options.generate = true;
          break;
        case '-o':
        case '--output':
          options.output = process.argv[((++i) + 2)];
          break;
        case '-v':
        case '--verbose':
          options.verbose = true;
          break;
        default:
          if (!arg.startsWith('-')) grammarFile = arg;
          break;
      };
      (i++);
    };
    if ((options.help || !grammarFile)) {
      showHelp();
      process.exit(0);
    };
    return (async () => { try {
      if (!fs.existsSync(grammarFile)) {
        console.error(`Grammar file not found: ${grammarFile}`);
        process.exit(1);
      };
      grammar = await (async () => { if ((grammarFile.endsWith('.rip') || grammarFile.endsWith('.js'))) {
        return (await import(pathToFileURL(path.resolve(grammarFile)).href)).default;
      } else if (grammarFile.endsWith('.json')) {
        return JSON.parse(fs.readFileSync(grammarFile, 'utf8'));
      } else {
        throw new Error("Unsupported format. Use .rip, .js, or .json");
      } })();
      if (!grammar) {
        throw new Error("Failed to load grammar");
      };
      generator = new Generator(grammar, options);
      if (options.stats) {
        showStats(generator);
      };
      return (() => { if ((options.generate || !options.stats)) {
        parserCode = generator.generate();
        fs.writeFileSync(options.output, parserCode);
        return console.log(`\nParser generated: ${options.output}`);
      } })();
    } catch (error) {
      console.error("Error:", error.message);
      if (options.verbose) console.error(error.stack);
      return process.exit(1);
    } })();
  })();
}
export { Generator };
export const Parser = (function(grammar, options) {
  let generator;
  generator = new Generator(grammar, options);
  return generator.createParser();
});
const Solar = {Generator: (function(g, options) {
  return new Generator(g, {...g.options, ...options});
}), Parser: (function(grammar, options) {
  let generator;
  generator = new Generator(grammar, options);
  return generator.createParser();
})};
export default Solar;
