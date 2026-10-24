export const setStorage = (key, value) => {
  uni.setStorageSync(key, value);
};

export const getStorage = (key) => {
  return uni.getStorageSync(key);
};

export const removeStorage = (key) => {
  uni.removeStorageSync(key);
};

export const clearStorage = () => {
  uni.clearStorageSync();
};