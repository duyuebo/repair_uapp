/**
 * 将后端返回的日期时间格式化为 YYYY-MM-DD HH:mm。
 * 直接处理字符串，避免 Date 转换带来的时区偏移。
 */
export const formatDateTime = (value?: string | null): string => {
  if (!value) return "";

  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }

  return text;
};
