<template>
  <view class="business-tabbar">
    <view
      v-for="item in tabs"
      :key="item.key"
      class="business-tabbar__item"
      :class="{ 'business-tabbar__item--active': item.key === active }"
      hover-class="business-tabbar__item--pressed"
      :hover-stay-time="60"
      @tap="switchTab(item)"
    >
      <uni-icons
        :type="item.key === active ? item.activeIcon : item.icon"
        :size="23"
        :color="item.key === active ? '#3B82F6' : '#8A94A6'"
      ></uni-icons>
      <text class="business-tabbar__label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script>
const TAB_ROUTES = {
  repair: "/pages/repair/repair",
  records: "/pages/records/records",
  profile: "/pages/profile/profile"
};

export default {
  name: "BusinessTabbar",
  props: {
    active: {
      type: String,
      default: "repair"
    }
  },
  data() {
    return {
      tabs: [
        {
          key: "repair",
          label: "我要报修",
          icon: "home",
          activeIcon: "home-filled"
        },
        {
          key: "records",
          label: "报修记录",
          icon: "compose",
          activeIcon: "compose"
        },
        {
          key: "profile",
          label: "我的",
          icon: "person",
          activeIcon: "person-filled"
        }
      ]
    };
  },
  methods: {
    switchTab(item) {
      if (item.key === this.active) return;
      uni.reLaunch({
        url: TAB_ROUTES[item.key]
      });
    }
  }
};
</script>

<style scoped>
.business-tabbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 99;
  display: flex;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #ffffff;
  border-top: 2rpx solid #eef0f3;
}

.business-tabbar__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 104rpx;
  color: #8a94a6;
}

.business-tabbar__item--active {
  color: #3b82f6;
}

.business-tabbar__item--pressed {
  opacity: 0.72;
}

.business-tabbar__label {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.2;
  color: inherit;
}
</style>
