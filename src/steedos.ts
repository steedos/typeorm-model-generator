import { ColumnInfo } from "./models/ColumnInfo";

const textTsTypes: string[] = ["string"];
const booleanTsTypes: string[] = ["boolean"];
const dateTsTypes: string[] = [];
const datetimeTsTypes: string[] = ["Date"];
const numberTsTypes: string[] = ["number"];

export default class Steedos {
    static getSteedosType(columnInfo: ColumnInfo) {
        const tsType = columnInfo.tsType;
        const dbType = columnInfo.options.type;
        const length = columnInfo.options.length || 0;

        if (dbType === "timestamp") {
            return "number";
        }

        if (dbType === "text" || dbType === "ntext") {
            return "textarea";
        }

        if (textTsTypes.includes(tsType)) {
            if (length > 400) {
                return "textarea";
            } else {
                return "text";
            }
        } else if (booleanTsTypes.includes(tsType)) {
            return "boolean";
        } else if (dateTsTypes.includes(tsType)) {
            return "Date";
        } else if (datetimeTsTypes.includes(tsType)) {
            return "datetime";
        } else if (numberTsTypes.includes(tsType)) {
            return "number";
        } else {
            if (length > 400) {
                return "textarea";
            } else {
                return "text";
            }
        }
    }

    static getSteedosReferenceTo(columnInfo: ColumnInfo) {
        let referenceTo: any[] = [];
        if (columnInfo.relations && columnInfo.relations.length > 0) {
            columnInfo.relations.forEach(relation => {
                referenceTo.push({ name: relation.relatedTable });
            });
        }

        if (referenceTo.length === 1) {
            return referenceTo[0];
        }

        return referenceTo;
    }
}
