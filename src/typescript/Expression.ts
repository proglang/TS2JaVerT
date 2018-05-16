import { compact, difference, find, map, uniq } from "lodash";
import * as ts from "typescript";
import { Function } from "./functions/Function";
import { createAndAnalyseFunction } from "./functions/FunctionCreator";
import { Program } from "./Program";
import { Variable } from "./Variable";

export interface ExpressionAnalysis {
    capturedVars: Variable[];
    funcDef: Function | undefined;
}

function reduceExpressionAnalysis(currResult: ExpressionAnalysis, nextResult: ExpressionAnalysis): ExpressionAnalysis {
    return {
        capturedVars: uniq([
            ...currResult.capturedVars,
            ...nextResult.capturedVars,
        ]),
        funcDef: currResult.funcDef || nextResult.funcDef,
    };
}

const emptyFunctionAnalysis: ExpressionAnalysis = {
    capturedVars: [],
    funcDef: undefined,
};

export function visitExpressionForCapturedVars(
    node: ts.Node | undefined,
    outerScope: Variable[],
    currentScope: Variable[],
    program: Program,
): ExpressionAnalysis {

    const visitExpressionPreservingTypeEnvs
        = (n: ts.Node | undefined) => visitExpressionForCapturedVars(n, outerScope, currentScope, program);
    if (!node ||
        ts.isStringLiteral(node) ||
        ts.isNumericLiteral(node) ||
        (ts.isToken(node) && node.kind === ts.SyntaxKind.ThisKeyword)
    ) {
        return emptyFunctionAnalysis;
    } else if (ts.isIdentifier(node)) {
        if (find(currentScope, Variable.nameMatcher(node.text)) || node.text === "console") {
            return emptyFunctionAnalysis;
        }
        const capturedVar = find(outerScope, Variable.nameMatcher(node.text));
        if (!capturedVar) {
            throw new Error(`Identifier ${node.text} not present in current or outer scope.`);
        }
        return { capturedVars: [capturedVar], funcDef: undefined };
    } else if (ts.isPropertyAccessExpression(node)) {
        // node represents something like a.b; not a["b"]
        return visitExpressionPreservingTypeEnvs(node.expression);
    } else if (ts.isElementAccessExpression(node)) {
        // node represents something like a["b"] or a[x]
        return compact([
            visitExpressionPreservingTypeEnvs(node.expression),
            node.argumentExpression && visitExpressionPreservingTypeEnvs(node.argumentExpression),
        ]).reduce(reduceExpressionAnalysis, emptyFunctionAnalysis);
    } else if (ts.isBinaryExpression(node)) {
        return [
            visitExpressionPreservingTypeEnvs(node.left),
            visitExpressionPreservingTypeEnvs(node.right),
        ].reduce(reduceExpressionAnalysis, emptyFunctionAnalysis);
    } else if (ts.isObjectLiteralExpression(node)) {
        return node.properties
            .map((property) => {
                if (ts.isPropertyAssignment(property)) {
                    return visitExpressionPreservingTypeEnvs(property);
                } else {
                    throw new Error(`Object literal expression contains child of kind ${property.kind}`);
                }
            })
            .reduce(reduceExpressionAnalysis, emptyFunctionAnalysis);
    } else if (ts.isPropertyAssignment(node)) {
        // x: 3
        return visitExpressionPreservingTypeEnvs(node.initializer);
    } else if (ts.isCallExpression(node)) {
        /// f(a, b), where f, a, b can all be more complicated expressions
        return [
            visitExpressionPreservingTypeEnvs(node.expression),
            ...node.arguments.map(visitExpressionPreservingTypeEnvs),
        ].reduce(reduceExpressionAnalysis, emptyFunctionAnalysis);
    } else if (ts.isFunctionExpression(node)) {
        const funcVar = createAndAnalyseFunction(node, program, [...currentScope, ...outerScope]);
        return {
            capturedVars: difference(funcVar.getCapturedVars(), currentScope),
            funcDef: funcVar,
        };
    } else if (ts.isParenthesizedExpression(node)) {
        return visitExpressionPreservingTypeEnvs(node.expression);
    } else if (ts.isNewExpression(node)) {
        return map(node.arguments, visitExpressionPreservingTypeEnvs)
                .reduce(reduceExpressionAnalysis, emptyFunctionAnalysis);
    } else if (ts.isAsExpression(node)) {
        return visitExpressionPreservingTypeEnvs(node.expression);
    }
    throw new Error(`Node of kind ${node.kind} is not an expected Expression`);
}