/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */

import { createPool, FieldInfo, MysqlError, PoolConnection } from 'mysql';

import * as camelCase from 'camelCase';
import { consoleLogger, Result } from 'remotequery-ts';
import { InitProps, MySqlDriver } from './types';
import { namedParameters2QuestionMarks } from './remotequery-mysql';

export const newInstance = ({ user, password, host, database }: InitProps): MySqlDriver => {
  const pool = createPool({
    user,
    password,
    host,
    database
  });

  //
  // PROCESS SQL CON PLUGIN - for mysql
  //

  const me: MySqlDriver = {
    getConnection,
    returnConnection,
    processSql,
    processSqlDirect,
    logger: consoleLogger,
    sqlLogger: consoleLogger
  };
  return me;

  function getConnection(): Promise<PoolConnection | undefined> {
    return new Promise((resolve, reject) => {
      if (!pool) {
        reject('Pool not initialized');
      } else {
        pool.getConnection(function (err: MysqlError | null, conn: PoolConnection) {
          if (err) {
            reject(err);
            return;
          }
          if (conn) {
            me.logger.debug('getConnection DONE');
          }
          resolve(conn);
        });
      }
    });
  }

  function returnConnection(con: PoolConnection) {
    try {
      if (pool) {
        con.release();
      }
    } catch (e) {
      me.logger.error(`returnConnection -> ${e}`);
    }
    me.logger.debug(`returnConnection DONE`);
  }

  async function processSql(sql: string, parameters?: Record<string, string>, context?: any): Promise<Result> {
    let con, result: Result;
    try {
      con = await getConnection();
      if (con) {
        result = await processSql_con(con, sql, parameters, context?.maxRows);
      } else {
        result = { exception: 'No connection received!' };
      }
    } catch (err: any) {
      me.logger.info(err.stack);
      result = { exception: err.message, stack: err.stack, hasMore: false };
    } finally {
      if (con) {
        returnConnection(con);
      }
    }
    return result;
  }

  async function processSqlDirect(sql: string, values: any, maxRows: number): Promise<Result> {
    let con: PoolConnection | undefined, result;
    try {
      con = await getConnection();
      if (con) {
        result = await processSqlQuery(con, sql, values, maxRows);
      } else {
        result = { exception: 'No connection received!' };
      }
    } catch (err: any) {
      me.logger.error(err.stack);
      result = { exception: err.message, stack: err.stack };
    } finally {
      if (con) {
        returnConnection(con);
      }
    }
    return result;
  }

  function processSql_con(con: PoolConnection, sql: string, parameters = {}, maxRows = 10000): Promise<Result> {
    me.sqlLogger.debug('start sql **************************************');
    me.sqlLogger.debug(`sql: ${sql}`);
    const { sqlQm, parametersUsed, values } = namedParameters2QuestionMarks(sql, parameters);

    const valuesMapped = values.map((v) => (v === undefined || v === null ? '' : v));
    me.sqlLogger.info(`sql-parametersUsed: ${JSON.stringify(parametersUsed, undefined, ' ')}`);
    return processSqlQuery(con, sqlQm, valuesMapped, maxRows);
  }

  function processSqlQuery(con: PoolConnection, sql: string, values: any[], maxRows: number): Promise<Result> {
    return new Promise((resolve) => {
      con.query(sql, values, process_result);

      function process_result(err: MysqlError | null, res?: any, fields?: FieldInfo[]) {
        const result: Result = { from: 0, hasMore: false, rowsAffected: 0 };
        result.rowsAffected = -1;
        result.from = 0;
        // result.totalCount = -1;
        result.hasMore = false;

        me.logger.debug(`${sql} DONE`);

        if (err) {
          result.exception = err.message;
          result.stack = err.stack;
          resolve(result);
          me.logger.warn(`${err.message}\nsql: ${sql} `);
          resolve(result);
        } else {
          // see also https://www.w3schools.com/nodejs/nodejs_mysql_select.asp
          result.headerSql = [];
          result.header = [];
          result.types = [];
          result.table = [];
          result.rowsAffected = res.affectedRows;
          me.logger.debug(`Rows affected: ${result.rowsAffected}`);
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
};
