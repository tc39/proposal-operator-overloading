# Operator overloading in JavaScript

Should JavaScript support operator overloading? This document examines why we might consider it and how it could work.

## Case studies

### Numeric types

JavaScript has a very restricted set of numeric types. Traditionally, it had just Number: an IEEE-754 double-precision binary float. The [BigInt proposal](http://github.com/tc39/proposal-bigint/) (shipping in Chrome) added a single new numeric type for arbitrary-size integers. But there are more numeric types that developers need in practice, such as decimals, rationals, complex numbers, etc. Operator overloading can provide these, with intuitive syntax for their use.

This example, like many of the following ones, also uses the [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals) proposal as well.

```js
import Big from './big.mjs';  // https://github.com/MikeMcl/big.js/

// Decorator-based API for operator overloading
@Operators.overloaded
class Decimal extends Operators {
  #big;
  constructor(arg) { this.#big = new Big(arg); }

  @Operators.define("+")
  #plus(a, b) { return a.plus(b); }

  @Operators.define("*")
  #plus(a, b) { return a.times(b); }

  @Operators.define("==")
  #decimalEqualsDecimal(a, b) { return a.eq(b); }

  @Operators.define("==", { left: Number })
  #numberEqualsDecimal(a, b) { return b.eq(a); }

  @Operators.define("==", { right: Number })
  #decimalEqualsNumber(a, b) { return a.eq(b); }
}

// Definition in terms of extensible literals proposal
function _m(obj) { return new Decimal(obj.string); }

// Usage:
with operators from Decimal;  // Enable operator overloading for decimals

1_m + 2_m // ==> 3_m
3_m * 2_m // ==> 6_m
1_m == 1_m // ==> true
1_m == 1 // ==> true
1 == 1m // ==> true
1_m === 1 // ==> false, and not overloadable
```

### "Data science": Matrix/vector computations

JavaScript is increasingly used for data processing and analysis, in systems like [stdlib](https://stdlib.io/) and [TensorFlow.js](https://js.tensorflow.org/). These calculations are made a bit more awkward because things involving vector, matrix and tensor calculations need to be done all via method chaining, rather than more naturally using operators as they can in many other programming languages. In systems like TensorFlow, operators can be used to construct an abstract formula in other programming languages. Operator overloading could provide that natural phrasing.

```js
// This example uses the "Imperative API".
// It would also be possible to write with the decorator-based API of the previous example.

const VectorOps = new Operators({
  "+"(a, b) {
    let contents = [];
    for (let i = 0; i < Math.min(a.contents.length, b.contents.length); i++)
      contents[i] = a.contents[i] + b.contents[i];
    return new Vector(contents);
  },
  "*"(a, b) { },
  "=="(a, b) {

  }
}, {
  left: Number,
  "+"(a, b) { },
  "*"(a, b) { }
});

class Vector extends VectorOps {
  contents;
  constructor(contents) {
    super();
    this.contents = contents;
  }
}
Object.preventExtensions(Vector);  // ensure the operators don't change

// Usage:
with operators from Vector;

new Vector([1, 2, 3]) + new Vector([4, 5, 6])  // ==> new Vector([5, 7, 9])
3 * new Vector([1, 2, 3])  // ==> new Vector([3, 6, 9])
```

### Custom String-like types

JavaScript strings

### Ergonomic CSS units calculations

Tab Atkins [proposed](https://www.xanthir.com/b4UD0) that CSS support syntax in JavaScript for CSS unit literals and operators. The [CSS Typed OM](https://drafts.css-houdini.org/css-typed-om-1/) turned out a bit different, with ergonomic affordances but without using new types of literals or operator overloading. With this proposal, in conjunction with [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals), we could have some more intuitive units calculations than the current function- and method-based solution.

In this case, the CSSUnitValue platform objects would come with operator overloading already enabled. Their definition in the CSS Typed OM specification would, indirectly, make use of the same JavaScript mechanism that

```js
with operators from CSSUnitValue;
const { _px, _em } = CSS;

document.querySelector("#element").style.paddingLeft = 3_em + 2_px;
```

### Explain the platform

JavaScript already has three types which have a meaning for operators like `+`: String, BigInt and Number. Operator overloading would make these built-in types a little less special.

## Design goals

- Expressivity
    - Support operator overloading on both mutable and immutable objects, and in the
      future, typed objects and value types.
    - Support operands of different types and the same type, as in the above examples.
    - Explain all of JS's behavior on existing types in terms of operator overloading.
    - Available in both strict and sloppy mode, with and without class syntax.
- Performance/predicability
    - Don't slow down code which doesn't take advantage of operator overloading.
    - The meaning of operators on existing objects shouldn't be overridable
      or monkey-patchable, both for built-in types and for objects defined in
      other libraries.
    - It should not be possible to change the behavior of existing code
      using operators by unexpectedly passing it an object which overloads operators.

### Non-goals

- User-defined operator tokens -- just the existing, built-in operators are enough.
- Taking inheritance into account in the dispatch mechanism (e.g., prototype multiple dispatch)

## Mechanism

### Implementation notes

## Q/A

### Can this work with subclasses, as a mixin?

That would be equivalent to giving overloading behavior to existing objects (since an instance is never "done initializing"). Let's avoid that.

### How does this relate to other proposals?

Value types/typed objects

Extensible literals
