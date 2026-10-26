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
