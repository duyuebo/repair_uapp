<template>
  <view class="placeholder-page">
    <view class="placeholder">
      <view class="placeholder__icon">
        <uni-icons type="compose" :size="36" color="#3B82F6"></uni-icons>
      </view>
      <text class="placeholder__title">报修记录</text>
      <text class="placeholder__desc">
        报修记录页面正在建设中，后续将在这里查看处理中和已完成的工单。
      </text>
    </view>

    <business-tabbar active="records" />
  </view>
</template>

<script>
export default {
  name: "RecordsPage"
};
</script>

<style scoped>
.placeholder-page {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 48rpx 56rpx calc(150rpx + constant(safe-area-inset-bottom));
  padding: 48rpx 56rpx calc(150rpx + env(safe-area-inset-bottom));
  background-color: #f5f7fa;
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 640px;
}

.placeholder__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  background-color: #eff6ff;
  border-radius: 50%;
}

.placeholder__title {
  margin-top: 32rpx;
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #1f2937;
}

.placeholder__desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.7;
  color: #9ca3af;
  text-align: center;
}
</style>
