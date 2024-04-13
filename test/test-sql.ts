import { assert } from 'chai';
import { getDriver } from './util-test';

before(async () => {
  await getDriver().processSqlDirect('delete from T_USER where USER_TID>-1000000', {});
});

describe('sql-stuff', () => {
  const driver1 = getDriver();

  describe('test1', () => {
    it('test-processSqlDirect', async () => {
      let r = await driver1.processSqlDirect('insert into T_USER (USER_TID, NAME) values (1234, ?)', ['beta'] as never);
      assert.equal(r.rowsAffected, 1, 'Insert beta');
      for (let i = 0; i < 2; i++) {
        const r0 = await driver1.processSqlDirect('select * from T_USER where NAME = ?', ['beta'] as never);
        assert.equal(r0.table?.length, 1, 'Select beta');
      }
      r = await driver1.processSqlDirect('delete from T_USER where USER_TID = ?', [1234] as never);
      assert.equal(r.rowsAffected, 1, 'Delete beta');
    });

    it('processSqlDirect insert/delete T_USER', async () => {
      const max = 12;
      await driver1.processSqlDirect('delete from T_USER where USER_TID < 0 ');
      for (let i = 0; i < max; i++) {
        const r0 = await driver1.processSqlDirect('insert into  T_USER (USER_TID, EMAIL) values (?,?)', [
          -2 * (i + 1),
          'test-email' + i
        ] as never);
        assert.equal(1, r0.rowsAffected, 'result size');
      }
      assert.equal(
        max,
        (await driver1.processSqlDirect('delete from T_USER where USER_TID < 0 ')).rowsAffected,
        'size of deletion'
      );
    });

    it('processSql insert/delete T_USER', async () => {
      const max = 12;
      for (let i = 0; i < max; i++) {
        const r0 = await driver1.processSql('insert into  T_USER (USER_TID, EMAIL) values (:userTid, :email)', {
          userTid: (-2 * (i + 1)).toString(),
          email: 'test-email' + i
        });
        assert.equal(1, r0.rowsAffected, 'result size');
      }
      assert.equal(
        max,
        (await driver1.processSqlDirect('delete from T_USER where USER_TID < 0 ')).rowsAffected,
        'size of deletion'
      );
    });

    it('processSqlDirect bulk insert/delete T_USER', async () => {
      const max = 12;
      const valueList = new Array(12).fill(1).map((_, i) => [-2 * (i + 1), 'test-email' + i]);

      const r0 = await driver1.processSqlDirect('insert into  T_USER (USER_TID, EMAIL) values ?', [valueList] as never);
      assert.equal(r0.rowsAffected, max, 'result size');

      assert.equal(
        max,
        (await driver1.processSqlDirect('delete from T_USER where USER_TID < 0 ')).rowsAffected,
        'size of deletion'
      );
    });
  });
});

after(() => {
  getDriver()
    .destroy()
    // tslint:disable-next-line:no-console
    .then(() => console.debug('done'));
});
