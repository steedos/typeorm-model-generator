import changeCase = require("change-case");
import fs = require("fs");
import * as Handlebars from "handlebars";
import path = require("path");
import { DataTypeDefaults } from "typeorm/driver/types/DataTypeDefaults";
import { AbstractDriver } from "./drivers/AbstractDriver";
import { MariaDbDriver } from "./drivers/MariaDbDriver";
import { MssqlDriver } from "./drivers/MssqlDriver";
import { MysqlDriver } from "./drivers/MysqlDriver";
import { OracleDriver } from "./drivers/OracleDriver";
import { PostgresDriver } from "./drivers/PostgresDriver";
import { SqliteDriver } from "./drivers/SqliteDriver";
import { IConnectionOptions } from "./IConnectionOptions";
import { IGenerationOptions } from "./IGenerationOptions";
import { EntityInfo } from "./models/EntityInfo";
import { NamingStrategy } from "./NamingStrategy";
import Steedos from "./steedos";
import * as TomgUtils from "./Utils";

export function createDriver(driverName: string): AbstractDriver {
    switch (driverName) {
        case "mssql":
            return new MssqlDriver();
        case "postgres":
            return new PostgresDriver();
        case "mysql":
            return new MysqlDriver();
        case "mariadb":
            return new MariaDbDriver();
        case "oracle":
            return new OracleDriver();
        case "sqlite":
            return new SqliteDriver();
        default:
            TomgUtils.LogError("Database engine not recognized.", false);
            throw new Error("Database engine not recognized.");
    }
}

export async function createModelFromDatabase(
    driver: AbstractDriver,
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions
) {
    let dbModel = await dataCollectionPhase(driver, connectionOptions);
    if (dbModel.length === 0) {
        TomgUtils.LogError(
            "Tables not found in selected database. Skipping creation of typeorm model.",
            false
        );
        return;
    }
    dbModel = modelCustomizationPhase(
        dbModel,
        generationOptions,
        driver.defaultValues
    );
    // modelGenerationPhase(connectionOptions, generationOptions, dbModel);
    modelGenerationPhaseToSteedosYml(
        connectionOptions,
        generationOptions,
        dbModel
    );
}

export function modelGenerationPhaseToSteedosYml(
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions,
    databaseModel: EntityInfo[]
) {
    createHandlebarsHelpers(generationOptions);
    const templatePath = path.resolve(
        __dirname,
        "../../src/template/steedos_object.mst"
    );
    const template = fs.readFileSync(templatePath, "UTF-8");
    const resultPath = generationOptions.resultsPath;
    if (!fs.existsSync(resultPath)) {
        fs.mkdirSync(resultPath);
    }
    let entitesPath = resultPath;
    if (!generationOptions.noConfigs) {
        entitesPath = path.resolve(resultPath, `./objects`);
        if (!fs.existsSync(entitesPath)) {
            fs.mkdirSync(entitesPath);
        }

        if (connectionOptions.databaseType === "oracle") {
            entitesPath = path.resolve(
                entitesPath,
                `./${connectionOptions.user}`
            );
        } else {
            entitesPath = path.resolve(
                entitesPath,
                `./${connectionOptions.databaseName}`
            );
        }

        if (!fs.existsSync(entitesPath)) {
            fs.mkdirSync(entitesPath);
        }
        createSteedosConfig(resultPath, connectionOptions, entitesPath);
        createSteedosAppConfig(entitesPath, connectionOptions, databaseModel);
    }
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true
    });
    databaseModel.forEach(element => {
        let casedFileName = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                casedFileName = changeCase.camelCase(element.tsEntityName);
                break;
            case "param":
                casedFileName = changeCase.paramCase(element.tsEntityName);
                break;
            case "pascal":
                casedFileName = changeCase.pascalCase(element.tsEntityName);
                break;
            case "none":
                casedFileName = element.tsEntityName;
                break;
        }
        const resultFilePath = path.resolve(
            entitesPath,
            casedFileName + ".object.yml"
        );

        const columns = element.Columns;
        columns.forEach(column => {
            column.options.steedosType = Steedos.getSteedosType(column);
            if (element.tsEntityName === "QUEST_SOO_AT_EXECUTION_PLAN") {
                column.options.reference_to = Steedos.getSteedosReferenceTo(
                    column
                );
            }
        });

        const rendered = compliedTemplate(element);
        fs.writeFileSync(resultFilePath, rendered, {
            encoding: "UTF-8",
            flag: "w"
        });
    });
}

export async function dataCollectionPhase(
    driver: AbstractDriver,
    connectionOptions: IConnectionOptions
) {
    return await driver.GetDataFromServer(connectionOptions);
}

export function modelCustomizationPhase(
    dbModel: EntityInfo[],
    generationOptions: IGenerationOptions,
    defaultValues: DataTypeDefaults
) {
    let namingStrategy: NamingStrategy;
    if (
        generationOptions.customNamingStrategyPath &&
        generationOptions.customNamingStrategyPath !== ""
    ) {
        // tslint:disable-next-line:no-var-requires
        const req = require(generationOptions.customNamingStrategyPath);
        namingStrategy = new req.NamingStrategy();
    } else {
        namingStrategy = new NamingStrategy();
    }
    dbModel = setRelationId(generationOptions, dbModel);
    dbModel = applyNamingStrategy(namingStrategy, dbModel);
    dbModel = addImportsAndGenerationOptions(dbModel, generationOptions);
    dbModel = removeColumnDefaultProperties(dbModel, defaultValues);
    return dbModel;
}
function removeColumnDefaultProperties(
    dbModel: EntityInfo[],
    defaultValues: DataTypeDefaults
) {
    if (!defaultValues) {
        return dbModel;
    }
    dbModel.forEach(entity => {
        entity.Columns.forEach(column => {
            const defVal = defaultValues[column.options.type as any];
            if (defVal) {
                if (
                    column.options.length &&
                    defVal.length &&
                    column.options.length === defVal.length
                ) {
                    column.options.length = undefined;
                }
                if (
                    column.options.precision &&
                    defVal.precision &&
                    column.options.precision === defVal.precision
                ) {
                    column.options.precision = undefined;
                }
                if (
                    column.options.scale &&
                    defVal.scale &&
                    column.options.scale === defVal.scale
                ) {
                    column.options.scale = undefined;
                }
                if (
                    column.options.width &&
                    defVal.width &&
                    column.options.width === defVal.width
                ) {
                    column.options.width = undefined;
                }
            }
        });
    });
    return dbModel;
}
function addImportsAndGenerationOptions(
    dbModel: EntityInfo[],
    generationOptions: IGenerationOptions
) {
    dbModel.forEach(element => {
        element.Imports = [];
        element.Columns.forEach(column => {
            column.relations.forEach(relation => {
                if (element.tsEntityName !== relation.relatedTable) {
                    element.Imports.push(relation.relatedTable);
                }
            });
        });
        element.GenerateConstructor = generationOptions.generateConstructor;
        element.IsActiveRecord = generationOptions.activeRecord;
        element.Imports.filter((elem, index, self) => {
            return index === self.indexOf(elem);
        });
    });
    return dbModel;
}

function setRelationId(
    generationOptions: IGenerationOptions,
    model: EntityInfo[]
) {
    if (generationOptions.relationIds) {
        model.forEach(ent => {
            ent.Columns.forEach(col => {
                col.relations.map(rel => {
                    rel.relationIdField = rel.isOwner;
                });
            });
        });
    }
    return model;
}
export function modelGenerationPhase(
    connectionOptions: IConnectionOptions,
    generationOptions: IGenerationOptions,
    databaseModel: EntityInfo[]
) {
    createHandlebarsHelpers(generationOptions);
    const templatePath = path.resolve(__dirname, "../../src/entity.mst");
    const template = fs.readFileSync(templatePath, "UTF-8");
    const resultPath = generationOptions.resultsPath;
    if (!fs.existsSync(resultPath)) {
        fs.mkdirSync(resultPath);
    }
    let entitesPath = resultPath;
    if (!generationOptions.noConfigs) {
        createTsConfigFile(resultPath);
        createTypeOrmConfig(resultPath, connectionOptions);
        entitesPath = path.resolve(resultPath, "./entities");
        if (!fs.existsSync(entitesPath)) {
            fs.mkdirSync(entitesPath);
        }
    }
    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true
    });
    databaseModel.forEach(element => {
        let casedFileName = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                casedFileName = changeCase.camelCase(element.tsEntityName);
                break;
            case "param":
                casedFileName = changeCase.paramCase(element.tsEntityName);
                break;
            case "pascal":
                casedFileName = changeCase.pascalCase(element.tsEntityName);
                break;
            case "none":
                casedFileName = element.tsEntityName;
                break;
        }
        const resultFilePath = path.resolve(entitesPath, casedFileName + ".ts");
        const rendered = compliedTemplate(element);
        fs.writeFileSync(resultFilePath, rendered, {
            encoding: "UTF-8",
            flag: "w"
        });
    });
}

function createHandlebarsHelpers(generationOptions: IGenerationOptions) {
    Handlebars.registerHelper("curly", open => (open ? "{" : "}"));
    Handlebars.registerHelper("toEntityName", str => {
        let retStr = "";
        switch (generationOptions.convertCaseEntity) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
        }
        return retStr;
    });

    Handlebars.registerHelper("toLabel", str => {
        return changeCase.titleCase(str);
    });

    Handlebars.registerHelper("concat", (stra, strb) => {
        return stra + strb;
    });
    Handlebars.registerHelper("toFileName", str => {
        let retStr = "";
        switch (generationOptions.convertCaseFile) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "param":
                retStr = changeCase.paramCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
        }
        return retStr;
    });
    Handlebars.registerHelper("printPropertyVisibility", () =>
        generationOptions.propertyVisibility !== "none"
            ? generationOptions.propertyVisibility + " "
            : ""
    );
    Handlebars.registerHelper("toPropertyName", str => {
        let retStr = "";
        switch (generationOptions.convertCaseProperty) {
            case "camel":
                retStr = changeCase.camelCase(str);
                break;
            case "pascal":
                retStr = changeCase.pascalCase(str);
                break;
            case "none":
                retStr = str;
                break;
        }
        return retStr;
    });
    Handlebars.registerHelper("toLowerCase", str => str.toLowerCase());
    Handlebars.registerHelper("tolowerCaseFirst", str =>
        changeCase.lowerCaseFirst(str)
    );
    Handlebars.registerHelper("toLazy", str => {
        if (generationOptions.lazy) {
            return `Promise<${str}>`;
        } else {
            return str;
        }
    });
    Handlebars.registerHelper({
        and: (v1, v2) => v1 && v2,
        eq: (v1, v2) => v1 === v2,
        gt: (v1, v2) => v1 > v2,
        gte: (v1, v2) => v1 >= v2,
        lt: (v1, v2) => v1 < v2,
        lte: (v1, v2) => v1 <= v2,
        ne: (v1, v2) => v1 !== v2,
        or: (v1, v2, v3, v4, v5, v6) => v1 || v2 || v3 || v4 || v5 || v6,
        isEmpty: v => !v || v.length === 0,
        contain: (v1, v2) => v1 && v1.indexOf(v2) != -1,
        isMultiple: v => v && v.length > 1
    });
}

// TODO:Move to mustache template file
function createTsConfigFile(resultPath) {
    fs.writeFileSync(
        path.resolve(resultPath, "tsconfig.json"),
        `{"compilerOptions": {
        "lib": ["es5", "es6"],
        "target": "es6",
        "module": "commonjs",
        "moduleResolution": "node",
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "sourceMap": true
    }}`,
        { encoding: "UTF-8", flag: "w" }
    );
}
function createSteedosConfig(
    resultPath: string,
    connectionOptions: IConnectionOptions,
    entitesPath: string
) {
    const templateData: any = connectionOptions;
    if (connectionOptions.databaseType === "sqlite") {
        templateData.datasourceName = changeCase.camelCase(
            connectionOptions.databaseName
                .split("\\")
                .slice(-1)[0]
                .split(".")
                .slice(0)[0]
        );
    } else if (connectionOptions.databaseType === "oracle") {
        templateData.datasourceName = connectionOptions.user;
    } else {
        templateData.datasourceName = connectionOptions.databaseName;
    }

    templateData.entitesPath = path.relative(resultPath, entitesPath);

    const templatePath = path.resolve(
        __dirname,
        "../../src/template/steedos_config.mst"
    );
    const template = fs.readFileSync(templatePath, "UTF-8");

    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true
    });

    const rendered = compliedTemplate(templateData);
    fs.writeFileSync(path.resolve(resultPath, "steedos-config.yml"), rendered, {
        encoding: "UTF-8",
        flag: "w"
    });
}

function createSteedosAppConfig(
    resultPath: string,
    connectionOptions: IConnectionOptions,
    entities
) {
    const templateData: any = connectionOptions;
    if (connectionOptions.databaseType === "sqlite") {
        templateData.datasourceName = changeCase.camelCase(
            connectionOptions.databaseName
                .split("\\")
                .slice(-1)[0]
                .split(".")
                .slice(0)[0]
        );
    } else if (connectionOptions.databaseType === "oracle") {
        templateData.datasourceName = connectionOptions.user;
    } else {
        templateData.datasourceName = connectionOptions.databaseName;
    }

    templateData.entities = entities;

    const templatePath = path.resolve(
        __dirname,
        "../../src/template/steedos_app.mst"
    );
    const template = fs.readFileSync(templatePath, "UTF-8");

    const compliedTemplate = Handlebars.compile(template, {
        noEscape: true
    });

    const rendered = compliedTemplate(templateData);
    fs.writeFileSync(
        path.resolve(resultPath, `${templateData.datasourceName}.app.yml`),
        rendered,
        {
            encoding: "UTF-8",
            flag: "w"
        }
    );
}

function createTypeOrmConfig(
    resultPath: string,
    connectionOptions: IConnectionOptions
) {
    if (connectionOptions.schemaName === "") {
        fs.writeFileSync(
            path.resolve(resultPath, "ormconfig.json"),
            `[
  {
    "name": "default",
    "type": "${connectionOptions.databaseType}",
    "host": "${connectionOptions.host}",
    "port": ${connectionOptions.port},
    "username": "${connectionOptions.user}",
    "password": "${connectionOptions.password}",
    "database": "${connectionOptions.databaseName}",
    "synchronize": false,
    "entities": [
      "entities/*.js"
    ]
  }
]`,
            { encoding: "UTF-8", flag: "w" }
        );
    } else {
        fs.writeFileSync(
            path.resolve(resultPath, "ormconfig.json"),
            `[
  {
    "name": "default",
    "type": "${connectionOptions.databaseType}",
    "host": "${connectionOptions.host}",
    "port": ${connectionOptions.port},
    "username": "${connectionOptions.user}",
    "password": "${connectionOptions.password}",
    "database": "${connectionOptions.databaseName}",
    "schema": "${connectionOptions.schemaName}",
    "synchronize": false,
    "entities": [
      "entities/*.js"
    ]
  }
]`,
            { encoding: "UTF-8", flag: "w" }
        );
    }
}
function applyNamingStrategy(
    namingStrategy: NamingStrategy,
    dbModel: EntityInfo[]
) {
    dbModel = changeRelationNames(dbModel);
    dbModel = changeEntityNames(dbModel);
    dbModel = changeColumnNames(dbModel);
    return dbModel;

    function changeRelationNames(model: EntityInfo[]) {
        model.forEach(entity => {
            entity.Columns.forEach(column => {
                column.relations.forEach(relation => {
                    const newName = namingStrategy.relationName(
                        column.tsName,
                        relation,
                        model
                    );
                    model.forEach(entity2 => {
                        entity2.Columns.forEach(column2 => {
                            column2.relations.forEach(relation2 => {
                                if (
                                    relation2.relatedTable ===
                                        entity.tsEntityName &&
                                    relation2.ownerColumn === column.tsName
                                ) {
                                    relation2.ownerColumn = newName;
                                }
                                if (
                                    relation2.relatedTable ===
                                        entity.tsEntityName &&
                                    relation2.relatedColumn === column.tsName
                                ) {
                                    relation2.relatedColumn = newName;
                                }
                                if (relation.isOwner) {
                                    entity.Indexes.forEach(ind => {
                                        ind.columns
                                            .filter(
                                                col =>
                                                    col.name === column.tsName
                                            )
                                            .forEach(
                                                col => (col.name = newName)
                                            );
                                    });
                                }
                            });
                        });
                    });
                    column.tsName = newName;
                });
            });
        });
        return dbModel;
    }

    function changeColumnNames(model: EntityInfo[]) {
        model.forEach(entity => {
            entity.Columns.forEach(column => {
                const newName = namingStrategy.columnName(column.tsName);
                entity.Indexes.forEach(index => {
                    index.columns
                        .filter(column2 => column2.name === column.tsName)
                        .forEach(column2 => (column2.name = newName));
                });
                model.forEach(entity2 => {
                    entity2.Columns.forEach(column2 => {
                        column2.relations
                            .filter(
                                relation =>
                                    relation.relatedTable ===
                                        entity.tsEntityName &&
                                    relation.relatedColumn === column.tsName
                            )
                            .map(v => (v.relatedColumn = newName));
                        column2.relations
                            .filter(
                                relation =>
                                    relation.relatedTable ===
                                        entity.tsEntityName &&
                                    relation.ownerColumn === column.tsName
                            )
                            .map(v => (v.ownerColumn = newName));
                    });
                });

                column.tsName = newName;
            });
        });
        return model;
    }
    function changeEntityNames(entities: EntityInfo[]) {
        entities.forEach(entity => {
            const newName = namingStrategy.entityName(entity.tsEntityName);
            entities.forEach(entity2 => {
                entity2.Columns.forEach(column => {
                    column.relations.forEach(relation => {
                        if (relation.ownerTable === entity.tsEntityName) {
                            relation.ownerTable = newName;
                        }
                        if (relation.relatedTable === entity.tsEntityName) {
                            relation.relatedTable = newName;
                        }
                    });
                });
            });
            entity.tsEntityName = newName;
        });
        return entities;
    }
}
