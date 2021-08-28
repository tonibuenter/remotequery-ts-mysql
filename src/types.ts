export type Result = {
  types?: string[];
  headerSql?: string[];
  header?: string[];
  table?: string[][];
  rowsAffected: number;
  exception?: string;
  from: number;
  hasMore: boolean;
  stack?: string | undefined;
};
//
// export type EmtpyResult = {};
//
// export type CondResult = Result | EmtpyResult;
//
// export type RegistryType = any;
//
// export type CommandsType = {
//   StartBlock?: any;
//   EndBlock?: any;
//   Registry?: RegistryType;
// };
