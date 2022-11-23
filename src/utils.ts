import { trim } from './remotequery-common';

export function toArr(ro: string | undefined): string[] {
  return (ro ? ro.split(/\s*,\s*/) : []).map((s) => trim(s));
}
