<template>
  <view class="project-page">
    <view class="placeholder">
      <view class="placeholder__icon">
        <uni-icons type="home-filled" :size="32" color="#3B82F6"></uni-icons>
      </view>
      <text class="placeholder__title">项目选择页待实现</text>
      <text class="placeholder__desc">登录流程已跑通，项目卡片将在后续版本接入</text>
      <button
        class="placeholder__btn"
        hover-class="placeholder__btn--pressed"
        :hover-stay-time="80"
        @tap="backToLogin"
      >
        返回登录
      </button>
    </view>
  </view>
</template>

<script>
export default {
  methods: {
    backToLogin() {
      uni.reLaunch({ url: "/pages/login/login" });
    }
  }
};
</script>

<style scoped>
.project-page {
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 120rpx 56rpx calc(48rpx + constant(safe-area-inset-bottom));
  padding: 120rpx 56rpx calc(48rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
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
  border-radius: 50%;
  background-color: #eff6ff;
}

.placeholder__title {
  margin-top: 36rpx;
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #1f2937;
}

.placeholder__desc {
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #9ca3af;
  text-align: center;
}

.placeholder__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 320rpx;
  height: 80rpx;
  margin-top: 56rpx;
  padding: 0;
  font-size: 28rpx;
  line-height: 1;
  color: #3b82f6;
  background-color: #ffffff;
  border: 2rpx solid #dbeafe;
  border-radius: 40rpx;
}

.placeholder__btn--pressed {
  background-color: #f5f9ff;
}
</style>

<style>
/* 微信小程序 button 默认自带 ::after 边框，使用全局选择器确保重置生效 */
.placeholder__btn::after {
  border: none;
}
</style>
