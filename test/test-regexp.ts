// noinspection SqlResolve
/* tslint:disable:no-console */

import { assert, expect } from 'chai';
import { namedParameters2QuestionMarks } from '../src/utils';
import { consoleLogger } from 'remotequery-ts-common';

type Test2 = {
  sql: string;
  parameters: Record<string, string | string[]>;
  sqlQm: string;
  values: string[];
  parametersUsed: Record<string, string | string[]>;
};

const tests2: Test2[] = [
  {
    sql: 'select :NAME from T_USER where USER_TID = :$USERID and VALUE in (:vs[])',
    parameters: { birthday: '1992-09-12', $USERID: '1234', vs: [1, 2, 3].join(' , ') },
    sqlQm: 'select ? from T_USER where USER_TID = ? and VALUE in (?,?,?)',
    values: ['', '1234', '1', '2', '3'],
    parametersUsed: { NAME: '', $USERID: '1234', vs0: '1', vs1: '2', vs2: '3' }
  },
  {
    // trimmed, [], white space,
    sql: 'select * from T_USER where VALUE = :vs[]',
    parameters: { NAME: '  sepp ', $USERID: '1234', v: 'unused-param' },
    sqlQm: 'select * from T_USER where VALUE = ?',
    values: [''],
    parametersUsed: { vs0: '' }
  },

  {
    sql: 'select * from T_USER where USER_TID = :u and USER_TID = :list',
    parameters: { u: 'hello!!', list: '23,212,132,2,aa'.split(',') },
    sqlQm: 'select * from T_USER where USER_TID = ? and USER_TID = ?,?,?,?,?',
    values: ['hello!!', '23', '212', '132', '2', 'aa'],
    parametersUsed: {
      u: 'hello!!',
      list0: '23',
      list1: '212',
      list2: '132',
      list3: '2',
      list4: 'aa'
    }
  },
  {
    sql: 'select :NAME from T_USER where USER_TID = :$USERID and VALUE = :v',
    parameters: { NAME: 'sepp', $USERID: '1234', v: 'sdfne?kj,sdfkI"' },
    sqlQm: 'select ? from T_USER where USER_TID = ? and VALUE = ?',
    values: ['sepp', '1234', 'sdfne?kj,sdfkI"'],
    parametersUsed: { NAME: 'sepp', $USERID: '1234', v: 'sdfne?kj,sdfkI"' }
  },
  {
    sql: 'select :NAME from T_USER where USER_TID = :$USERID and VALUE = :vs',
    parameters: { NAME: 'sepp', $USERID: '1234', vs: ['1', '2', '3'] },
    sqlQm: 'select ? from T_USER where USER_TID = ? and VALUE = ?,?,?',
    values: ['sepp', '1234', '1', '2', '3'],
    parametersUsed: { NAME: 'sepp', $USERID: '1234', vs0: '1', vs1: '2', vs2: '3' }
  },
  {
    // trimmed, [], white space,
    sql: 'select :NAME from T_USER where USER_TID = :$USERID and VALUE = :vs[]',
    parameters: { NAME: '  sepp ', $USERID: '1234', vs: [1, 2, 3].join('   , '), v: 'unused-param' },
    sqlQm: 'select ? from T_USER where USER_TID = ? and VALUE = ?,?,?',
    values: ['sepp', '1234', '1', '2', '3'],
    parametersUsed: { NAME: 'sepp', $USERID: '1234', vs0: '1', vs1: '2', vs2: '3' }
  },
  {
    // trimmed, [], white space,
    sql: 'select NAME from T_USER where $USER_TID = 123',
    parameters: { NAME: '  sepp ', $USERID: '1234', vs: [1, 2, 3].join('   , '), v: 'unused-param' },
    sqlQm: 'select NAME from T_USER where $USER_TID = 123',
    values: [],
    parametersUsed: {}
  },

  {
    sql: "select * from T_USER where NAME = ':hans:' and USER_TID=:uid",
    parameters: { uid: '123' },
    sqlQm: "select * from T_USER where NAME = ':hans:' and USER_TID=?",
    values: ['123'],
    parametersUsed: { uid: '123' }
  },
  {
    sql: "select * from T_USER where NAME = ':hans[]:hans::' and USER_TID=:uid[]",
    parameters: { uid: '123' },
    sqlQm: "select * from T_USER where NAME = ':hans[]:hans::' and USER_TID=?",
    values: ['123'],
    parametersUsed: { uid0: '123' }
  }
];

describe('regexp', () => {
  describe('tests2', () => {
    tests2.forEach((test, index) => {
      it('test2-' + index, () => {
        const { sql, parameters } = test;
        const { sqlQm, values, parametersUsed } = namedParameters2QuestionMarks(sql, parameters);
        assert.equal(test.sqlQm, sqlQm);
        assert.deepEqual(test.values, values);
        assert.deepEqual(test.parametersUsed, parametersUsed);
      });
    });
    it('test-log', () => {
      const sql = "select * from T_USER where NAME = ':hans:' and USER_TID=:uid";
      const { sqlQm, values, parametersUsed } = namedParameters2QuestionMarks(sql, {});
      assert.equal(sqlQm, "select * from T_USER where NAME = ':hans:' and USER_TID=?");
      expect(values).to.eql(['']);
      expect(parametersUsed).to.eql({ uid: '' });
    });
    it('test-log2', () => {
      const sql = "select * from T_USER where NAME = ':hans[]' and USER_TID=:uid";
      const { sqlQm, values, parametersUsed } = namedParameters2QuestionMarks(sql, { uid: '666' }, consoleLogger);
      assert.equal(sqlQm, "select * from T_USER where NAME = ':hans[]' and USER_TID=?");
      expect(values).to.eql(['666']);
      expect(parametersUsed).to.eql({ uid: '666' });
    });
  });
});
