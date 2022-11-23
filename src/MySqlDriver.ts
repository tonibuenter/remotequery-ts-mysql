/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */

import { createPool, FieldInfo, MysqlError, PoolConfig, PoolConnection } from 'mysql';

import * as camelCase from 'camelCase';
import { consoleLogger, namedParameters2QuestionMarks } from './remotequery-mysql';
import {
  Driver,
  ExceptionResult,
  exceptionResult,
  Logger,
  Result,
  ServiceEntry,
  Simple,
  toFirst
} from './remotequery-common';
import { toArr } from './utils';

export class MySqlDriver implements Driver {
  public pool;
  public logger: Logger = consoleLogger;
  public sqlLogger = consoleLogger;
  public serviceEntrySql = '';

  public setServiceEntrySql(sql: string) {
    this.serviceEntrySql = sql;
  }

  constructor(stringOrPoolConfig: string | PoolConfig) {
    this.pool = createPool(stringOrPoolConfig);
  }

  public async getServiceEntry(serviceId: string): Promise<ServiceEntry | ExceptionResult> {
    const result = await this.processSql(this.serviceEntrySql, { serviceId });
    const raw = toFirst(result);
    if (!raw) {
      return exceptionResult(`No service entry found for ${serviceId}`);
    }

    return {
      serviceId: raw.serviceId || 'notfound',
      roles: toArr(raw.roles),
      statements: raw.statements || '',
      tags: new Set(toArr(raw.tags))
    };
  }

  public getConnection(): Promise<PoolConnection | undefined> {
    const logger = this.logger;
    return new Promise((resolve, reject) => {
      if (!this.pool) {
        reject('Pool not initialized');
      } else {
        this.pool.getConnection(function (err: MysqlError | null, conn: PoolConnection) {
          if (err) {
            reject(err);
            return;
          }
          if (conn) {
            logger.debug('getConnection DONE');
          }
          resolve(conn);
        });
      }
    });
  }

  public returnConnection(con: PoolConnection) {
    try {
      if (this.pool) {
        con.release();
      }
    } catch (e) {
      this.logger.error(`returnConnection -> ${e}`);
    }
    this.logger.debug(`returnConnection DONE`);
  }

  public async processSql(sql: string, parameters?: Record<string, Simple>, context?: any): Promise<Result> {
    let con, result: Result;
    try {
      con = await this.getConnection();
      if (con) {
        result = await this.processSql_con(con, sql, parameters, context?.maxRows);
      } else {
        result = { exception: 'No connection received!' };
      }
    } catch (err: any) {
      this.logger.info(err.stack);
      result = { exception: err.message, stack: err.stack, hasMore: false };
    } finally {
      if (con) {
        this.returnConnection(con);
      }
    }
    return result;
  }

  public async processSqlDirect(sql: string, values: any, maxRows: number): Promise<Result> {
    let con: PoolConnection | undefined, result;
    try {
      con = await this.getConnection();
      if (con) {
        result = await this.processSqlQuery(con, sql, values, maxRows);
      } else {
        result = { exception: 'No connection received!' };
      }
    } catch (err: any) {
      this.logger.error(err.stack);
      result = { exception: err.message, stack: err.stack };
    } finally {
      if (con) {
        this.returnConnection(con);
      }
    }
    return result;
  }

  public processSql_con(con: PoolConnection, sql: string, parameters = {}, maxRows = 10000): Promise<Result> {
    this.sqlLogger.info(`sql: ${sql}`);
    const { sqlQm, parametersUsed, values } = namedParameters2QuestionMarks(sql, parameters);

    const valuesMapped = values.map((v) => (v === undefined || v === null ? '' : v));
    this.sqlLogger.info(`sql-parameters-used: ${JSON.stringify(parametersUsed)}`);
    return this.processSqlQuery(con, sqlQm, valuesMapped, maxRows);
  }

  public processSqlQuery(con: PoolConnection, sql: string, values: any[], maxRows: number): Promise<Result> {
    const logger = this.logger;
    return new Promise((resolve) => {
      con.query(sql, values, processResult);

      function processResult(err: MysqlError | null, res?: any, fields?: FieldInfo[]) {
        const result: Result = { from: 0, hasMore: false, rowsAffected: -1 };
        result.from = 0;
        result.hasMore = false;
        logger.debug(`${sql} DONE`);
        if (err) {
          result.exception = err.message;
          result.stack = err.stack;
          logger.warn(`${err.message}\nsql: ${sql} `);
          resolve(result);
        } else {
          buildResult(result, res, fields, maxRows, logger);
        }
        resolve(result);
      }
    });
  }
}

function buildResult(result: Result, res: any, fields: FieldInfo[] | undefined, maxRows: number, logger: Logger) {
  // see also https://www.w3schools.com/nodejs/nodejs_mysql_select.asp
  result.headerSql = [];
  result.header = [];
  result.types = [];
  result.table = [];
  result.rowsAffected = res?.affectedRows || -1;

  logger.info(`result-rows-affected: ${result.rowsAffected}`);
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
}

export default MySqlDriver;
