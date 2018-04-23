import * as ts from "typescript";
import { flatten } from "lodash";
import { Class } from "./Class";
import { visitStatementToFindCapturedVars, visitStatementToFindDeclaredVars } from "./Statement";
import { Variable } from "./Variable";

export class Program {
    private program: ts.Program;
    private sourceFileNode: ts.SourceFile;

    private classes: { [className: string]: Class };
    private gamma: Variable[];

    constructor(fileName: string, options?: ts.CompilerOptions) {
        this.program = ts.createProgram([fileName], options || {});
        const sourceFiles = this.program.getSourceFiles()
            .filter(sourceFile => !sourceFile.isDeclarationFile);
        if (sourceFiles.length !== 1) {
            throw "Only handling programs with one source file";
        }
        this.sourceFileNode = sourceFiles[0];
    }

    findAllClasses() {
        this.classes = {};
        this.sourceFileNode.statements
            .map(statement => {
                if (ts.isClassDeclaration(statement)) {
                    const classFound = new Class(statement, this.program.getTypeChecker());
                    this.classes[classFound.getName()] = classFound;
                }
            });
    }

    determineGamma() {
        const typeChecker = this.program.getTypeChecker();
        this.gamma = flatten(
            this.sourceFileNode.statements
                    .map(statement => visitStatementToFindDeclaredVars(statement, typeChecker))
        );
    }

    determineCapturedVars(): void {
        if (this.gamma == undefined) {
            throw new Error("Can not determine captured vars before establishing gamma contents");
        }
        const typeChecker = this.program.getTypeChecker();
        this.sourceFileNode.statements
            .forEach(statement => visitStatementToFindCapturedVars(
                statement,
                typeChecker,
                [],
                this.gamma)
            );

        console.log(this.gamma);
    }
}