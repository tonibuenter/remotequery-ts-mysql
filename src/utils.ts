import { Logger, Simple, trim } from 'remotequery-ts-common';

export function toArr(ro: string | undefined): string[] {
  return (ro ? ro.split(/\s*,\s*/) : []).map((s) => trim(s));
}

export function namedParameters2QuestionMarks(
  sql: string,
  parameters: Record<string, Simple | Simple[]>,
  logger?: Logger
): { sqlQm: string; parametersUsed: Record<string, Simple>; values: Simple[] } {
  let inquote = false;
  const parametersUsed: Record<string, Simple> = {};
  const values: Simple[] = [];
  const sqlQm = sql.replace(/:([0-9a-zA-Z$_]+)(\[])?|(')/g, (mtch, key, brck, quote) => {
    if (logger) {
      logger.debug(`${mtch}, ${key}, ${brck}, ${quote}`);
    }
    if (quote) {
      inquote = !inquote;
      return mtch;
    }
    if (inquote) {
      return mtch;
    }
    let p = parameters[key];
    p = typeof p === 'string' ? p.trim() : typeof p === 'number' ? p : p === null || p === undefined ? '' : p;
    let qms = '';
    if (brck === '[]' || Array.isArray(p)) {
      const vArray: Simple[] = Array.isArray(p) ? p : typeof p === 'string' ? p.split(/\s*,\s*/) : [p];
      vArray.forEach((v, index) => {
        parametersUsed[key + index] = v;
        values.push(v);
        if (index !== 0) {
          qms += ',';
        }
        qms += '?';
      });
    } else {
      parametersUsed[key] = p;
      values.push(p);
      qms += '?';
    }
    return qms;
  });
  return { sqlQm, parametersUsed, values };
}
