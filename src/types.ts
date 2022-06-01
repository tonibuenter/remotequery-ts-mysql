import { Logger, ProcessSql, Result } from 'remotequery-ts';
import { Pool, PoolConnection } from 'mysql';

export type InitProps = { user: string; password: string; host: string; database: string };
export type ConfigType = {
  user: string;
  password: string;
  host: string;
  database: string;
  sqlLogger: Logger;
  logger: Logger;
  pool?: Pool;
  getConnection: () => Promise<PoolConnection>;
  returnConnection: (con: PoolConnection) => void;
};

export interface RqDriver {
  getConnection: () => Promise<any>;
  returnConnection: (connection: any) => void; // (con: PoolConnection) => void;
  processSql: ProcessSql;
  processSqlDirect: (sql: string, values: any, maxRows: number) => Promise<Result>;
  logger: Logger;
  sqlLogger: Logger;
}
