// noinspection SqlResolve
/* tslint:disable:no-console */

import { expect } from 'chai';
import { getDriver } from './util-test';
import * as camelcase from 'camelcase';

describe('Column Name conversion', () => {
  const driver1 = getDriver();
  // before(() => {}); // the tests container
  it('processSql', async () => {
    const columns = ['ALLCAPS', 'value4you', 'SNAIL_CASE', 'camelCase'];
    const columnsCc = ['allcaps', 'value4You', 'snailCase', 'camelCase'];

    columns.forEach((c, i) => expect(camelcase(c)).equals(columnsCc[i]));
  });
});
