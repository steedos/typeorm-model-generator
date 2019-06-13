# steedos-model-generator
Generates models for Steedos from existing database.
Suported db engines:
* Microsoft SQL Server
* PostgreSQL
* MySQL<!-- * MariaDB -->
* Oracle Database
* SQLite


## Installation
### Global module
To install module globally simply type `npm i -g @steedos/steedos-model-generator` in your console.
### Npx way
Thanks to npx you can use npm modules without polluting global installs. So nothing to do here :)
>To use `npx` you need to use npm at version at least 5.2.0. Try updating your npm by `npm i -g npm`
### Database drivers
All database drivers except oracle are installed by default. To use steedos-model-generator with oracle databese you need to install driver with `npm i oracledb` and configure [oracle install client](http://www.oracle.com/technetwork/database/database-technologies/instant-client/overview/index.html) on your machine.

## Usage

```shell
Usage: steedos-model-generator -h <host> -d <database> -p [port] -u <user> -x
[password] -e [engine]

Options:
  --help                 Show help                                     [boolean]
  --version              Show version number                           [boolean]
  -h, --host             IP adress/Hostname for database server
                                                          [default: "127.0.0.1"]
  -d, --database         Database name(or path for sqlite)            [required]
  -u, --user             Username for database server
  -x, --pass             Password for database server              [default: ""]
  -p, --port             Port number for database server
  -e, --engine           Database engine
          [choices: "mssql", "postgres", "mysql", "mariadb", "oracle", "sqlite"]
                                                              [default: "mssql"]
  -o, --output           Where to place generated models
                            [default: "Z:\Repos\steedos-model-generator\output"]
  -s, --schema           Schema name to create model from. Only for mssql and
                         postgres
  --ssl                                               [boolean] [default: false]
  --noConfig             Doesn't create tsconfig.json and ormconfig.json
                                                      [boolean] [default: false]
  --cf, --case-file      Convert file names to specified case
                 [choices: "pascal", "param", "camel", "none"] [default: "none"]
  --ce, --case-entity    Convert class names to specified case
                          [choices: "pascal", "camel", "none"] [default: "none"]
  --cp, --case-property  Convert property names to specified case
                          [choices: "pascal", "camel", "none"] [default: "none"]
  --lazy                 Generate lazy relations      [boolean] [default: false]
  -a, --active-record    Generate models that use the ActiveRecord syntax
                                                      [boolean] [default: false]
  --namingStrategy       Use custom naming strategy
  --relationIds          Generate RelationId fields   [boolean] [default: false]
  --generateConstructor  Generate constructor allowing partial initialization
                                                      [boolean] [default: false]
```
### Examples

* Creating model from local MSSQL database
   * Global module
      ```
      steedos-model-generator -h localhost -d tempdb -u sa -x !Passw0rd -e mssql -o .
      ````
   * Npx Way
      ```
      npx steedos-model-generator -h localhost -d tempdb -u sa -x !Passw0rd -e mssql -o .
      ````
* Creating model from local Postgres database, public schema with ssl connection
   * Global module
      ```
      steedos-model-generator -h localhost -d postgres -u postgres -x !Passw0rd -e postgres -o . -s public --ssl
      ````
   * Npx Way
      ```
      npx steedos-model-generator -h localhost -d postgres -u postgres -x !Passw0rd -e postgres -o . -s public --ssl
      ````
* Creating model from SQLite database
   * Global module
      ```
      steedos-model-generator -d "Z:\sqlite.db" -e sqlite -o .
      ````
   * Npx Way
      ```
      npx steedos-model-generator -d "Z:\sqlite.db" -e sqlite -o .
      ````
The `steedos-model-generator` command will generate the **steedos-config.yml** and **objects** folders, which can be copied to your steedos app project and used to launch the project.