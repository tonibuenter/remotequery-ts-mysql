# Welcome to RemoteQuery MySql Driver for Typescript

The MySql driver is meant to be used with RemoteQuery.


Example function for creating an instance of MySqlDriver:

```TypeScript

import { MySqlDriver, consoleLogger, Context, Driver, Request, Result } from 'remotequery-ts-mysql';

function newMySqlDriver(): Driver {

  const mySqlDriver: MySqlDriver = new MySqlDriver({
    database: 'test'
    host: 'localhost',
    user: 'foo',
    password: 'bar',
  });

  // set logger...
  mySqlDriver.setLogger(consoleLogger);
  mySqlDriver.setSqlLogger(consoleLogger);

  // set query for creating service entries 
  // (snail case db columns will be converted 
  // to camel case fields: service_id -> serviceId)
  mySqlDriver.setServiceEntrySql(
    'select service_id, statements, tags, roles from t_services where service_id = :serviceId'
  );

  return mySqlDriver;
}```

