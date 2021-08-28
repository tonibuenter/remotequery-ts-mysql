/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */

import * as pino from 'pino';
import * as mysql from 'mysql';
import { Connection, FieldInfo, MysqlError, Pool } from 'mysql';

import * as camelCase from 'camelCase';
import { Result } from 'remotequery-ts';

export const Config: any = {
  user: null,
  password: null,
  host: 'localhost',
  database: 'jground',
  logger: null,
  sqlLogger: null
};

Config.initPool = () => {
  return (Config.pool = mysql.createPool({
    host: Config.host,
    user: Config.user,
    password: Config.password,
    database: Config.database
  }));
};

export function init({ user, password, host, database, logger, sqlLogger }: any): Pool {
  Config.user = user;
  Config.password = password;
  Config.host = host;
  Config.database = database;
  Config.logger =
    logger ||
    pino({
      level: 'info',
      prettyPrint: {
        colorize: true
      }
    });
  Config.sqlLogger =
    sqlLogger ||
    pino({
      level: 'info',
      prettyPrint: {
        colorize: true
      }
    });
  return Config.initPool();
}

Config.logger = pino({
  level: 'info',
  prettyPrint: {
    colorize: true
  }
});

Config.sqlLogger = pino({
  level: 'info',
  prettyPrint: {
    colorize: true
  }
});

Config.datasource = {
  getConnection() {
    return new Promise((resolve, reject) => {
      Config.pool.getConnection(function (err: MysqlError | null, conn: Connection) {
        if (err) {
          reject(err);
          return;
        }
        if (conn) {
          Config.logger.debug('getConnection DONE');
          resolve(conn);
        }
      });
    });
  },
  returnConnection(con: { release: () => void }) {
    try {
      con.release();
    } catch (e) {
      Config.logger.error('returnConnection ->', e);
    }
    Config.logger.debug('returnConnection DONE');
  }
};

//
// PROCESS SQL CON PLUGIN - for mysql
//

export const isalnum = (ch: string) => {
  return ch.match(/^[a-z0-9]+$/i) !== null;
};

export async function processSql(sql: any, parameters?: any, context?: any): Promise<Result> {
  let con, result: Result;
  try {
    con = await Config.datasource.getConnection();
    result = await processSql_con(con, sql, parameters, context?.maxRows);
  } catch (err: any) {
    Config.logger.info(err.stack);
    result = { exception: err.message, stack: err.stack, hasMore: false };
  } finally {
    Config.datasource.returnConnection(con);
  }
  return result;
}

export async function processSqlDirect(sql: string, values = [], maxRows: number) {
  let con, result;
  try {
    con = await Config.datasource.getConnection();
    result = await processSqlQuery(con, sql, values, maxRows);
  } catch (err: any) {
    Config.logger.error(err.stack);
    result = { exception: err.message, stack: err.stack };
  } finally {
    Config.datasource.returnConnection(con);
  }
  return result;
}

export function namedParameters2QuestionMarks(
  sql: string,
  parameters: Record<string, string>,
  logger?: any
): { sqlQm: string; parametersUsed: any; values: any[] } {
  let inquote = false;
  const parametersUsed: any = {};
  const values: any[] = [];
  const sqlQm = sql.replace(/:([0-9a-zA-Z$_]+)(\[])?|(')/g, function (mtch, key, brck, quote) {
    if (logger) {
      logger(mtch, key, brck, quote);
    }
    if (quote) {
      inquote = !inquote;
      return mtch;
    }
    if (inquote) {
      return mtch;
    }
    let p = parameters[key];
    p = typeof p === 'string' ? p.trim() : typeof p === 'number' ? p : p === null || p === undefined ? '' : p;
    let qms = '';
    if (brck === '[]' || Array.isArray(p)) {
      const vArray = Array.isArray(p) ? p : typeof p === 'string' ? p.split(/\s*,\s*/) : [p];
      vArray.forEach((v, index) => {
        parametersUsed[key + index] = v;
        values.push(v);
        if (index !== 0) {
          qms += ',';
        }
        qms += '?';
      });
    } else {
      parametersUsed[key] = p;
      values.push(p);
      qms += '?';
    }
    return qms;
  });
  return { sqlQm, parametersUsed, values };
}

export function processSql_con(con: any, sql: string, parameters = {}, maxRows = 10000): Promise<Result> {
  Config.sqlLogger.debug('start sql **************************************');
  Config.sqlLogger.debug('sql: %s', sql);
  const { sqlQm, parametersUsed, values } = namedParameters2QuestionMarks(sql, parameters);

  const valuesMapped = values.map((v) => (v === undefined || v === null ? '' : v));
  Config.sqlLogger.info('sql-parametersUsed: ', JSON.stringify(parametersUsed, undefined, ' '));
  return processSqlQuery(con, sqlQm, valuesMapped, maxRows);
}

export function processSqlQuery(con: Connection, sql: string, values: any[], maxRows: number): Promise<Result> {
  return new Promise((resolve) => {
    con.query(sql, values, process_result);

    function process_result(err: MysqlError | null, res?: any, fields?: FieldInfo[]) {
      const result: Result = { from: 0, hasMore: false, rowsAffected: 0 };
      result.rowsAffected = -1;
      result.from = 0;
      // result.totalCount = -1;
      result.hasMore = false;

      Config.logger.debug(sql, 'DONE');

      if (err) {
        result.exception = err.message;
        result.stack = err.stack;
        resolve(result);
        Config.logger.warn(err.message + '\nsql: ' + sql);
        resolve(result);
      } else {
        // see also https://www.w3schools.com/nodejs/nodejs_mysql_select.asp
        result.headerSql = [];
        result.header = [];
        result.types = [];
        result.table = [];
        result.rowsAffected = res.affectedRows;
        Config.logger.debug('Rows affected: %s', result.rowsAffected);
        if (fields) {
          for (const field of fields) {
            result.headerSql.push(field.name);
            result.header.push(camelCase(field.name));
            result.types.push(field.type ? field.type.toString() : '');
          }
          for (const row of res) {
            const trow = [];
            for (const head of result.headerSql) {
              trow.push(row[head]);
            }
            if (maxRows === result.table.length) {
              result.hasMore = true;
              break;
            }
            result.table.push(trow);
          }
        }
        resolve(result);
      }
    }
  });
}
