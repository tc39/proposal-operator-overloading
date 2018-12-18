# Operator overloading in JavaScript

Should JavaScript support operator overloading? This document examines why we might consider it and how it could work.

(Status: Not at a stage; not presented in TC39)

## Case studies

Operator overloading is all about enabling richer libraries. This section gives four motivating use cases of such rich libraries.

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
  #plus(a, b) { return a.#big.plus(b.#big); }

  @Operators.define("*")
  #plus(a, b) { return a.#big.times(b.#big); }

  @Operators.define("==")
  #decimalEqualsDecimal(a, b) { return a.#big.eq(b.#big); }

  @Operators.define("==", { left: Number })
  #numberEqualsDecimal(a, b) { return b.#big.eq(a); }

  @Operators.define("==", { right: Number })
  #decimalEqualsNumber(a, b) { return a.#big.eq(b); }
}

// Definition in terms of extensible literals proposal
function _m(obj) { return new Decimal(obj.string); }

// Usage:
with operators from Decimal;  // Enable operator overloading for decimals

1_m + 2_m     // ==> 3_m
3_m * 2_m     // ==> 6_m
1_m == 1_m    // ==> true
1_m == 1      // ==> true
1 == 1m       // ==> true
1_m === 1     // ==> false (not overloadable)
```

### Matrix/vector computations

JavaScript is increasingly used for data processing and analysis, with libraries like [stdlib](https://stdlib.io/). These calculations are made a bit more awkward because things involving vector, matrix and tensor calculations need to be done all via method chaining, rather than more naturally using operators as they can in many other programming languages. Operator overloading could provide that natural phrasing.

```js
// This example uses the "Imperative API".
// It would also be possible to write with the decorator-based API of the previous example.

const VectorOps = Operators({
  "+"(a, b) {
    return new Vector(a.contents.map((elt, i) => elt + b.contents[i]));
  },
  "=="(a, b) {
    return a.contents.length === b.contents.length &&
           a.contents.every((elt, i) => elt == b.contents[i]);
  }
}, {
  left: Number,
  "*"(a, b) {
    return new Vector(b.contents.map(elt => elt * a));
  }
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

new Vector([1, 2, 3]) + new Vector([4, 5, 6])   // ==> new Vector([5, 7, 9])
3 * new Vector([1, 2, 3])                       // ==> new Vector([3, 6, 9])
new Vector([1, 2, 3]) == new Vector([1, 2, 3])  // ==> true
```

### Equation DSLs

JavaScript is used in systems with equation-based DSLs, such as [TensorFlow.js](https://js.tensorflow.org/). In systems like TensorFlow, operators can be used to construct an abstract formula in other programming languages. Operator overloading could allow these formula DSLs to be expressed as infix expressions, as people naturally think of them.

For example, in TensorFlow.js's introductory tutorials, there is an [example](https://github.com/tensorflow/tfjs-examples/blob/master/polynomial-regression-core/index.js#L63) of an equation definition as follows:
```js
function predict(x) {
  // y = a * x ^ 3 + b * x ^ 2 + c * x + d
  return tf.tidy(() => {
    return a.mul(x.pow(tf.scalar(3, 'int32')))
      .add(b.mul(x.square()))
      .add(c.mul(x))
      .add(d);
  });
}
```

It's unfortunate that the equation has to be written twice, once to explain it and once to write it in code. With operator overloading and extensible literals, it might be written as follows instead:

```js
function predict(x) {
  // y = a * x ^ 3 + b * x ^ 2 + c * x + d
  return tf.tidy(() => {
    return a * x ** 3_int32
         + b * x ** 2_int32
         + c * x
         + d;
  });
}
```

At this point, maybe you don't even need that comment!

### Ergonomic CSS units calculations

Tab Atkins [proposed](https://www.xanthir.com/b4UD0) that CSS support syntax in JavaScript for CSS unit literals and operators. The [CSS Typed OM](https://drafts.css-houdini.org/css-typed-om-1/) turned out a bit different, with ergonomic affordances but without using new types of literals or operator overloading. With this proposal, in conjunction with [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals), we could have some more intuitive units calculations than the current function- and method-based solution.

In this case, the CSSUnitValue platform objects would come with operator overloading already enabled. Their definition in the CSS Typed OM specification would, indirectly, make use of the same JavaScript mechanism that

```js
with operators from CSSUnitValue;
const { _px, _em } = CSS;

document.querySelector("#element").style.paddingLeft = 3_em + 2_px;
```

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
      using operators by unexpectedly passing it an object which overloads operators. (*If this is feasible.*)
    - Don't encourage a crazy coding style in the ecosystem.
- Operator overloading should be a way of 'explaining the language' and providing hooks into something that's already there, rather than adding something which is a very different pattern from built-in operator definitions.

## Mechanism

The operator overloading proposal is based on creation of objects with an `[[OperatorSet]]` internal slot, which points to a spec-internal Operator Set record. The Operator Set controls the dispatch of operators. A functional and decorator-based interface exists to define Operator Sets (called `Operators` in JavaScript) and create objects that have operators dispatched according to them.

### Operator Sets

The global counter OperatorCounter is used to assign an integer to each Operator Set.

An Operator Definitition Table is a table with values for each [numeric type operation](https://tc39.github.io/proposal-bigint/#table-numeric-type-ops), as enumerated in the BigInt specification, either JavaScript function objects or the `~empty~` sentinel value. A "binary Operator Definition Table" has `~empty~` as its value for each unary operation. Note that the sameValue and sameValueZero operations from that table are never invoked through operator overloading.

Each Operator Set record has the following fields, none of which are ever modified after the operator set is created:

| Name | Type | Description |
|------|------|-------------|
| `[[OperatorCounter]]` | integer | Value of the OperatorCounter when this Operator Set was created |
| `[[SelfOperatorDefinition]]` | Operator Definition Table | Definition of unary operators, and binary operators with both operands being of this Operator Set |
| `[[LeftOperatorDefinitions]]` | List of length `[[OperatorCounter]]` with elements either `~empty~` or binary Operator Defintion Table | Operator definitions for when this is the left operand, and something of a lower OperatorCounter is the right operand |
| `[[RightOperatorDefinitions]]` | "" | "" but for the right operand |

Built-in Operator Sets exist for the built-in numeric primitive types: String, BigInt and Number. The phrase "the Operator Set of `x`" refers to `x.[[OperatorSet]]` if `x` is an object, and the built-in Operator Set for those four types, which describes the currently specified behavior.

Note, String overloading only supports the +, == and < operators, and not the other "numeric" operators. Boolean and Symbol may not have operators overloaded on them.

### Operator usage semantics

A few operators are special, and the rest follow a pattern.

#### Shared algorithms

The operation ToOperand(arg [, hint]) does the following:
1. If arg is an Object with an `[[OperatorSet]]` internal slot,
    1. If the operator set of arg is not in the allowed set of operators, which had a `with operators from` declaration, based on the lexical scope, throw a TypeError.
    1. Otherwise, return arg.
1. Otherwise, return ToPrimitive(arg [, hint]).

DispatchBinaryOperator(operator, a, b):
1. If the operator set of a and b are the same,
    1. If the common operator set does not have a definition for the operator in its `[[SelfOperatorDefinition]]` table, throw a TypeError.
    1. Otherwise, apply the definition to the arguments and return the result.
1. Otherwise, if a's operator set has a lower `[[OperatorCounter]]` than b's operator set,
    1. Find the relevant operator definition table in the b.`[[OperatorSet]]`.`[[OperatorCounter]]`'th element of a.`[[OperatorSet]]`.`[[RightOperatorDefinitions]]`.
    1. If the operator is `~empty~` in that operator definition table, throw a TypeError.
    1. Otherwise, apply the operator to the arguments using the operator table.
1. Otherwise, b's operator set has a lower `[[OperatorCounter]]` than a's operator set,
    1. Perform the instructions for the corresponding case, but referencing the `[[LeftOperatorDefinitions]]` instead of the left.

DispatchUnaryOperator(operator, arg):
1. If the Operator Set of value doesn't have a definition for the operator, throw a TypeError.
1. Otherwise, call the operator on value and return the result.

#### Special operators

The definition of `+`(a, b):
1. Set a to ToOperand(a).
1. Set b to ToOperand(b).
1. If Type(a) is String or Type(b) is String,
    1. Return the string-concatenation of ToString(a) and ToString(b).
1. Return DispatchBinaryOperator(a, b).

The definition of `==`(x, y):
1. If Type(x) is the same as Type(y), and neither x nor y are Objects with an `[[OperatorSet]]` internal slot, then
    1. Return the result of performing Strict Equality Comparison x === y.
1. If x is null and y is undefined, return true.
1. If x is undefined and y is null, return true.
1. If Type(x) is Boolean, return the result of the comparison ToNumber(x) == y.
1. If Type(y) is Boolean, return the result of the comparison x == ToNumber(y).
1. If Type(x) is Object and x does not have an [[OperatorSet]] internal slot, set x to ToPrimitive(x).
1. If Type(y) is Object and y does not have an [[OperatorSet]] internal slot, set y to ToPrimitive(y).
1. Return DispatchBinaryOperator(a, b).

The definition of [Abstract Relational Comparison](https://tc39.github.io/ecma262/#sec-abstract-relational-comparison), which ends up defining <, <=, >, >=:
1. Set a to ToOperand(a, hint Number), and set b to ToOperand(b, hint Number), in the order driven by their order in code.
1. If a and b are both strings, follow the current logic for comparing two strings.
1. Otherwise, follow the remaining steps for an ordinary overloaded binary operator, given a and b, using the common lessThan operator for the operation.

Note that String can only be overloaded for the above operators, and cannot be usefully overloaded for the below "numerical" operators.

#### Numerical operators

The operation ToNumericOperand(arg) is used in the following definitions:
1. If Type(arg) is Number or Type(arg) is BigInt, return arg.
1. If Type(arg) is Object and arg has a `[[OperatorSet]]` internal slot, return ToOperand(arg).  NOTE: The ToOperand call is just to check whether it was declared as `with operators from`.
1. Return ToNumeric(arg).  NOTE: This step may only convert to one of the built-in numeric types; value types may define more.

For a unary operator (such as unary `-`, `++`, `--`, `~`) applied to `arg`:
1. Let value be ToNumericOperand(arg).
1. Return DispatchUnaryOperator(operator, arg).

For a binary operator which is not listed above (such as `*`, `/`, `<`) applied to `a` and `b`:
1. Set a to ToNumericOperand(a).
1. Set b to ToNumericOperand(b).
1. Return DispatchBinaryOperator(operator, a, b).

### Functional definition interface

The `Operators` object (which could be exposed from a [built-in module](https://github.com/tc39/proposal-javascript-standard-library/)) can be called as a function. Like arrow functions, it is not constructable. It is passed a variable number of arguments. The first argument is translates into the `[[SelfOperatorDefinition]]`, while subsequent arguments are individual entries in the `[[LeftOperatorDefinitions]]` or `[[RightOperatorDefinitions]]` lists (based on any `left:` or `right:` property they have).

### Decorator definition interface

The decorator interface provides convenient syntactic sugar over the functional interface above.

The `Operators` object has two properties which are decorators:
- `Operators.define`, a method decorator, which does the following:
    1. Returns the method as is, adding a finisher which closes over the method and the arguments to the decorator.
    1. The finisher appends a tuple containing the method function and the other arguments to a List, which is "associated with" the class.
- `Operators.overloaded`, a class decorator, which does the following:
    1. Add a finisher to do the following things:
        1. Assert that the superclass is Operators (which will just throw if called as a super constructor)
        1. Take the associated define list and munge it into the argument for the functional definition interface.
        1. Call into the functional definition interface, and replace the superclass with the result of that call.
        1. Prevent changing the superclass, e.g. through Object.preventExtensions.

### `with operators from` declarations

The purpose of these declarations is to meet this goal:

> It should not be possible to change the behavior of existing code using operators by unexpectedly passing it an object which overloads operators. 

The idea of these declarations is, within a particular chunk of code, only explicitly enabled operator overloads should be used. The `with operators from` declaration specifically enables certain types for overloading, leaving the rest prohibited.

When such a declaration is reached, the argument `arg` has Get(arg, `Operators.operators`) applied, to get the related Operators instance, and then the `[[OperatorSetDefinition]]` internal slot of that is read. If that doesn't exist, a TypeError is thrown. If it does, then the relevant operator set is added to the lexical scope for permitted use.

It's not clear whether the performance (see below) or ergonomics impact will outweigh the predictability/security benefits of this check; more thought and discussion is needed.

### Implementation notes

*Warning: Wild speculation follows; others will have more realistic input for operator overloading*

The implementation experience of BigInt showed that it wasn't hard to add an extra "else case" to existing operators while avoiding slowing down existing code. The hard part will be ensuring that operator overloading is cheap when it's used.

The implementation can take advantage of the fact that the operators are something overloaded in the base class. In V8, for example, an object with overloaded operators might be representable as its own `instance_type` (one `instance_type` for all objects with overloaded operators), making it cheap to check whether operators are overloaded at all. (BigInt is also distinguished using the `instance_type`.)

The actual link to the operators can be found with `GetConstructor()`, avoiding extra memory overhead on the map (at the expense of finding those operators requiring a traversal). There does not need to be any logic to invalidate the found operators (`PrototypeInfo`-style), as they cannot be changed. An object never transitions between having operators overloaded and not, and never changes which operator overloadings apply to it.

Within code generated by a JIT, or an inline cache, a map check of both operands should be sufficient to dispatch to the same operator implementation. No invalidation logic is needed, as long as it's the same map.

To include the checks about whether operators are currently in use, an extra check will be required, and it will be hard to optimize away this check. A single `with operators` declaration can run multiple times with different values running through it, and this must be handled properly. The idea would be to include the mask of permitted operator indices as an implicit lexically scoped variable which contains a bitmask, and check whether the arguments have those indices enabled before each overloaded operation. This mask will never change after being initialized. An inline cache can reduce the overhead of the check by checking that the identity of the bitmask object is the same as what was expected, which will imply that its contents are the same. It's possible that the overhead will be considered too great here to do the extra checks in practice.

## Q/A

### Can this work with subclasses, as a mixin?

That would be equivalent to giving overloading behavior to existing objects (since an instance is never "done initializing"). Let's avoid that.

### Can't we allow monkey-patching, for mocking, etc?

You can do mocking by creating a separate operator-overloaded class which works like the one you're trying to mock, or even interacts with it. Or, you can make your own hooks into the operator definitions to allow mocking. But letting any code reach into the definition of the operators for any other type risks making operators much less reliable than JavaScript programmers are acustomed to.

### Why does this have to be based on classes? I don't like classes!

It doesn't *have* to be based on classes, but the reason the above examples use inheritance is that a base class constructor gives a chance to return a truly unique object, with an internal slot that guides the overloading behavior. It's not clear how to get that out of object literals, but you can use the above API in a way like this, if you'd like:

```js
function makePoint(obj) { return Object.assign(new pointOps, obj); }
const pointOps = Operators({ "+"(a, b) { return makePoint({x: a.x + b.x, y: a.y + b.y}); });
let point = makePoint({ x: 1, y: 2 });
(point + point).y;  // 4
```

In the future, value types and/or value types might give a more ergonomic, non-class-based syntax.

### Why not use symbols instead of a whole new dispatch mechanism?

Symbols would allow monkey-patching, Proxy interception, and a general lack of robustness. They don't give a clear way to dispatch on the right operand, without requiring a *second* property access (like Python). The Python-style dispatch also has a left-to-right bias, which is unfortunate.

### Why doesn't this let me define my own operator token?

This proposal only allows overloading built-in operators, because:

- User-defined precedence for such tokens is unworkable to parse.
- Hopefully the [pipeline operator](https://github.com/tc39/proposal-pipeline-operator) and [optional chaining](https://github.com/tc39/proposal-optional-chaining) will solve many of the cases that would motivate these operators.
- We deliberately want to limit the syntactic divergence of JavaScript programs.

### Should operator overloading use inheritance-based multiple dispatch involving the prototype chain?

This proposal has opted against using something like Slate's Prototype Multiple Dispatch, because:

- This is really complicated to implement and optimize reliably.
- It's not clear what important use cases there are that aren't solved by single-level dispatch.

### How does this relate to other proposals?

#### BigInt

[BigInt](https://github.com/tc39/proposal-bigint/) provides definitions for how operators work on just one new type. This proposal generalizes that to types defined in JavaScript.

#### Typed Objects and Value Types

[Typed Objects](https://github.com/tschneidereit/proposal-typed-objects/blob/master/explainer.md) is a proposal for efficient, fixed-shape objects.

Value Types is an idea in TC39 about user-definable primitive types. At some points in the past, it was proposed that operator overloading be tied to value types.

When these proposals mature more, it will be good to look into how operator overloading can be enabled for Typed Objects and Value Types. The idea in this repository is to not limit operator overloading to those two types of values, but to also permit operator overloading for ordinary objects.

#### Extended numeric literals

The [extended numeric literals](https://github.com/tc39/proposal-extended-numeric-literals) proposal allows numeric-like types such as `3_px` or `5.2_m` to be defined and used ergonomically.  Extended numeric literals and operator overloading fit well together, as the examples in this README show, but they don't depend on each other and can each be used separately.
