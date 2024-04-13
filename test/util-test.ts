import { MySqlDriver } from '../src';
import { consoleLogger, Driver } from 'remotequery-ts-common';

let driver: MySqlDriver;

export const getDriver = (): MySqlDriver => (driver = driver || newMySqlDriver());

function newMySqlDriver(): Driver {
  const mySqlDriver: MySqlDriver = new MySqlDriver({
    user: 'foo',
    password: 'bar',
    host: 'localhost',
    database: 'test'
  });

  // set logger...
  mySqlDriver.setLogger(consoleLogger);
  mySqlDriver.setSqlLogger(consoleLogger);

  // set query for creating service entries (snail case db columns will be converted to camel case fields: service_id -> serviceId)
  mySqlDriver.setServiceEntrySql(
    'select service_id, statements, tags, roles from t_services where service_id = :serviceId'
  );

  return mySqlDriver;
}
