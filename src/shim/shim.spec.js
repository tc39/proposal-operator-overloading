const shim = require("./build/shim.js");

describe("Operators without overloading registered", () => {
  const operators = shim._declareOperators();
  it('addition on Numbers works as usual', () => {
    expect(shim._binary("+", 1, 2, operators)).toBe(3);
  });
  it('addition on BigInt works as usual', () => {
    expect(shim._binary("+", 1n, 2n, operators)).toBe(3n);
  });
  it('addition on Strings works as usual', () => {
    expect(shim._binary("+", "ab", "cd", operators)).toBe("abcd");
  });
  it('addition between String and Number', () => {
    expect(shim._binary("+", "ab", 1, operators)).toBe("ab1");
    expect(shim._binary("+", 1, "ab", operators)).toBe("1ab");
  });
  it('addition between String and BigInt', () => {
    expect(shim._binary("+", "ab", 1n, operators)).toBe("ab1");
    expect(shim._binary("+", 1n, "ab", operators)).toBe("1ab");
  });
  it('== works as usual', () => {
    expect(shim._binary("==", 1, 2, operators)).toBe(false);
    expect(shim._binary("==", 1, 2n, operators)).toBe(false);
    expect(shim._binary("==", 1, 1, operators)).toBe(true);
    expect(shim._binary("==", 1, 1n, operators)).toBe(true);
    expect(shim._binary("==", 1, true, operators)).toBe(true);
    expect(shim._binary("==", 1, false, operators)).toBe(false);
    expect(shim._binary("==", 0, false, operators)).toBe(true);
    expect(shim._binary("==", 1, "1", operators)).toBe(true);
    expect(shim._binary("==", "1", "1", operators)).toBe(true);
    expect(shim._binary("==", "1", "2", operators)).toBe(false);
    expect(shim._binary("==", "1", true, operators)).toBe(true);
    expect(shim._binary("==", null, undefined, operators)).toBe(true);
    expect(shim._binary("==", undefined, null, operators)).toBe(true);
    expect(shim._binary("==", undefined, 0, operators)).toBe(false);
    expect(shim._binary("==", undefined, NaN, operators)).toBe(false);
    expect(shim._binary("==", null, NaN, operators)).toBe(false);
    expect(shim._binary("==", null, 0, operators)).toBe(false);
  });
  it('== works with object wrappers', () => {
    expect(shim._binary("==", Object(1), 2, operators)).toBe(false);
    expect(shim._binary("==", Object(1), 2n, operators)).toBe(false);
    expect(shim._binary("==", Object(1), 1, operators)).toBe(true);
    expect(shim._binary("==", Object(1), 1n, operators)).toBe(true);
    expect(shim._binary("==", Object(1), true, operators)).toBe(true);
    expect(shim._binary("==", Object(1), false, operators)).toBe(false);
    expect(shim._binary("==", Object(0), false, operators)).toBe(true);
    expect(shim._binary("==", Object(1), "1", operators)).toBe(true);
    expect(shim._binary("==", Object("1"), "1", operators)).toBe(true);
    expect(shim._binary("==", Object("1"), "2", operators)).toBe(false);
    expect(shim._binary("==", Object("1"), true, operators)).toBe(true);
  });
  it('< works on primitives', () => {
    expect(shim._binary('<', 1, 2, operators)).toBe(true);
    expect(shim._binary('<', 2, 2, operators)).toBe(false);
    expect(shim._binary('<', 3, 2, operators)).toBe(false);
    expect(shim._binary('<', 1n, 2, operators)).toBe(true);
    expect(shim._binary('<', 2n, 2, operators)).toBe(false);
    expect(shim._binary('<', 3n, 2n, operators)).toBe(false);
    expect(shim._binary('<', 1n, 2n, operators)).toBe(true);
    expect(shim._binary('<', 2n, 2n, operators)).toBe(false);
    expect(shim._binary('<', 3n, 2, operators)).toBe(false);
    expect(shim._binary('<', "1", 2, operators)).toBe(true);
    expect(shim._binary('<', "2", 2, operators)).toBe(false);
    expect(shim._binary('<', "3", 2, operators)).toBe(false);
    expect(shim._binary('<', "100", 11, operators)).toBe(false);
    expect(shim._binary('<', "100", "11", operators)).toBe(true);
  });
  it('< works on with object wrappers', () => {
    expect(shim._binary('<', Object(1), 2, operators)).toBe(true);
    expect(shim._binary('<', Object(2), 2, operators)).toBe(false);
    expect(shim._binary('<', Object(3), 2, operators)).toBe(false);
    expect(shim._binary('<', Object(1n), 2, operators)).toBe(true);
    expect(shim._binary('<', Object(2n), 2, operators)).toBe(false);
    expect(shim._binary('<', Object(3n), 2n, operators)).toBe(false);
    expect(shim._binary('<', Object(1n), 2n, operators)).toBe(true);
    expect(shim._binary('<', Object(2n), 2n, operators)).toBe(false);
    expect(shim._binary('<', Object(3n), 2, operators)).toBe(false);
    expect(shim._binary('<', Object("1"), 2, operators)).toBe(true);
    expect(shim._binary('<', Object("2"), 2, operators)).toBe(false);
    expect(shim._binary('<', Object("3"), 2, operators)).toBe(false);
    expect(shim._binary('<', Object("100"), 11, operators)).toBe(false);
    expect(shim._binary('<', Object("100"), "11", operators)).toBe(true);
  });
  it('> >= <= also work', () => {
    expect(shim._binary('>', 1, 2, operators)).toBe(false);
    expect(shim._binary('>', 2, 2, operators)).toBe(false);
    expect(shim._binary('>', 3, 2, operators)).toBe(true);
    expect(shim._binary('<=', 1, 2, operators)).toBe(true);
    expect(shim._binary('<=', 2, 2, operators)).toBe(true);
    expect(shim._binary('<=', 3, 2, operators)).toBe(false);
    expect(shim._binary('>=', 1, 2, operators)).toBe(false);
    expect(shim._binary('>=', 2, 2, operators)).toBe(true);
    expect(shim._binary('>=', 3, 2, operators)).toBe(true);
  });
  it('* works', () => {
    expect(shim._binary('*', 2, 3, operators)).toBe(6);
    expect(shim._binary('*', "2", 3, operators)).toBe(6);
    expect(shim._binary('*', "2", "3", operators)).toBe(6);
    expect(shim._binary('*', 2n, 3n, operators)).toBe(6n);
    expect(shim._binary('*', Object(2), 3, operators)).toBe(6);
    expect(shim._binary('*', Object("2"), 3, operators)).toBe(6);
    expect(shim._binary('*', Object("2"), "3", operators)).toBe(6);
    expect(shim._binary('*', Object(2n), 3n, operators)).toBe(6n);
  });
  it('++ works', () => {
    expect(shim._unary('++', 2, operators)).toBe(3);
    expect(shim._unary('++', "2", operators)).toBe(3);
    expect(shim._unary('++', 2n,  operators)).toBe(3n);
    expect(shim._unary('++', Object(2), operators)).toBe(3);
    expect(shim._unary('++', Object("2"), operators)).toBe(3);
    expect(shim._unary('++', Object(2n), operators)).toBe(3n);
  });
});

describe('simple overloading', () => {

  const Ops = shim.Operators({
    '+'(a, b) {
      return new Vector(a.contents.map((elt, i) => elt + b.contents[i]));
    }
  });

  class Vector extends Ops {
    constructor(contents) { super(); this.contents = contents; }
  }

  const vec = new Vector([1, 2, 3]);

  it('+ throws when not in operator set', () => {
    const operators = shim._declareOperators();
    expect(() => shim._binary("+", vec, vec, operators)).toThrowError(TypeError);
  });

  it('+ is permitted among vectors, banned in interoperation', () => {
    const operators = shim._declareOperators();
    shim._withOperatorsFrom(operators, Vector);
    expect(shim._binary("+", vec, vec, operators).contents[2]).toBe(6);
    expect(() => shim._binary("+", vec, 1, operators)).toThrowError(TypeError);
    expect(() => shim._binary("+", 1, vec, operators)).toThrowError(TypeError);
    expect(shim._binary("+", 1, 1, operators)).toBe(2);
  });
});

describe('overloading on the right', () => {

  const Ops = shim.Operators({ }, { left: Number,
    '*'(a, b) {
      return new Vector(b.contents.map(elt => a * elt));
    }
  });

  class Vector extends Ops {
    constructor(contents) { super(); this.contents = contents; }
  }

  const vec = new Vector([1, 2, 3]);

  it('* throws when not in operator set', () => {
    const operators = shim._declareOperators();
    expect(() => shim._binary('*', 2, vec, operators)).toThrowError(TypeError);
  });

  it('Number*Vector is permitted, other combinations banned', () => {
    const operators = shim._declareOperators();
    shim._withOperatorsFrom(operators, Vector);
    expect(shim._binary('*', 2, vec, operators).contents[2]).toBe(6);
    expect(() => shim._binary('*', vec, vec, operators)).toThrowError(TypeError);
    expect(() => shim._binary('*', vec, 2, operators)).toThrowError(TypeError);
    expect(shim._binary('*', 2, 2, operators)).toBe(4);
  });
});

describe('overloading on the left', () => {

  const Ops = shim.Operators({ }, { right: Number,
    '*'(a, b) {
      return new Vector(a.contents.map(elt => b * elt));
    }
  });

  class Vector extends Ops {
    constructor(contents) { super(); this.contents = contents; }
  }

  const vec = new Vector([1, 2, 3]);

  it('* throws when not in operator set', () => {
    const operators = shim._declareOperators();
    expect(() => shim._binary('*', 2, vec, operators)).toThrowError(TypeError);
  });

  it('Number*Vector is permitted, other combinations banned', () => {
    const operators = shim._declareOperators();
    shim._withOperatorsFrom(operators, Vector);
    expect(() => shim._binary('*', 2, vec, operators)).toThrowError(TypeError);
    expect(() => shim._binary('*', vec, vec, operators)).toThrowError(TypeError);
    expect(shim._binary('*', vec, 2, operators).contents[2]).toBe(6);
    expect(shim._binary('*', 2, 2, operators)).toBe(4);
  });
});

describe('[] overloading', () => {
  const Ops = shim.Operators({
    '[]'(a, b) {
      return a.contents[b];
    },
    '[]='(a, b, c) {
      a.contents[b] = c;
    }
  });

  class Vector extends Ops {
    constructor(contents) { super(); this.contents = contents; }
    get length() { return this.contents.length; }
  }


  it('Vector[Number] access works', () => {
    const vec = new Vector([1, 2, 3]);
    expect(vec[0]).toBe(1);
    expect(vec[1]).toBe(2);
    expect(vec[2]).toBe(3);
    expect(vec[3]).toBe(undefined);
    expect(vec[-1]).toBe(undefined);
    expect(vec[.5]).toBe(undefined);
    expect(vec.contents[1]).toBe(2);
    expect(vec["-0"]).toBe(undefined);
    expect(vec.length).toBe(3);
    expect(Object.getPrototypeOf(vec)).toBe(Vector.prototype);
  });

  it('Vector[Number] = value access works', () => {
    'use strict';
    const vec = new Vector([1, 2, 3]);
    expect(vec[0]).toBe(1);
    expect(vec[0] = 5).toBe(5);
    expect(vec[0]).toBe(5);

    expect(vec[1]).toBe(2);
    expect(vec[1] = 20).toBe(20);
    expect(vec[1]).toBe(20);

    expect(vec[5]).toBe(undefined);
    expect(vec[5] = 25).toBe(25);
    expect(vec[5]).toBe(25);

    expect(vec[.5]).toBe(undefined);
    expect(() => vec[.5] = 25).toThrowError(TypeError);
    expect(vec[.5]).toBe(undefined);

    expect(vec[-1]).toBe(undefined);
    expect(() => vec[-1] = 25).toThrowError(TypeError);
    expect(vec[-1]).toBe(undefined);

    expect(vec["-0"]).toBe(undefined);
    expect(() => vec["-0"] = 25).toThrowError(TypeError);
    expect(vec["-0"]).toBe(undefined);
  });

  it('in works', () => {
    const vec = new Vector([1, 2, 3]);
    expect(0 in vec).toBe(true);
    expect(1 in vec).toBe(true);
    expect(2 in vec).toBe(true);
    expect("0" in vec).toBe(true);
    expect("1" in vec).toBe(true);
    expect("2" in vec).toBe(true);
    expect("contents" in vec).toBe(true);

    expect(-1 in vec).toBe(false);
    expect(.5 in vec).toBe(false);
    expect("-0" in vec).toBe(false);
    expect(3 in vec).toBe(false);
  });

  it('keys works', () => {
    const vec = new Vector([1, 2, 3]);
    expect(Object.getOwnPropertyNames(vec)).toEqual(["0", "1", "2", "contents"]);
  });

  it('defineOwnProperty and getOwnProperty work', () => {
    const vec = new Vector([1, 2, 3]);
    Object.defineProperty(vec, "3", { value: 5, writable: true, enumerable: true, configurable: false });
    expect(Object.getOwnPropertyDescriptor(vec, "3")).toEqual({ value: 5, writable: true, enumerable: true, configurable: false });
    Object.defineProperty(vec, "foobar", { value: 5, writable: false, enumerable: false, configurable: false });
    expect(Object.getOwnPropertyDescriptor(vec, "foobar")).toEqual({ value: 5, writable: false, enumerable: false, configurable: false });
    expect(() => Object.defineProperty(vec, "2", { writable: false, enumerable: true, configurable: false, value: 1 })).toThrowError(TypeError);
    expect(() => Object.defineProperty(vec, "2", { writable: true, enumerable: false, configurable: false, value: 1 })).toThrowError(TypeError);
    expect(() => Object.defineProperty(vec, "2", { writable: true, enumerable: true, configurable: true, value: 1 })).toThrowError(TypeError);
    Object.defineProperty(vec, "2", { writable: true, enumerable: true, configurable: false, value: 1 })
    expect(vec[2]).toBe(1);
  });
});

describe("Open set handling", () => {
  it("works for +", () => {
    const OpsA = shim.Operators({
      open: ["+"]
    });
    const a = new OpsA;

    const OpsB = shim.Operators({ }, {
      left: OpsA,
      '+'(a, b) { return 3; }
    });
    const b = new OpsB;

    const operators = shim._declareOperators();
    shim._withOperatorsFrom(operators, OpsA, OpsB);
    expect(shim._binary("+", a, b, operators)).toBe(3);
  });
});
