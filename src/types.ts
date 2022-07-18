import { Pool, PoolConnection } from 'mysql';
import { Logger } from './remotequery-types';

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
