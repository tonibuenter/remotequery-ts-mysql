/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types */
/* tslint:disable:no-string-literal */
/* tslint:disable:one-variable-per-declaration */
/* tslint:disable:only-arrow-functions */
/* tslint:disable:no-explicit-any */

import { createPool, FieldInfo, MysqlError, PoolConfig, PoolConnection } from 'mysql';

import * as camelCase from 'camelCase';
import { namedParameters2QuestionMarks, toArr } from './utils';
import {
  Context,
  Driver,
  ExceptionResult,
  exceptionResult,
  Logger,
  noopLogger,
  PRecord,
  Result,
  ServiceEntry,
  toFirst,
  toSRecord
} from 'remotequery-ts-common';

let _camelCaseConvertion = true;
export const setCamelCaseConversion = (b: boolean) => (_camelCaseConvertion = b);

export interface MySqlDriverExtension extends Driver<PoolConnection> {
  setServiceEntrySql: (sql: string) => void;
  setSqlLogger: (logger: Logger) => void;
  setLogger: (logger: Logger) => void;
  openTransactions: () => string[];
}

export class MySqlDriver implements MySqlDriverExtension {
  private readonly pool;
  private logger: Logger = noopLogger;
  private sqlLogger = noopLogger;
  private serviceEntrySql = '';
  private readonly txConnections: Record<string, PoolConnection> = {};
  private txCounter = 0;

  constructor(stringOrPoolConfig: string | PoolConfig) {
    this.pool = createPool(stringOrPoolConfig);
  }

  public async getServiceEntry(serviceId: string): Promise<ServiceEntry | ExceptionResult> {
    const result = await this.processSql(this.serviceEntrySql, { serviceId });
    const raw = toFirst(result);
    if (!raw) {
      const msg = `No service entry found for ${serviceId}`;
      this.logger.warn(msg);
      return exceptionResult(msg);
    }

    return {
      serviceId: raw.serviceId || 'notfound',
      roles: toArr(raw.roles),
      statements: raw.statements || '',
      tags: new Set(toArr(raw.tags))
    };
  }

  public async destroy() {
    for (const txId of Object.keys(this.txConnections)) {
      try {
        await this.rollbackTransaction(txId);
      } catch (e) {
        this.logger.warn(`Could not rollback ${txId} while destroying MySqlDriver!`);
      }
    }

    if (this.pool) {
      this.pool.end(() => this.logger.info('Pool ended.'));
    }
  }

  public setServiceEntrySql(sql: string) {
    this.serviceEntrySql = sql;
  }

  public setSqlLogger(logger: Logger) {
    this.sqlLogger = logger;
  }

  public setLogger(logger: Logger) {
    this.logger = logger;
  }

  public getConnection(): Promise<PoolConnection | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.pool) {
        reject('Pool not initialized');
      } else {
        this.pool.getConnection((err: MysqlError | null, conn: PoolConnection) => {
          if (err) {
            reject(err);
            return;
          }
          if (conn) {
            this.logger.debug('getConnection DONE');
          }
          resolve(conn);
        });
      }
    });
  }

  public returnConnection(con: PoolConnection): void {
    try {
      if (this.pool) {
        con.release();
      }
    } catch (e) {
      this.logger.error(`returnConnection -> ${e}`);
    }
    this.logger.debug(`returnConnection DONE`);
  }

  public async startTransaction(): Promise<string> {
    const txId = `txCon${this.txCounter++}`;
    const con = await this.getConnection();
    if (con) {
      this.txConnections[txId] = con;
      await this.processSqlQuery(con, 'BEGIN', null, 0);
      return txId;
    }
    throw new Error('Could not get a connection to start a transaction!');
  }

  public openTransactions(): string[] {
    return Object.keys(this.txConnections);
  }

  public async commitTransaction(txId: string): Promise<void> {
    const con = this.txConnections[txId];
    if (con) {
      await this.processSqlQuery(con, 'COMMIT', null, 0);
      this.returnConnection(con);
      delete this.txConnections[txId];
      return;
    }
    throw new Error(`Tried to COMMIT. No connection available for ${txId}!`);
  }

  public async rollbackTransaction(txId: string): Promise<void> {
    const con = this.txConnections[txId];
    if (con) {
      await this.processSqlQuery(con, 'ROLLBACK', null, 0);
      this.returnConnection(con);
      delete this.txConnections[txId];
      return;
    }
    throw new Error(`Tried to ROLLBACK. No connection available for ${txId}!`);
  }

  public async processSql(sql: string, parameters?: PRecord, context?: Partial<Context>): Promise<Result> {
    let con, result: Result;
    const txCon = this.txConnections[context?.txId || ''];
    try {
      con = txCon || (await this.getConnection());
      if (con) {
        result = await this.processSql_con(con, sql, parameters, context?.maxRows);
      } else {
        result = { exception: 'No connection received!' };
      }
    } catch (err: any) {
      this.logger.info(err.stack);
      result = { exception: err.message, stack: err.stack };
    } finally {
      if (con && !txCon) {
        this.returnConnection(con);
      }
    }
    return result;
  }

  public async processSqlDirect(sql: string, values: any = null, maxRows = 10000): Promise<Result> {
    let con: PoolConnection | undefined, result;
    try {
      con = await this.getConnection();
      if (con) {
        result = await this.processSqlQuery(con, sql, values, maxRows);
      } else {
        const exception = 'No connection received!';
        this.logger.warn(exception);
        result = { exception };
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

  public processSql_con(con: PoolConnection, sql: string, parameters: PRecord = {}, maxRows = 10000): Promise<Result> {
    this.sqlLogger.info(`sql: ${sql}`);
    const { sqlQm, parametersUsed, values } = namedParameters2QuestionMarks(sql, toSRecord(parameters));

    const valuesMapped = values.map((v) => (v === undefined || v === null ? '' : v));
    this.sqlLogger.info(`sql-parameters-used: ${JSON.stringify(parametersUsed)}`);
    return this.processSqlQuery(con, sqlQm, valuesMapped, maxRows);
  }

  public processSqlQuery(con: PoolConnection, sql: string, values: any, maxRows: number): Promise<Result> {
    return promiseQuery(con, sql, values, maxRows, this.logger);
  }
}

function promiseQuery(con: PoolConnection, sql: string, values: any, maxRows: number, logger: Logger): Promise<Result> {
  return new Promise((resolve) => {
    con.query(sql, values, (err: MysqlError | null, res?: any, fields?: FieldInfo[]) => {
      const result: Result = { from: 0, hasMore: false, rowsAffected: -1 };
      result.from = 0;
      result.hasMore = false;
      logger.debug(`${sql} DONE`);
      if (err) {
        result.exception = err.message;
        result.stack = err.stack;
        logger.warn(`${err.message}\n sql: ${sql} `);
        resolve(result);
      } else {
        fillResult(result, res, fields, maxRows, logger);
      }
      resolve(result);
    });
  });
}

function fillResult(result: Result, res: any, fields: FieldInfo[] | undefined, maxRows: number, logger: Logger) {
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
      result.header.push(_camelCaseConvertion ? camelCase(field.name) : field.name);
      result.types.push(field.type ? field.type.toString() : '');
    }
    for (const row of res) {
      const trow = [];
      for (const head of result.headerSql) {
        trow.push((row[head] ?? '').toString());
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
