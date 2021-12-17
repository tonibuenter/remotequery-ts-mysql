import {
  Config,
  init,
  isalnum,
  namedParameters2QuestionMarks,
  processSql,
  processSqlDirect,
  processSqlQuery
} from './remotequery-mysql';

import type { ConfigType, InitProps, MySqlDriver } from './types';
import { newInstance } from './MySqlDriver';

export {
  ConfigType,
  processSql,
  processSqlDirect,
  namedParameters2QuestionMarks,
  processSqlQuery,
  init,
  isalnum,
  Config,
  InitProps,
  MySqlDriver,
  newInstance
};
