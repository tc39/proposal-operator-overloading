// Babel plugin for operator overloading

// This plugin changes withOperatorsFrom() calls into declarations
// of operator sets, and arithmetic operations into calls into the
// operator overloading runtime, if they take place within a
// withOperatorsFrom() scope.
// Note that the proposal uses a `with operators from` statement instead;
// this version doesn't use such new syntax to avoid the complexity
// that comes with a parser change.

// This plugin runs in a single visitor pass.
// The this object has the following properties included in it:
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
//       _shim._binary(_operators)
//     - Replace unary operators with _shim._unary(_operators)
//     - Replace preincrement and postincrement operators with an
//       assignment and call to the pos or neg operators, with
//       _shim._unary(_operators)

import { declare } from "@babel/helper-plugin-utils";
import { template, types as t } from "@babel/core";
import { parse } from "@babel/parser";

const withOperatorsFromTemplate = template(`
  SHIM._withOperatorsFrom(OPERATORS, ARGS)
`);

const requireShimTemplate = template(`
  const SHIM = require("@littledan/operator-overloading-shim");
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

const preIncrementTemplate = template(`
  EXPRESSION = SHIM._unary(OPERATOR, EXPRESSION, OPERATORS)
`);

const postIncrementTemplate = template(`
  TEMPORARY = EXPRESSION,
  EXPRESSION = SHIM._unary(OPERATOR, EXPRESSION, OPERATORS),
  TEMPORARY
`);

function isWithOperatorsFrom(node) {
  return t.isIdentifier(node.callee) && node.callee.name === "withOperatorsFrom";
}

const visitBlockStatementLike = {
  enter(path) {
    if (!path.node.body.some(statement =>
        t.isExpressionStatement(statement) &&
        t.isCallExpression(statement.expression) &&
        isWithOperatorsFrom(statement.expression))) return;
    const prelude = [];
    if (this.shim === undefined) {
      this.shim = path.scope.generateUidIdentifier("shim");
      prelude.push(requireShimTemplate({SHIM: this.shim}));
    }
    const operators = path.scope.generateUidIdentifier("operators");
    const outer = this.inactive() ? undefined : this.peek().operators;
    this.stack.push({operators, path});
    prelude.push(declareOperatorsTemplate({
      OPERATORS: operators,
      SHIM: this.shim,
      OUTER: outer,
    }));
    path.unshiftContainer('body', prelude);
  },
  exit(path) {
    if (this.peek() && (this.peek().path === path)) {
      this.stack.pop();
      if (this.inactive()) this.shim = undefined;
    }
  }
}

const fixedBinaryOperators = new Set(["===", "!==", "in", "instanceOf"]);

export default declare(api => {
  api.assertVersion(7);

  return {
    pre() {
      this.stack = [];
      this.peek = () => this.stack[this.stack.length - 1];
      this.inactive = () => this.stack.length === 0;
    },
    post() {
      if (!this.inactive() || this.shim !== undefined) {
        throw "internal error";
      }
    },
    visitor: {
      BlockStatement: visitBlockStatementLike,
      Program: visitBlockStatementLike,
      CallExpression(path) {
        if (!isWithOperatorsFrom(path.node)) return;
        if (this.inactive()) {
          throw path.buildCodeFrameError(
             "withOperatorsFrom calls must be statements, not nested expressions.");
        }
        const uid = this.peek().operators;
        path.replaceWith(withOperatorsFromTemplate({
          SHIM: this.shim,
          OPERATORS: uid,
          ARGS: path.node.arguments
        }));
      },
      UpdateExpression(path) {
        if (this.inactive()) return;
        let statement;
        if (path.node.prefix) {
          statement = preIncrementTemplate({
            SHIM: this.shim,
            OPERATOR: t.StringLiteral(path.node.operator),
            EXPRESSION: path.node.argument,
            OPERATORS: this.peek().operators,
          });
        } else {
          let temporary = path.scope.generateUidIdentifier("t");
          statement = postIncrementTemplate({
            SHIM: this.shim,
            OPERATOR: t.StringLiteral(path.node.operator),
            EXPRESSION: path.node.argument,
            OPERATORS: this.peek().operators,
            TEMPORARY: temporary,
          });
        }
        path.replaceWith(statement);
      },
      UnaryExpression(path) {
        if (this.inactive()) return;
        const operator = { "+": "pos", "-": "neg", "~": "~"}[path.node.operator];
        if (operator === undefined) return;
        path.replaceWith(unaryOperatorTemplate({
          SHIM: this.shim,
          OPERATOR: t.StringLiteral(operator),
          EXPRESSION: path.node.argument,
          OPERATORS: this.peek().operators,
        }));
      },
      BinaryExpression(path) {
        if (this.inactive()) return;
        if (fixedBinaryOperators.has(path.node.operator)) return;
        path.replaceWith(binaryOperatorTemplate({
          SHIM: this.shim,
          OPERATOR: t.StringLiteral(path.node.operator),
          LEFT: path.node.left,
          RIGHT: path.node.right,
          OPERATORS: this.peek().operators,
        }));
      },
      AssignmentExpression(path) {
        if (this.inactive()) return;
        // Desugar assignment expressions so the visitor
        // can implement operator overloading
        const operator = {
          "+=": "+",
          "-=": "-",
          "*=": "*",
          "/=": "/",
          "%=": "%",
          "<<=": "<<",
          ">>=": ">>",
          ">>>=": ">>>",
          "|=": "|",
          "^=": "^",
          "&=": "&",
        }[path.node.operator];
        if (operator === undefined) return;
        const newValue = t.BinaryOperator(operator, path.node.left, path.node.right);
        path.node.right = newValue;
        path.node.operator = "=";
      },
    }
  };
});
