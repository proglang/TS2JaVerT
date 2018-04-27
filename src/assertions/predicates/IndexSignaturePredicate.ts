import { Assertion } from "../Assertion";
import { Type } from "../typescript/Types";
import { Variable } from "../typescript/Variable";
import { CustomPredicate } from "./CustomPredicate";
import { DataProp } from "./DataProp";
import { ForbiddenPredicate } from "./ForbiddenPredicate";
import { HardcodedStringAssertion } from "./HardcodedStringAssertion";
import { SeparatingConjunctionList } from "./SeparatingConjunctionList";

export class IndexSignaturePredicate implements Assertion {
    constructor(private name: string, private type: Type) { }

    public toAssertion(varName: string, forbidden: string): Assertion {
        return new CustomPredicate(this.name, `${varName}, ${forbidden}`);
    }

    public toString(): string {
        const o = "o";
        const allFields = "fields";
        const forbiddenFields = "forbidden";
        const fieldName = "#f";
        const otherFields = "#fields'";
        const logicalVar = new Variable("#v", this.type);

        const def1 = new SeparatingConjunctionList([
            new HardcodedStringAssertion(`${allFields} == []`),
            new ForbiddenPredicate(o, forbiddenFields),
        ]);

        const def2 = new SeparatingConjunctionList([
            new HardcodedStringAssertion(`${allFields} == ${fieldName} :: ${otherFields}`),
            new DataProp(o, fieldName, logicalVar),
            logicalVar.toAssertion(),
            new CustomPredicate(this.name, `${o}, ${otherFields}, ${forbiddenFields}`),
        ]);
        return `
        ${this.name}(${o}, ${allFields}, ${forbiddenFields}) =
            [def1] ${def1.toString()}
            [def2] ${def2.toString()}
`;
    }
}