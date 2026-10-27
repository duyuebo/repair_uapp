/**
 * 后端统一响应结构。
 * status：1-成功，0-失败。
 */
export interface CommonResult<T> {
  status: number;
  code: string;
  message: string;
  obj: T | null;
}

/**
 * 后端分页响应结构，仅声明前端实际使用的字段。
 */
export interface PagerResult<T> {
  list: T[];
  total: number;
  pages: number;
  pageNumber: number;
  hasNextPage: boolean;
}
