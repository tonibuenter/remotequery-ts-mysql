import { assert, expect } from 'chai';
import { getDriver } from './util-test';
import { Context, Driver, toList } from 'remotequery-ts-common';
import { User } from './types';
import { MySqlDriver } from '../src';

let USER_TID_START = -1000;
const userInsertSql = 'insert into  T_USER (USER_TID, EMAIL) values (:userTid, :email)';
const newUserTid = () => --USER_TID_START;

before(async () => {
  // tslint:disable-next-line:no-console
  console.debug('BEFORE');
  const driver = getDriver();
  await driver.processSqlDirect(
    `delete
     from T_USER
     where USER_TID < 0`,
    {}
  );
  expect(driver.openTransactions().length).equals(0);
});

describe('test-transactions', () => {
  const mySqlDriver = getDriver();

  describe('test-transactions examples', () => {
    it('no-tx', async () => {
      await runUserTests(mySqlDriver, 'none');
    });
    it('commit-1', async () => {
      await runUserTests(mySqlDriver, 'COMMIT');
    });
    it('rollback-1', async () => {
      await runUserTests(mySqlDriver, 'ROLLBACK');
    });
    it('concurrent-tx-test-1', async () => {
      await concurrentUpdateTests(mySqlDriver);
    });
  });
});

after(() => {
  // tslint:disable-next-line:no-console
  console.debug('AFTER');
  getDriver()
    .destroy()
    // tslint:disable-next-line:no-console
    .then(() => console.debug('done'));
});

async function getUserByTid(driver: Driver, userTid: string, context: Partial<Context>): Promise<User | undefined> {
  const res = await driver.processSql('select * from T_USER where USER_TID = :userTid', { userTid }, context);
  return toList<User>(res)[0];
}

async function runUserTests(driver: MySqlDriver, txMode: 'COMMIT' | 'ROLLBACK' | 'none') {
  const txId = txMode === 'none' ? '' : await driver.startTransaction();
  const context: Partial<Context> = { txId };
  const max = 20;

  const tidList: string[] = [];

  for (let i = 0; i < max; i++) {
    const userTid = newUserTid().toString();
    tidList.push(userTid);
    const r0 = await driver.processSql(
      userInsertSql,
      {
        userTid,
        email: `test-email-${userTid}`
      },
      context
    );
    assert.equal(1, r0.rowsAffected, 'result size');
  }

  switch (txMode) {
    case 'ROLLBACK':
      expect(driver.openTransactions().length).equals(1);
      await driver.rollbackTransaction(txId);
      expect(driver.openTransactions().length).equals(0);

      for (const tid of tidList) {
        const user = await getUserByTid(driver, tid, {});
        expect(user).equals(user);
      }
      break;
    case 'COMMIT':
      expect(driver.openTransactions().length).equals(1);
      await driver.commitTransaction(txId);
    default:
      expect(driver.openTransactions().length).equals(0);
      for (const tid of tidList) {
        const user = await getUserByTid(driver, tid, {});
        expect(user?.userTid.toString()).equals(tid.toString());
      }
  }
}

async function concurrentUpdateTests(driver: MySqlDriver) {
  const txId1 = await driver.startTransaction();
  const txId2 = await driver.startTransaction();
  const context1: Partial<Context> = { txId: txId1 };
  const context2: Partial<Context> = { txId: txId2 };

  expect(txId2).not.equals(txId1);

  const userTid = newUserTid().toString();

  await driver
    .processSql(
      userInsertSql,
      {
        userTid,
        email: `test-email-${userTid}-1`
      },
      context1
    )
    .then(async (r1) => {
      assert.equal(1, r1.rowsAffected, 'result size');
      await driver.commitTransaction(txId1);
    });
  driver
    .processSql(
      userInsertSql,
      {
        userTid,
        email: `test-email-${userTid}-2`
      },
      context2
    )
    .then(async (r2) => {
      assert.equal(1, r2.rowsAffected, 'result size');
      await driver.commitTransaction(txId2);
    });
}
