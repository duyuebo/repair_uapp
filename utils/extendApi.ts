export const toast = ({
  title = "数据加载中...",
  icon = "none",
  duration = 1500,
  mask = true
} = {}) => {
  uni.showToast({
    title,
    icon,
    mask,
    duration
  });
};

export const modal = (options = {}) => {
  return new Promise((resolve) => {
    const defaultOpt = {
      title: "提示",
      content: "您确定执行该操作吗?",
      confirmColor: "#f3514f"
    };
    const opts = Object.assign({}, defaultOpt, options);
    uni.showModal({
      ...opts,
      success: ({ confirm }) => {
        resolve(Boolean(confirm));
      },
      // showModal 失败（例如已有弹窗）时也要结束 Promise，避免调用方永久挂起
      fail: () => {
        resolve(false);
      }
    });
  });
};