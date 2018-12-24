// Babel plugin for operator overloading

// This plugin changes withOperatorsFrom() calls into declarations
// of operator sets, and arithmetic operations into calls into the
// operator overloading runtime, if they take place within a
// withOperatorsFrom() scope.
// Note that the proposal uses a `with operators from` statement instead;
// this version doesn't use such new syntax to avoid the complexity
// that comes with a parser change.

// This plugin runs in two passes:
//  1. Preparation
//    - Add an import at the beginning of the file of runtime.js
//    - Search for the withOperatorsFrom() calls, and mark their
//      enclosing scopes.
//    - Replace all x= operators with the expanded var = var x arg form
//  2. Transformation
//    - Add a _declareOperator call at the beginning of each
//      scope which contains withOperatorsFrom()
//    - Add a _withOperatorsFrom call, passing in the declared
//      operators, to replace the withOperatorsFrom call
//    - Replace all infix mathematical operators with calls to
//      _numericBinaryOperate or special fns for + == comparison
//    - Replace unary operators with _numericUnaryOperate
//    - Replace preincrement and postincrement operators with an
//      assignment and call to the pos or neg operators, with
//      _numericUnaryOperate

import 
