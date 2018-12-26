// Runtime support for operator overloading

// This module exports the Operators object and
// a number of _-prefixed functions which a Babel
// transform can call out to.

// This code doesn't attempt to be 100% spec-compliant,
// high-performance, or monkey-patch proof, but just to
// get the basic cases right for prototyping.

const OperatorSet = Symbol('OperatorSet');
const OperatorDefinition = Symbol('OperatorDefinition');

const binaryOperators = ['-', '*', '/', '%', '**', '&', '^', '|', '<<', '>>', '>>>', '==', '+', '<'];
const binaryOperatorSet = new Set(binaryOperators);
const unaryOperators = ['pos', 'neg', '++', '--', '~'];
const unaryOperatorSet = new Set(unaryOperators);
const allOperators = binaryOperators.concat(unaryOperators, ['[]', '[]=']);
const operatorSet = new Set(allOperators);

// To implement operators on built-in types, back them by
// how JavaScript already works.
// No harm done including additional operators!
const identityOperators = {
  '-'(a, b) {
    return a - b;
  },
  '*'(a, b) {
    return a * b;
  },
  '/'(a, b) {
    return a / b;
  },
  '%'(a, b) {
    return a % b;
  },
  '**'(a, b) {
    return a ** b;
  },
  '&'(a, b) {
    return a & b;
  },
  '^'(a, b) {
    return a ^ b;
  },
  '|'(a, b) {
    return a | b;
  },
  '<<'(a, b) {
    return a << b;
  },
  '>>'(a, b) {
    return a >> b;
  },
  '>>>'(a, b) {
    return a >>> b;
  },
  '=='(a, b) {
    return a == b;
  },
  '+'(a, b) {
    return a + b;
  },
  '<'(a, b) {
    return a < b;
  },
  'pos'(a) {
    return +a;
  },
  'neg'(a) {
    return -a;
  },
  '++'(a) {
    return ++a;
  },
  '--'(a) {
    return --a;
  },
  '~'(a) {
    return ~a;
  },
};


Number[OperatorDefinition] =
    Number.prototype[OperatorSet] = {
      OperatorCounter: 0,
      SelfOperatorDefinition: identityOperators,
      OpenOperators: binaryOperatorSet,
    };

if (typeof BigInt !== 'undefined') {
  BigInt[OperatorDefinition] =
      BigInt.prototype[OperatorSet] = {
        OperatorCounter: 1,
        SelfOperatorDefinition: identityOperators,
        LeftOperatorDefinitions: [identityOperators],
        RightOperatorDefinitions: [identityOperators],
        OpenOperators: binaryOperatorSet,
      };
}

String[OperatorDefinition] =
    String.prototype[OperatorSet] = {
      OperatorCounter: 2,
      SelfOperatorDefinition: identityOperators,
      LeftOperatorDefinitions: [identityOperators, identityOperators],
      RightOperatorDefinitions: [identityOperators, identityOperators],
      OpenOperators: ['+', '==', '<'],
    };

let OperatorCounter = 3;

function cleanTable(table, operatorList) {
  const outTable = {};
  for (const operator of operatorList) {
    const fn = table[operator];
    if (typeof fn !== 'undefined') {
      if (typeof fn !== 'function') {
        throw new TypeError('Operators must be functions');
      }
      outTable[operator] = fn;
    }
  }
  return outTable;
}

function partitionTables(tables) {
  const left = [];
  const right = [];
  for (let table of tables) {
    const leftType = table.left;
    const rightType = table.right;
    table = cleanTable(table, binaryOperators);
    if (typeof leftType !== 'undefined') {
      if (typeof rightType !== 'undefined') {
        throw new TypeError('overload table must not be both left and right');
      }
      const leftSet = leftType[OperatorDefinition];
      if (typeof leftSet === 'undefined') {
        throw new TypeError(
            'the left: value must be a class with operators overloaded');
      }
      for (const key of Object.keys(table)) {
        if (!leftSet.OpenOperators.has(key)) {
          throw new TypeError(
              `the operator ${key} may not be overloaded on the provided type`);
        }
      }
      // "Backwards" because this new operator type is on the right
      // and the other argument is on the left
      right[leftSet.OperatorCounter] = table;
    } else {
      if (typeof rightType === 'undefined') {
        throw new TypeError('Either left: or right: must be provided');
      }
      const rightSet = rightType[OperatorDefinition];
      if (typeof rightSet === 'undefined') {
        throw new TypeError(
            'the right: value must be a class with operators overloaded');
      }
      for (const key of Object.keys(table)) {
        if (!rightSet.OpenOperators.has(key)) {
          throw new TypeError(
              `the operator ${key} may not be overloaded on the provided type`);
        }
      }
      left[rightSet.OperatorCounter] = table;
    }
  }
  return {left, right};
}

function makeOpenSet(open) {
  if (typeof open !== 'undefined') {
    open = [...open];
    for (const operator of open) {
      if (!operatorSet.has(operator)) {
        throw new TypeError(`Unrecognized operator ${operator}`);
      }
    }
  }
  return new Set(open);
}

function CanonicalNumericIndexString(key) {
  if (typeof key !== 'string') return undefined;
  if (key === '-0') return -0;
  const n = Number(key);
  if (String(n) !== key) return undefined;
  return n;
}

function IsInteger(n) {
  if (typeof n !== 'number') return false;
  if (Object.is(n, NaN) || n === Infinity || n === -Infinity) return false;
  return Math.floor(Math.abs(n)) === Math.abs(n);
}

function IsBadIndex(n) {
  return !IsInteger(n) || n < 0 || Object.is(n, -0);
}

export function Operators(table, ...tables) {
  const counter = OperatorCounter++;

  let open = table.open;
  table = cleanTable(table, allOperators);
  const {left, right} = partitionTables(tables);
  open = makeOpenSet(open);

  const set = {
    OperatorCounter: counter,
    SelfOperatorDefinition: table,
    LeftOperatorDefinitions: left,
    RightOperatorDefinitions: right,
    OpenOperators: open,
  };

  let Overloaded;
  if ('[]' in table || '[]=' in table) {
    Overloaded = class {
      constructor() {
        // Unfortunately, we have to close over proxy to invoke Get("length"),
        // so that the receiver will be accurate (e.g., in case it uses private)
        const proxy = new Proxy({__proto__: new.target.prototype, [OperatorSet]: set}, {
          getOwnPropertyDescriptor(target, key) {
            const n = CanonicalNumericIndexString(key);
            if (n === undefined) return Reflect.getOwnPropertyDescriptor(target, key, proxy);
            if (IsBadIndex(n)) return undefined;
            const length = Number(proxy.length);
            if (n >= length) return undefined;
            const value = table['[]'](proxy, n);
            return {value, writable: true, enumerable: true, configurable: false};
          },
          has(target, key) {
            const n = CanonicalNumericIndexString(key);
            if (n === undefined) return Reflect.has(target, key, proxy);
            if (IsBadIndex(n)) return false;
            const length = Number(proxy.length);
            return n < length;
          },
          defineProperty(target, key, desc) {
            const n = CanonicalNumericIndexString(key);
            if (n === undefined) return Reflect.defineProperty(target, key, desc, proxy);
            if (IsBadIndex(n)) return false;
            if (desc.writable === false ||
                desc.enumerable === false ||
                desc.configurable === true) return false;
            table['[]='](proxy, n, desc.value);
            Reflect.defineProperty(target, key, desc, proxy); // Necessary for integrity checks
            return true;
          },
          get(target, key) {
            const n = CanonicalNumericIndexString(key);
            if (n === undefined) return Reflect.get(target, key, proxy);
            if (IsBadIndex(n)) return undefined;
            const length = Number(proxy.length);
            if (n >= length) return undefined;
            const value = table['[]'](proxy, n);
            return value;
          },
          set(target, key, value) {
            const n = CanonicalNumericIndexString(key);
            if (n === undefined) return Reflect.set(target, key, value, proxy);
            if (IsBadIndex(n)) return false;
            table['[]='](proxy, n, value);
            return true;
          },
          ownKeys(target) {
            const length = Number(proxy.length);
            let keys = [];
            for (let i = 0; i < length; i++) keys.push(String(i));
            keys = keys.concat(Reflect.ownKeys(target, proxy));
            return keys;
          },
        });
        return proxy;
      }
    };
  } else {
    Overloaded = class {
      constructor() {
        this[OperatorSet] = set;
      }
    };
  }
  Overloaded[OperatorDefinition] = set;

  return Overloaded;
}

// klass => Array of {operator, definition, options}
const decoratorOperators = new WeakMap();

function OperatorsOverloaded(descriptor, open) {
  // This algorithm doesn't contain enough validation
  // (of options and open) and is too inefficient
  descriptor.finisher = (klass) => {
    const args = [{...open}];
    const operators = decoratorOperators.get(klass);
    if (operators === undefined) throw new TypeError('No operators overloaded');
    decoratorOperators.delete(klass);
    // Gratuitiously inefficient algorithm follows
    for (const {operator, definition, options} of operators) {
      if (options === undefined) {
        args[0][operator] = definition;
      } else {
        let obj = args.find((entry) =>
          entry.right === options.right || entry.left === options.left);
        if (!obj) {
          obj = {...options};
          args.push(obj);
        }
        obj[operator] = definition;
      }
    }
    // get operators and process them into args
    const superclass = Operators(...args);
    Object.setPrototypeOf(klass, superclass);
    Object.setPrototypeOf(klass.prototype, superclass.prototype);
  };
}

Operators.overloaded = function(arg) {
  if (arg[Symbol.toStringTag] === 'Descriptor') {
    return OperatorsOverloaded(arg);
  } else {
    return (descriptor) => OperatorsOverloaded(descriptor, arg);
  }
};

Operators.define = function(operator, options) {
  return function(descriptor) {
    if (descriptor.kind !== 'method') {
      throw new TypeError('@Operator.define must be used on a method');
    }
    const definition = descriptor.descriptor.value;
    descriptor.finisher = (klass) => {
      let operators = decoratorOperators.get(klass);
      if (operators === undefined) {
        operators = [];
        decoratorOperators.set(klass, operators);
      }
      operators.push({operator, definition, options});
    };
  };
};

const defaultOperators = [0, 1, 2];
export function _declareOperators(parent = defaultOperators) {
  return new Set([...parent]);
}

export function _withOperatorsFrom(set, ...additions) {
  for (const klass of additions) {
    const definition = klass[OperatorDefinition];
    if (!definition) {
      throw new TypeError(
          'with operator from must be invoked with a class ' +
          'with overloaded operators');
    }
    set.add(definition.OperatorCounter);
  }
}

function isNumeric(x) {
  return typeof x === 'number' || typeof x === 'bigint';
}

function isObject(x) {
  return typeof x === 'object' && x !== null || typeof x === 'function';
}

function hasOverloadedOperators(obj) {
  return isObject(obj) && OperatorSet in obj;
}

function ToNumericOperand(a) {
  if (isNumeric(a)) return a;
  if (hasOverloadedOperators(a)) return a;
  return +a; // Sloppy on BigInt wrappers
}

function checkPermitted(a, operatorSet, operator) {
  const operatorCounter = a[OperatorSet].OperatorCounter;
  if (!operatorSet.has(operatorCounter)) {
    throw new TypeError(
        '`with operators from` declaration missing before overload usage' +
        ` in evaluating ${operator}`);
  }
}

function assertFunction(fn, operator) {
  if (typeof fn !== 'function') {
    throw new TypeError(`No overload found for ${operator}`);
  }
}

function dispatchBinaryOperator(operator, a, b, operatorSet) {
  checkPermitted(a, operatorSet, operator);
  if (a[OperatorSet] === b[OperatorSet]) {
    const fn = a[OperatorSet].SelfOperatorDefinition[operator];
    assertFunction(fn, operator);
    return fn(a, b);
  } else {
    checkPermitted(b, operatorSet, operator);
    let definitions;
    if (a[OperatorSet].OperatorCounter < b[OperatorSet].OperatorCounter) {
      definitions = b[OperatorSet].RightOperatorDefinitions[
          a[OperatorSet].OperatorCounter];
    } else {
      definitions = a[OperatorSet].LeftOperatorDefinitions[
          b[OperatorSet].OperatorCounter];
    }
    if (typeof definitions !== 'object') {
      throw new TypeError(`No overload found for ${operator}`);
    }
    const fn = definitions[operator];
    assertFunction(fn, operator);
    return fn(a, b);
  }
}

export function _binary(operator, a, b, operatorSet) {
  switch (operator) {
    case "+":
      return _additionOperator(a, b, operatorSet);
    case "==":
      return _abstractEqualityComparison(a, b, operatorSet);
    case "!=":
      return !_abstractEqualityComparison(a, b, operatorSet);
    case "<":
    case ">":
    case "<=":
    case ">=":
      return _abstractRelationalComparison(operator, a, b, operatorSet);
    default:
      return _numericBinaryOperate(operator, a, b, operatorSet);
  }
}

// Binary -, *, /, %, **, &, ^, |, <<, >>, >>>
function _numericBinaryOperate(operator, a, b, operatorSet) {
  if (isNumeric(a) && isNumeric(b)) return identityOperators[operator](a, b); // micro-optimization
  a = ToNumericOperand(a);
  b = ToNumericOperand(b);
  return dispatchBinaryOperator(operator, a, b, operatorSet);
}

// pos, neg, ++, --, ~
export function _unary(operator, a, operatorSet) {
  if (isNumeric(a)) return identityOperators[operator](a); // micro-optimization
  a = ToNumericOperand(a);

  checkPermitted(a, operatorSet, operator);
  const fn = a[OperatorSet].SelfOperatorDefinition[operator];
  assertFunction(fn, operator);
  return fn(a);
}

function ToPrimitive(x) {
  // This does Number hint/default (we're just skipping @@toPrimitive)
  if (isObject(x)) {
    for (const method of ['valueOf', 'toString']) {
      const fn = x[method];
      if (typeof fn === 'function') {
        const result = fn(x);
        if (!isObject(result)) {
          return result;
        }
      }
    }
    throw new TypeError('ToPrimitive failed'); // weird!
  } else {
    return x;
  }
}

function ToOperand(x) {
  if (hasOverloadedOperators(x)) return x;
  return ToPrimitive(x);
}

// ==
function _abstractEqualityComparison(x, y, operatorSet) {
  if (typeof x === typeof y && !isObject(x)) return x === y;
  if (x === null && y === void 0) return true;
  if (x === void 0 && y === null) return true;
  if (typeof x === 'boolean') {
    return _abstractEqualityComparison(Number(x), y, operatorSet);
  }
  if (typeof y === 'boolean') {
    return _abstractEqualityComparison(x, Number(y), operatorSet);
  }
  x = ToOperand(x);
  y = ToOperand(y);
  if (!hasOverloadedOperators(x) && !hasOverloadedOperators(y)) return x == y;
  return dispatchBinaryOperator('==', x, y, operatorSet);
}

// +
function _additionOperator(a, b, operatorSet) {
  // Sloppy about String wrappers
  a = ToOperand(a);
  b = ToOperand(b);
  if (typeof a === 'string' || typeof b === 'string') {
    return a + b;
  }
  return dispatchBinaryOperator('+', a, b, operatorSet);
}

// <, >, <=, >=
function _abstractRelationalComparison(operator, a, b, operatorSet) {
  a = ToOperand(a);
  b = ToOperand(b);
  let swap; let not;
  switch (operator) {
    case '<':
      swap = false;
      not = false;
      break;
    case '>':
      swap = true;
      not = false;
      break;
    case '<=':
      swap = true;
      not = true;
      break;
    case '>=':
      swap = false;
      not = true;
      break;
    default: throw new TypeError;
  }
  if (swap) {
    [a, b] = [b, a];
  }
  let result;
  if (!hasOverloadedOperators(a) && !hasOverloadedOperators(b)) {
    result = a < b;
  } else {
    result = dispatchBinaryOperator('<', a, b, operatorSet);
  }
  if (not) {
    result = !result;
  }
  return result;
}
