import * as packagejson from "./../../package.json";
const yaml = require("js-yaml");
const fs = require("fs");
export function LogError(
    errText: string,
    isABug: boolean = true,
    errObject?: any
) {
    console.error(errText);
    console.error(`Error occured in steedos-model-generator.`);
    console.error(`${packageVersion()}  node@${process.version}`);
    console.error(
        `If you think this is a bug please open an issue including this log on ${
            (packagejson as any).bugs.url
        }`
    );
    if (isABug && !errObject) {
        errObject = new Error().stack;
    }
    if (!!errObject) {
        console.error(errObject);
    }
}
export function packageVersion() {
    return `${(packagejson as any).name}@${(packagejson as any).version}`;
}

export function loadYmlFile(filePath: string) {
    return yaml.load(fs.readFileSync(filePath, "utf8"));
}

export function writeYmlFile(filePath: string, data: any) {
    const ymlConfig = yaml.dump(data);
    fs.writeFileSync(filePath, ymlConfig);
}
