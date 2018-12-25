// Babel plugin for operator overloading

// This plugin changes withOperatorsFrom() calls into declarations
// of operator sets, and arithmetic operations into calls into the
// operator overloading runtime, if they take place within a
// withOperatorsFrom() scope.
// Note that the proposal uses a `with operators from` statement instead;
// this version doesn't use such new syntax to avoid the complexity
// that comes with a parser change.

// This plugin runs in a single visitor pass.
// The state object is of the following form:
// {
//    shim: uid of the required shim module (undefined when stack empty)
//    stack: An Array of {
//      operators: uid of the current modules object
//      path: The path that owns this operator set
//    }
// }
// When the stack is empty, there's no operator overloading registered,
// and no transformation is done until entering a block with a
// withOperatorsFrom() call as a StatementExpressoin.
// The behavior for each element is as follows:
//   Blocks and programs:
//     - Check for a top-level withOperatorsFrom() statement. If found,
//       - Require the shim if empty, and add this as the first statement
//         in the block.
//       - Make the next statement a declaration of a uid for the operators
//         variable, initialized based on the outer operators variable
//         found from the stack.   let newuid = shim._declareOperators(olduid);
//       - Save the operators variable and this node on the stack
//       - As a post callback, pop the top of the stack if we pushed something.
//   Function calls:
//     - If the function is withOperatorsFrom:
//       - If the stack is empty, throw an error (was not at the top level).
//       - Otherwise, turn it into shim._withOperatorsFrom(operators, args...)
//   Operators:
//     - Replace all x= operators with the expanded var = var x arg form
//     - Replace all infix mathematical operators with calls to
//       _shim._numericBinaryOperate(_operators) or special fns for
//       +, == or comparison
//     - Replace unary operators with _shim._numericUnaryOperate(_operators)
//     - Replace preincrement and postincrement operators with an
//       assignment and call to the pos or neg operators, with
//       _shim._numericUnaryOperate(_operators)

import { declare } from "@babel/helper-plugin-utils";
import { template, types as t } from "@babel/core";
import { parse } from "@babel/parser";

const withOperatorsFromTemplate = template(`
  SHIM._withOperatorsFrom(OPERATORS, ARGS)
`);

const requireShimTemplate = template(`
  const SHIM = require("@littledan/operator-overloading-shim/internals.js");
`);

const declareOperatorsTemplate = template(`
  const OPERATORS = SHIM._declareOperators(OUTER);
`);

const unaryOperatorTemplate = template(`
  SHIM._unary(OPERATOR, EXPRESSION, OPERATORS)
`);

const binaryOperatorTemplate = template(`
  SHIM._binary(OPERATOR, LEFT, RIGHT, OPERATORS)
`);

function isWithOperatorsFrom(node) {
  return t.isCallExpression(node)
      && t.isIdentifier(node.callee)
      && node.callee.name === "withOperatorsFrom";
}

const visitBlockStatementLike = {
  enter(path, state) {
    if (!path.node.body.some(isWithOperatorsFrom)) return;
    const prelude = [];
    if (state.shim === undefined) {
      state.shim = path.scope.generateUidIdentifier("shim");
      prelude.push(requireShimTemplate({SHIM: state.shim}));
    }
    const operators = path.scope.generateUidIdentifier("operators");
    state.stack.push({operators, path});
    const outer = state.inactive()
                ? t.Identifier("undefined")
                : state.peek().operator;
    prelude.push(declareOperatorsTemplate({
      OPERATORS: operators,
      SHIM: state.shim,
      OUTER: outer,
    }));
    path.unshiftContainer('body', prelude);
  },
  exit(path, state) {
    if (state.peek().path === path) {
      state.stack.pop();
      if (state.inactive()) state.shim = undefined;
    }
  }
}

const fixedUnaryOperators = new Set(["typeof", "void", "delete", "throw", "!"]);
const fixedBinaryOperators = new Set(["===", "!==", "in", "instanceOf"]);

export default declare(api => {
  api.assertVersion(7);

  return {
    pre(state) {
      state.stack = [];
      state.peek = () => state.stack[state.stack.length - 1];
      state.inactive = () => state.stack.length === 0;
    },
    post(state) {
      if (!state.inactive() || state.shim !== undefined) {
        throw "internal error";
      }
    },
    visitor: {
      BlockStatement: visitBlockStatementLike,
      Program: visitBlockStatementLike,
      CallExpression(path, state) {
        if (!isWithOperatorsFrom(path.node)) return;
        if (!t.isExpressionStatement(path.parent.node) || state.inactive()) {
          throw path.buildCodeFrameError(
             "withOperatorsFrom calls must be statements, not nested expressions.");
        }
        const uid = state.peek().operators;
        path.replaceWith(withOperatorsFromTemplate({
          SHIM: state.shim,
          OPERATORS: uid,
          ARGS: path.node.arguments
        }));
      },
      UpdateExpression(path, state) {
        if (state.inactive()) return;
        // TODO
      },
      UnaryExpression(path, state) {
        if (state.inactive()) return;
        if (fixedUnaryOperators.has(path.node.operator)) return;
        path.replaceWith(unaryOperatorTemplate({
          SHIM: state.shim,
          OPERATOR: path.node.operator,
          EXPRESSION: path.node.argument,
          OPERATORS: state.peek().operators,
        }));
      },
      BinaryExpression(path, state) {
        if (state.inactive()) return;
        if (fixedUnaryOperators.has(path.node.operator)) return;
        path.replaceWith(binaryOperatorTemplate({
          SHIM: state.shim,
          OPERATOR: path.node.operator,
          LEFT: path.node.left,
          RIGHT: path.node.right,
          OPERATORS: state.peek().operators,
        }));
      },
      AssignmentExpression(path, state) {
        if (state.inactive()) return;
        // TODO
      },
    }
  };
});
