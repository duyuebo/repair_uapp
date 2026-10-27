<template>
  <view class="records-page">
    <view class="records-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="records-tab"
        :class="{ 'records-tab--active': tab.key === activeGroup }"
        hover-class="records-tab--pressed"
        :hover-stay-time="60"
        @tap="switchGroup(tab.key)"
      >
        <text class="records-tab__label">{{ tab.label }}</text>
        <text
          v-if="groups[tab.key].loaded"
          class="records-tab__count"
        >({{ groups[tab.key].total }})</text>
      </view>
    </view>

    <scroll-view
      :key="activeGroup"
      class="records-scroll"
      scroll-y
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      refresher-background="#F5F7FA"
      refresher-default-style="black"
      :lower-threshold="80"
      @refresherrefresh="handleRefresh"
      @scrolltolower="handleLoadMore"
    >
      <view class="records-list">
        <template v-if="activeState.items.length">
          <view
            v-for="(item, index) in activeState.items"
            :key="item.id || item.orderNo || index"
            class="record-card"
            hover-class="record-card--pressed"
            :hover-stay-time="60"
            @tap="openDetail(item)"
          >
            <view class="record-card__head">
              <text class="record-card__order">工单号：{{ item.orderNo || "—" }}</text>
              <text
                class="record-card__status"
                :class="statusClass(item.status)"
              >（{{ statusText(item) }}）</text>
            </view>

            <view class="record-card__divider"></view>

            <view class="record-card__row">
              <text class="record-card__label">故障简述：</text>
              <text class="record-card__value record-card__value--clamp">{{ item.faultDescription || "—" }}</text>
            </view>

            <view class="record-card__row">
              <text class="record-card__label">报修时间：</text>
              <text class="record-card__value">{{ formatDateTime(item.dtCreate) || "—" }}</text>
            </view>
          </view>

          <view v-if="activeState.loadingMore" class="records-footer">
            <view class="records-footer__spin">
              <uni-icons
                type="spinner-cycle"
                :size="18"
                color="#9CA3AF"
              ></uni-icons>
            </view>
            <text class="records-footer__text">加载中...</text>
          </view>
        </template>

        <view v-else-if="activeState.error" class="records-state">
          <view class="records-state__icon">
            <uni-icons type="info" :size="38" color="#C7CDD6"></uni-icons>
          </view>
          <text class="records-state__text">{{ activeState.errorMessage || "加载失败，请稍后重试" }}</text>
          <view
            class="records-state__retry"
            hover-class="records-state__retry--pressed"
            :hover-stay-time="60"
            @tap="retryActive"
          >
            <text>重新加载</text>
          </view>
        </view>

        <view
          v-else-if="activeState.loading || !activeState.loaded"
          class="records-state"
        >
          <view class="records-state__spin">
            <uni-icons
              type="spinner-cycle"
              :size="32"
              color="#3B82F6"
            ></uni-icons>
          </view>
          <text class="records-state__text">加载中...</text>
        </view>

        <view v-else class="records-state">
          <view class="records-state__icon">
            <uni-icons type="compose" :size="40" color="#C7CDD6"></uni-icons>
          </view>
          <text class="records-state__text">{{ emptyText }}</text>
        </view>
      </view>
    </scroll-view>

    <business-tabbar active="records" />
  </view>
</template>

<script>
import { getRepairOrderList } from "@/api/repair";
import { toast } from "@/utils/extendApi";
import { formatDateTime } from "@/utils/format";
import { getStorage } from "@/utils/storage";

const LOGIN_PAGE = "/pages/login/login";
const STATUS_TEXT = {
  0: "待接单",
  1: "维修中",
  2: "已完成",
  3: "已取消"
};

const createGroupState = () => ({
  items: [],
  page: 0,
  total: 0,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  loaded: false,
  error: false,
  errorMessage: "",
  requestId: 0
});

export default {
  name: "RecordsPage",
  data() {
    return {
      activeGroup: "processing",
      refreshing: false,
      groups: {
        processing: createGroupState(),
        completed: createGroupState()
      },
      tabs: [
        { key: "processing", label: "处理中" },
        { key: "completed", label: "已完成" }
      ]
    };
  },
  computed: {
    activeState() {
      return this.groups[this.activeGroup];
    },
    emptyText() {
      return this.activeGroup === "processing"
        ? "暂无处理中的报修记录"
        : "暂无已完成的报修记录";
    }
  },
  onLoad() {
    if (!getStorage("token")) {
      uni.reLaunch({ url: LOGIN_PAGE });
      return;
    }

    this.loadInitial();
  },
  methods: {
    formatDateTime,
    openDetail(item) {
      if (!item || !item.id) {
        toast({ title: "工单信息不完整" });
        return;
      }

      uni.navigateTo({
        url: `/pages/records/detail?id=${encodeURIComponent(item.id)}`
      });
    },
    statusText(item) {
      return item.statusText || STATUS_TEXT[item.status] || "未知状态";
    },
    statusClass(status) {
      if (status === 2) return "record-card__status--completed";
      if (status === 0 || status === 1) {
        return "record-card__status--processing";
      }
      return "record-card__status--default";
    },
    async loadInitial() {
      // 同时加载两个分组，首次进入即可展示 tab 上的数量
      await Promise.all([
        this.fetchFirstPage("processing"),
        this.fetchFirstPage("completed")
      ]);
    },
    switchGroup(groupKey) {
      if (groupKey === this.activeGroup) return;
      this.activeGroup = groupKey;

      const state = this.groups[groupKey];
      if (!state.loaded && !state.loading) {
        this.fetchFirstPage(groupKey);
      }
    },
    retryActive() {
      const state = this.groups[this.activeGroup];
      if (state.loading) return;
      this.fetchFirstPage(this.activeGroup);
    },
    async fetchFirstPage(groupKey, { keepItems = false } = {}) {
      const state = this.groups[groupKey];
      const canKeepItems = keepItems && state.loaded;
      const requestId = state.requestId + 1;

      // 每次刷新使用新的 requestId，旧请求返回后直接丢弃
      state.requestId = requestId;
      state.loading = true;
      state.loadingMore = false;
      state.error = false;
      state.errorMessage = "";

      try {
        const res = await getRepairOrderList({
          statusGroup: groupKey,
          page: 1
        });
        if (requestId !== state.requestId) return;

        if (!res || res.status !== 1 || !res.obj) {
          const message = (res && res.message) || "获取报修记录失败，请稍后重试";
          if (canKeepItems) {
            toast({ title: message });
          } else {
            state.error = true;
            state.errorMessage = message;
          }
          return;
        }

        const data = res.obj;
        state.items = Array.isArray(data.list) ? data.list : [];
        state.total = Number(data.total) || 0;
        state.page = Number(data.pageNumber) || 1;
        state.hasNextPage = Boolean(data.hasNextPage);
        state.loaded = true;
      } catch (error) {
        if (requestId !== state.requestId) return;

        if (!canKeepItems) {
          state.error = true;
          state.errorMessage = "加载失败，请稍后重试";
        }
        // 网络异常已由 request 层统一提示
      } finally {
        if (requestId === state.requestId) {
          state.loading = false;
        }
      }
    },
    async handleRefresh() {
      if (this.refreshing) return;

      this.refreshing = true;
      try {
        // 两个分组一起刷新，保证 tab 上的数量同步更新
        await Promise.all([
          this.fetchFirstPage("processing", { keepItems: true }),
          this.fetchFirstPage("completed", { keepItems: true })
        ]);
      } finally {
        this.refreshing = false;
      }
    },
    async handleLoadMore() {
      const groupKey = this.activeGroup;
      const state = this.groups[groupKey];
      if (
        !state.loaded ||
        state.loading ||
        state.loadingMore ||
        this.refreshing ||
        !state.hasNextPage
      ) {
        return;
      }

      const requestId = state.requestId;
      const nextPage = state.page + 1;
      state.loadingMore = true;

      try {
        const res = await getRepairOrderList({
          statusGroup: groupKey,
          page: nextPage
        });
        if (requestId !== state.requestId) return;

        if (!res || res.status !== 1 || !res.obj) {
          toast({
            title: (res && res.message) || "加载更多失败，请稍后重试"
          });
          return;
        }

        const data = res.obj;
        const list = Array.isArray(data.list) ? data.list : [];
        const existingOrderNos = new Set(
          state.items.map((item) => item.orderNo).filter(Boolean)
        );
        const additions = [];
        list.forEach((item) => {
          if (item.orderNo) {
            if (existingOrderNos.has(item.orderNo)) return;
            existingOrderNos.add(item.orderNo);
          }
          additions.push(item);
        });

        state.items = state.items.concat(additions);
        const total = Number(data.total);
        if (Number.isFinite(total)) {
          state.total = total;
        }
        state.page = Number(data.pageNumber) || nextPage;
        state.hasNextPage = Boolean(data.hasNextPage);
      } catch (error) {
        // 网络异常已由 request 层统一提示
      } finally {
        if (requestId === state.requestId) {
          state.loadingMore = false;
        }
      }
    }
  }
};
</script>

<style scoped>
.records-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background-color: #f5f7fa;
}

.records-tabs {
  display: flex;
  flex-shrink: 0;
  height: 96rpx;
  background-color: #ffffff;
  border-bottom: 2rpx solid #eef0f3;
}

.records-tab {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.records-tab--pressed {
  opacity: 0.72;
}

.records-tab--active::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 6rpx;
  content: "";
  background-color: #3b82f6;
  border-radius: 3rpx 3rpx 0 0;
}

.records-tab__label {
  font-size: 30rpx;
  line-height: 1.4;
  color: #4b5563;
}

.records-tab--active .records-tab__label {
  font-weight: 600;
  color: #3b82f6;
}

.records-tab__count {
  margin-left: 8rpx;
  font-size: 26rpx;
  line-height: 1.4;
  color: #8a94a6;
}

.records-tab--active .records-tab__count {
  color: #3b82f6;
}

.records-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.records-list {
  box-sizing: border-box;
  padding: 24rpx 32rpx calc(150rpx + constant(safe-area-inset-bottom));
  padding: 24rpx 32rpx calc(150rpx + env(safe-area-inset-bottom));
}

.record-card {
  box-sizing: border-box;
  margin-bottom: 20rpx;
  padding: 28rpx 30rpx;
  background-color: #ffffff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}

.record-card--pressed {
  background-color: #fafbfc;
}

.record-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.record-card__order {
  display: block;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.5;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-card__status {
  flex-shrink: 0;
  margin-left: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.5;
}

.record-card__status--processing {
  color: #f59e0b;
}

.record-card__status--completed {
  color: #10b981;
}

.record-card__status--default {
  color: #6b7280;
}

.record-card__divider {
  height: 2rpx;
  margin: 20rpx 0 18rpx;
  background-color: #f0f2f5;
}

.record-card__row {
  display: flex;
  align-items: flex-start;
  font-size: 28rpx;
  line-height: 1.7;
}

.record-card__row + .record-card__row {
  margin-top: 4rpx;
}

.record-card__label {
  flex-shrink: 0;
  color: #4b5563;
}

.record-card__value {
  flex: 1;
  min-width: 0;
  color: #1f2937;
  word-break: break-all;
}

.record-card__value--clamp {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.records-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx 0 8rpx;
}

.records-footer__spin,
.records-state__spin {
  display: flex;
  align-items: center;
  justify-content: center;
  animation: records-spin 0.9s linear infinite;
}

.records-footer__text {
  margin-left: 10rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #9ca3af;
}

.records-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 180rpx 24rpx 80rpx;
}

.records-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  background-color: #eef2f7;
  border-radius: 50%;
}

.records-state__text {
  margin-top: 24rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #8a94a6;
  text-align: center;
}

.records-state__retry {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 220rpx;
  height: 72rpx;
  margin-top: 32rpx;
  font-size: 28rpx;
  line-height: 1;
  color: #3b82f6;
  background-color: #eff6ff;
  border-radius: 36rpx;
}

.records-state__retry--pressed {
  opacity: 0.8;
}

@keyframes records-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
