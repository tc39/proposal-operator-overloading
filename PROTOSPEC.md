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
| `[[OpenOperators]]` | List of Strings representing operators | The set of operators that this type is open to having overloaded by a yet-to-be-defined type, as the other operand |

Built-in Operator Sets exist for the built-in numeric primitive types: String, BigInt and Number. The phrase "the Operator Set of `x`" refers to `x.[[OperatorSet]]` if `x` is an object, and the built-in Operator Set for those four types, which describes the currently specified behavior.

Note, String overloading only supports the == and < operators, and not the other "numeric" operators. Boolean and Symbol may not have operators overloaded on them.

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
    1. Find the relevant operator definition table in the a.[[OperatorSet]].[[OperatorCounter]]'th element of  b.[[OperatorSet]].[[RightOperatorDefinitions]].
    1. If the operator is `~empty~` in that operator definition table, throw a TypeError.
    1. Otherwise, apply the operator to the arguments using the operator table.
1. Otherwise, b's operator set has a lower `[[OperatorCounter]]` than a's operator set,
    1. Perform the instructions for the corresponding case, but referencing the `[[LeftOperatorDefinitions]]` instead of `[[RightOperatorDefinitions]]`.

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
1. If a === b is *true*, return *true*.
1. Return DispatchBinaryOperator('==', a, b), but return *false* on a missing method rather than throwing a TypeError.

The definition of [Abstract Relational Comparison](https://tc39.github.io/ecma262/#sec-abstract-relational-comparison), which ends up defining <, <=, >, >=:
1. Set a to ToOperand(a, hint Number), and set b to ToOperand(b, hint Number), in the order driven by their order in code.
1. If a and b are both strings, follow the current logic for comparing two strings.
1. Otherwise, return DispatchBinaryOperator('<', a, b).

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

#### Integer-indexed property access

If the `[[SelfOperatorDefinition]]` record contains a definition for `[]` or `[]=`, then the constructor creates an exotic object, with semantics similar to TypedArrays' [Integer-Indexed Exotic Objects](https://tc39.github.io/ecma262/#sec-integer-indexed-exotic-objects), with the following substitutions:
- Calls out to the `[]` function replace IntegerIndexedElementGet
- Calls to the `[]=` function replace IntegerIndexedElementSet
- Get of the `length` property replaces reads of `[[ArrayLength]]` (only used in HasProperty)
- For HasProperty, the detached check is omitted (this means that TypedArrays can't be perfectly emulated)
- In DefineOwnProperty, the length check is skipped (to be handled by `[]=`)

If neither `[]` nor `[]=` are overloaded, then an ordinary object is created.

### Functional definition interface

The `Operators` object (which could be exposed from a [built-in module](https://github.com/tc39/proposal-javascript-standard-library/)) can be called as a function. Like arrow functions, it is not constructable. It is passed a variable number of arguments. The first argument is translates into the `[[SelfOperatorDefinition]]`, while subsequent arguments are individual entries in the `[[LeftOperatorDefinitions]]` or `[[RightOperatorDefinitions]]` lists (based on any `left:` or `right:` property they have). When defining operators which are operating between two different types, the `[[OpenOperators]]` field of that other operator set will be consulted.

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

For objects overloading `[]` and `[]=`, a special V8 ElementsKind could be used to keep track of this special behavior.
