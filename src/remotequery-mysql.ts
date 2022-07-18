/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */

import { createPool, FieldInfo, MysqlError, Pool, PoolConnection } from 'mysql';

import camelCase from 'camelCase';
import { ConfigType, InitProps } from './types';
import { Logger, ProcessSql, Result, Simple } from './remotequery-types';

export const consoleLogger: Logger = {
  // tslint:disable-next-line:no-console
  debug: (msg: string) => console.debug(msg),
  // tslint:disable-next-line:no-console
  info: (msg: string) => console.info(msg),
  // tslint:disable-next-line:no-console
  warn: (msg: string) => console.warn(msg),
  // tslint:disable-next-line:no-console
  error: (msg: string) => console.error(msg)
};

export const Config: ConfigType = {
  user: 'unset',
  password: 'unset',
  host: 'unset',
  database: 'unset',
  logger: consoleLogger,
  sqlLogger: consoleLogger,
  getConnection: () =>
    new Promise((resolve, reject) => {
      if (!Config.pool) {
        reject('Pool not initialized');
      } else {
        Config.pool.getConnection(function (err: MysqlError | null, conn: PoolConnection) {
          if (err) {
            reject(err);
            return;
          }
          if (conn) {
            Config.logger.debug('getConnection DONE');
            resolve(conn);
          }
        });
      }
    }),
  returnConnection: (con: PoolConnection) => {
    try {
      if (Config.pool) {
        con.release();
      }
    } catch (e) {
      Config.logger.error(`returnConnection -> ${e}`);
    }
    Config.logger.debug(`returnConnection DONE`);
  }
};

export function init({ user, password, host, database }: InitProps): Pool {
  Config.user = user;
  Config.password = password;
  Config.host = host;
  Config.database = database;
  Config.pool = createPool({
    host: Config.host,
    user: Config.user,
    password: Config.password,
    database: Config.database
  });
  return Config.pool;
}

//
// PROCESS SQL CON PLUGIN - for mysql
//

export const isalnum = (ch: string) => {
  return ch.match(/^[a-z0-9]+$/i) !== null;
};
export const processSql: ProcessSql = async (
  sql: string,
  parameters?: Record<string, Simple>,
  context?: any
): Promise<Result> => {
  let con, result: Result;
  try {
    con = await Config.getConnection();
    result = await processSql_con(con, sql, parameters, context?.maxRows);
  } catch (err: any) {
    Config.logger.info(err.stack);
    result = { exception: err.message, stack: err.stack, hasMore: false };
  } finally {
    if (con) {
      Config.returnConnection(con);
    }
  }
  return result;
};

export async function processSqlDirect(sql: string, values = [], maxRows = 10000): Promise<Result> {
  let con: PoolConnection | undefined, result;
  try {
    con = await Config.getConnection();
    result = await processSqlQuery(con, sql, values || [], maxRows);
  } catch (err: any) {
    Config.logger.error(err.stack);
    result = { exception: err.message, stack: err.stack };
  } finally {
    if (con) {
      Config.returnConnection(con);
    }
  }
  return result;
}

export function namedParameters2QuestionMarks(
  sql: string,
  parameters: Record<string, string | number | string[] | number[]>,
  logger?: Logger
): { sqlQm: string; parametersUsed: any; values: any[] } {
  let inquote = false;
  const parametersUsed: any = {};
  const values: any[] = [];
  const sqlQm = sql.replace(/:([0-9a-zA-Z$_]+)(\[])?|(')/g, function (mtch, key, brck, quote) {
    if (logger) {
      logger.debug(`${mtch}, ${key}, ${brck}, ${quote}`);
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

export function processSql_con(con: PoolConnection, sql: string, parameters = {}, maxRows = 10000): Promise<Result> {
  Config.sqlLogger.debug('start sql **************************************');
  Config.sqlLogger.debug(`sql: ${sql}`);
  const { sqlQm, parametersUsed, values } = namedParameters2QuestionMarks(sql, parameters);

  const valuesMapped = values.map((v) => (v === undefined || v === null ? '' : v));
  Config.sqlLogger.info(`sql-parametersUsed: ${JSON.stringify(parametersUsed, undefined, ' ')}`);
  return processSqlQuery(con, sqlQm, valuesMapped, maxRows);
}

export function processSqlQuery(con: PoolConnection, sql: string, values: any[], maxRows: number): Promise<Result> {
  return new Promise((resolve) => {
    con.query(sql, values, process_result);

    function process_result(err: MysqlError | null, res?: any, fields?: FieldInfo[]) {
      const result: Result = { from: 0, hasMore: false, rowsAffected: 0 };
      result.rowsAffected = -1;
      result.from = 0;
      result.hasMore = false;

      Config.logger.debug(`${sql} DONE`);

      if (err) {
        result.exception = err.message;
        result.stack = err.stack;
        resolve(result);
        Config.logger.warn(`${err.message}\nsql: ${sql} `);
        resolve(result);
      } else {
        // see also https://www.w3schools.com/nodejs/nodejs_mysql_select.asp
        result.headerSql = [];
        result.header = [];
        result.types = [];
        result.table = [];
        result.rowsAffected = res.affectedRows;
        result.hasMore = false;
        Config.logger.debug(`Rows affected: ${result.rowsAffected}`);
        if (fields) {
          processingFields(maxRows, res, fields, result as any);
        }
        resolve(result);
      }
    }
  });
}

function processingFields(
  maxRows: number,
  res: any,
  fields: FieldInfo[],
  result: { headerSql: string[]; types: string[]; header: string[]; table: any[]; hasMore: boolean }
) {
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
