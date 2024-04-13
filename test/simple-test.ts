// noinspection SqlResolve
/* tslint:disable:no-console */

import { consoleLogger, Result } from 'remotequery-ts-common';
import { expect } from 'chai';
import { getDriver } from './util-test';

describe('processSql', () => {
  const driver1 = getDriver();
  // before(() => {}); // the tests container
  it('processSql-001', async () => {
    await driver1.processSql("delete from T_APP_PROPERTIES where NAME = 'hello'");
    const r: Result = await driver1.processSql("insert into T_APP_PROPERTIES (NAME, VALUE) values ('hello', 'world')");

    expect(r?.rowsAffected).equal(1);

    const result: Result = await driver1.processSql("select * from T_APP_PROPERTIES where NAME = 'hello'");
    consoleLogger.debug(`null result: ${expect(result).to.be.not.null.toString().substring(0.22)}`);
    const len = result.table?.length;
    consoleLogger.debug(`result len: ${len}`);
    expect(len).to.be.greaterThan(0);
  });

  it('processSql-002', async () => {
    await driver1.processSql("delete from T_APP_PROPERTIES where NAME = 'hello'");
    await driver1.processSql("insert into T_APP_PROPERTIES (NAME, VALUE) values ('hello', :v)", { v: 'world' });
    const result: Result = await driver1.processSql("select * from T_APP_PROPERTIES where NAME = 'hello'");
    consoleLogger.debug(`null result: ${expect(result).to.be.not.null.toString().substring(0.22)}`);
    const len = result.table?.length;
    consoleLogger.debug(`result len: ${len}`);
    expect(len).to.be.greaterThan(0);
  });
  it('processSqlDirect-001', async () => {
    await driver1.processSqlDirect("delete from T_APP_PROPERTIES where NAME = 'hello'", [], 1);
    await driver1.processSqlDirect("insert into T_APP_PROPERTIES (NAME, VALUE) values ('hello', ?)", ['World'], 1);
    const result: Result = await driver1.processSqlDirect(
      'select * from T_APP_PROPERTIES where Name = ?',
      ['hello'],
      1
    );
    consoleLogger.debug(`null result: ${expect(result).to.be.not.null.toString().substring(0.22)}`);
    const len = result.table?.length;
    consoleLogger.debug(`result len: ${len}`);
    expect(len).to.be.greaterThan(0);
  });
});
