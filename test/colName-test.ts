// noinspection SqlResolve
/* tslint:disable:no-console */

import { Result } from 'remotequery-ts-common';
import { expect } from 'chai';
import { getDriver } from './util-test';
import { setCamelCaseConversion } from '../src/MySqlDriver';

describe('Column Name conversion', () => {
  const driver1 = getDriver();
  // before(() => {}); // the tests container
  it('processSql without camel case', async () => {
    setCamelCaseConversion(false);
    const r: Result = await driver1.processSql('select * from test.COL_NAME');
    expect(r.header?.[3]).equal('value4you');
    expect(r.header?.[2]).equal('ALLCAPS');
    expect(r.header?.[1]).equal('camelCase');
    expect(r.header?.[0]).equal('SNAIL_CASE');
    setCamelCaseConversion(true);
  });
  it('processSql with camel case', async () => {
    const r: Result = await driver1.processSql('select * from test.COL_NAME');
    expect(r.header?.[3]).equal('value4You');
    expect(r.header?.[2]).equal('allcaps');
    expect(r.header?.[1]).equal('camelCase');
    expect(r.header?.[0]).equal('snailCase');
  });
});
