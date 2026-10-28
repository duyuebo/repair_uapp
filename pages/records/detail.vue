<template>
  <view class="detail-page">
    <view v-if="loading" class="detail-state">
      <view class="detail-state__spin">
        <uni-icons
          type="spinner-cycle"
          :size="32"
          color="#3B82F6"
        ></uni-icons>
      </view>
      <text class="detail-state__text">加载中...</text>
    </view>

    <view v-else-if="error" class="detail-state">
      <view class="detail-state__icon">
        <uni-icons type="info" :size="38" color="#C7CDD6"></uni-icons>
      </view>
      <text class="detail-state__text">{{ errorMessage || "加载失败，请稍后重试" }}</text>
      <view
        v-if="orderId"
        class="detail-state__retry"
        hover-class="detail-state__retry--pressed"
        :hover-stay-time="60"
        @tap="loadDetail"
      >
        <text>重新加载</text>
      </view>
    </view>

    <view v-else-if="detail" class="detail-content">
      <view class="status-row">
        <view class="status-pill" :class="statusMeta.className">
          <uni-icons
            :type="statusMeta.icon"
            :size="14"
            color="#FFFFFF"
          ></uni-icons>
          <text class="status-pill__text">{{ statusMeta.text }}</text>
        </view>
        <text class="status-row__order">工单号：{{ detail.orderNo || "—" }}</text>
      </view>

      <view class="detail-card">
        <view class="detail-card__header">
          <text class="detail-card__title">报修信息</text>
          <view class="readonly-chip">
            <uni-icons type="locked" :size="12" color="#8A94A6"></uni-icons>
            <text class="readonly-chip__text">只读</text>
          </view>
        </view>

        <view class="info-row">
          <text class="info-row__label">所属项目：</text>
          <text class="info-row__value">{{ detail.projectName || "—" }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">报修时间：</text>
          <text class="info-row__value">{{ formatDateTime(detail.dtCreate) || "—" }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">联系人：</text>
          <text class="info-row__value">{{ detail.contactName || "—" }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">联系电话：</text>
          <text class="info-row__value">{{ formatPhone(detail.contactPhone) || "—" }}</text>
        </view>
        <view class="info-row">
          <text class="info-row__label">故障内容：</text>
          <text class="info-row__value">{{ detail.faultDescription || "—" }}</text>
        </view>

        <view v-if="repairPhotos.length" class="photo-block">
          <text class="photo-block__label">故障照片：</text>
          <view class="photo-block__grid">
            <view
              v-for="(photo, index) in repairPhotos"
              :key="photo.id || index"
              class="photo-item"
            >
              <image
                class="photo-item__image"
                :src="resolvePhotoUrl(photo)"
                mode="aspectFill"
                @tap="previewPhoto(repairPhotos, index)"
              />
            </view>
          </view>
        </view>
      </view>

      <view class="timeline">
        <template v-for="(step, index) in timelineSteps" :key="step.key">
          <view class="timeline__step">
            <text
              class="timeline__label"
              :class="{ 'timeline__label--done': step.done }"
            >{{ step.label }}</text>
            <text class="timeline__time">{{ step.time ? "(" + step.time + ")" : "—" }}</text>
          </view>
          <view
            v-if="index < timelineSteps.length - 1"
            class="timeline__connector"
          >
            <view class="timeline__line"></view>
            <uni-icons
              type="arrowright"
              :size="12"
              color="#C7CDD6"
            ></uni-icons>
          </view>
        </template>
      </view>

      <view v-if="showRepairResult" class="detail-card">
        <view class="detail-card__header">
          <text class="detail-card__title">维修结果回复</text>
        </view>

        <view class="worker-row">
          <view class="worker-avatar">
            <uni-icons
              type="person-filled"
              :size="26"
              color="#FFFFFF"
            ></uni-icons>
          </view>
          <text class="worker-name">{{ detail.workerName || "维修师傅" }}</text>
          <view
            v-if="detail.workerPhone"
            class="call-btn"
            hover-class="call-btn--pressed"
            :hover-stay-time="60"
            @tap="callWorker"
          >
            <uni-icons type="phone" :size="14" color="#3B82F6"></uni-icons>
            <text class="call-btn__text">拨打电话</text>
          </view>
        </view>

        <view v-if="detail.workerPhone" class="info-row">
          <text class="info-row__label">联系电话：</text>
          <text class="info-row__value">{{ formatPhone(detail.workerPhone) }}</text>
        </view>
        <view v-if="detail.repairRemark" class="info-row">
          <text class="info-row__label">结果回复：</text>
          <text class="info-row__value">{{ detail.repairRemark }}</text>
        </view>

        <view v-if="constructionPhotos.length" class="photo-block">
          <text class="photo-block__label">完工照片：</text>
          <view class="photo-block__grid">
            <view
              v-for="(photo, index) in constructionPhotos"
              :key="photo.id || index"
              class="photo-item"
            >
              <image
                class="photo-item__image"
                :src="resolvePhotoUrl(photo)"
                mode="aspectFill"
                @tap="previewPhoto(constructionPhotos, index)"
              />
            </view>
          </view>
        </view>

        <view v-if="detail.dtCompleted" class="complete-row">
          <text class="info-row__label">完成时间：</text>
          <text class="info-row__value">{{ formatDateTime(detail.dtCompleted) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getRepairOrderDetail } from "@/api/repair";
import { formatDateTime } from "@/utils/format";
import { getStorage } from "@/utils/storage";

const LOGIN_PAGE = "/pages/login/login";
const STATUS_TEXT = {
  0: "待接单",
  1: "维修中",
  2: "已完成",
  3: "已取消"
};
const STATUS_META = {
  0: { className: "status-pill--pending", icon: "info" },
  1: { className: "status-pill--processing", icon: "compose" },
  2: { className: "status-pill--completed", icon: "checkmarkempty" },
  3: { className: "status-pill--canceled", icon: "closeempty" }
};

const formatPhone = (value) => {
  const text = String(value === null || value === undefined ? "" : value).trim();
  if (!text) return "";

  // 去掉已有的空格、短横线后，按 3-4-4 分组展示 11 位手机号
  const digits = text.replace(/[\s-]/g, "");
  if (/^\d{11}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return text;
};

export default {
  name: "RepairOrderDetailPage",
  data() {
    return {
      orderId: "",
      detail: null,
      loading: false,
      error: false,
      errorMessage: "",
      requestId: 0
    };
  },
  computed: {
    statusMeta() {
      const detail = this.detail || {};
      const status = Number(detail.status);
      const meta = STATUS_META[status] || {
        className: "status-pill--default",
        icon: "info"
      };

      return {
        text: detail.statusText || STATUS_TEXT[status] || "未知状态",
        className: meta.className,
        icon: meta.icon
      };
    },
    repairPhotos() {
      if (!this.detail) return [];

      const grouped = Array.isArray(this.detail.repairPhotos)
        ? this.detail.repairPhotos
        : [];
      if (grouped.length) {
        return grouped.filter((photo) => this.hasPhotoUrl(photo));
      }

      // 兼容仅返回 photos 的旧响应，按 photoType 区分客户图与完工图
      const photos = Array.isArray(this.detail.photos) ? this.detail.photos : [];
      return photos.filter(
        (photo) => Number(photo.photoType) !== 2 && this.hasPhotoUrl(photo)
      );
    },
    constructionPhotos() {
      if (!this.detail) return [];

      const grouped = Array.isArray(this.detail.constructionPhotos)
        ? this.detail.constructionPhotos
        : [];
      if (grouped.length) {
        return grouped.filter((photo) => this.hasPhotoUrl(photo));
      }

      const photos = Array.isArray(this.detail.photos) ? this.detail.photos : [];
      return photos.filter(
        (photo) => Number(photo.photoType) === 2 && this.hasPhotoUrl(photo)
      );
    },
    showRepairResult() {
      const detail = this.detail;
      if (!detail) return false;

      return Boolean(
        detail.workerName ||
          detail.workerPhone ||
          detail.repairRemark ||
          detail.dtCompleted ||
          this.constructionPhotos.length
      );
    },
    timelineSteps() {
      const detail = this.detail || {};
      const status = Number(detail.status);
      const canceled = status === 3;
      const acceptedDone =
        Boolean(detail.dtAccepted) ||
        status === 1 ||
        status === 2 ||
        canceled;

      return [
        {
          key: "created",
          label: "已提交",
          time: this.formatTimelineTime(detail.dtCreate),
          done: Boolean(detail.dtCreate)
        },
        {
          key: "accepted",
          label: "已接单",
          time: this.formatTimelineTime(detail.dtAccepted),
          done: acceptedDone
        },
        {
          key: "finished",
          label: canceled ? "已取消" : "已完成",
          time: this.formatTimelineTime(detail.dtCompleted),
          done: status === 2 || canceled
        }
      ];
    }
  },
  onLoad(options) {
    if (!getStorage("token")) {
      uni.reLaunch({ url: LOGIN_PAGE });
      return;
    }

    this.orderId = options && options.id ? String(options.id) : "";
    if (!this.orderId) {
      this.error = true;
      this.errorMessage = "缺少工单信息，请返回列表重试";
      return;
    }

    this.loadDetail();
  },
  methods: {
    formatDateTime,
    formatPhone,
    async loadDetail() {
      if (!this.orderId) return;

      const requestId = this.requestId + 1;
      this.requestId = requestId;
      this.loading = true;
      this.error = false;
      this.errorMessage = "";

      try {
        const res = await getRepairOrderDetail(this.orderId);
        if (requestId !== this.requestId) return;

        if (!res || res.status !== 1 || !res.obj) {
          this.detail = null;
          this.error = true;
          this.errorMessage =
            (res && res.message) || "获取报修详情失败，请稍后重试";
          return;
        }

        this.detail = res.obj;
      } catch (error) {
        if (requestId !== this.requestId) return;

        this.detail = null;
        this.error = true;
        this.errorMessage = "加载失败，请稍后重试";
        // 网络异常已由 request 层统一提示
      } finally {
        if (requestId === this.requestId) {
          this.loading = false;
        }
      }
    },
    formatTimelineTime(value) {
      const formatted = formatDateTime(value);
      return formatted ? formatted.replace(/^\d{4}-/, "") : "";
    },
    hasPhotoUrl(photo) {
      return Boolean(photo && (photo.photoAccessUrl || photo.photoUrl));
    },
    resolvePhotoUrl(photo) {
      if (!photo) return "";
      return photo.photoAccessUrl || photo.photoUrl || "";
    },
    previewPhoto(photos, index) {
      const list = Array.isArray(photos) ? photos : [];
      const urls = list
        .map((photo) => this.resolvePhotoUrl(photo))
        .filter(Boolean);
      const current = this.resolvePhotoUrl(list[index]);
      if (!current || !urls.length) return;

      uni.previewImage({
        current,
        urls
      });
    },
    callWorker() {
      const phone = this.detail && this.detail.workerPhone;
      if (!phone) return;

      uni.makePhoneCall({
        phoneNumber: String(phone),
        fail: () => {}
      });
    }
  }
};
</script>

<style scoped>
.detail-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx 32rpx calc(48rpx + constant(safe-area-inset-bottom));
  padding: 24rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  background-color: #f5f7fa;
}

.detail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 240rpx 24rpx 80rpx;
}

.detail-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 128rpx;
  height: 128rpx;
  background-color: #eef2f7;
  border-radius: 50%;
}

.detail-state__spin {
  display: flex;
  align-items: center;
  justify-content: center;
  animation: detail-spin 0.9s linear infinite;
}

.detail-state__text {
  margin-top: 24rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #8a94a6;
  text-align: center;
}

.detail-state__retry {
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

.detail-state__retry--pressed {
  opacity: 0.8;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 20rpx;
}

.status-pill {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 48rpx;
  padding: 0 20rpx;
  border-radius: 24rpx;
}

.status-pill--pending {
  background-color: #f59e0b;
}

.status-pill--processing {
  background-color: #3b82f6;
}

.status-pill--completed {
  background-color: #10b981;
}

.status-pill--canceled {
  background-color: #9ca3af;
}

.status-pill--default {
  background-color: #6b7280;
}

.status-pill__text {
  margin-left: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1;
  color: #ffffff;
}

.status-row__order {
  flex: 1;
  min-width: 0;
  margin-left: 20rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: #4b5563;
  text-align: right;
  word-break: break-all;
}

.detail-card {
  box-sizing: border-box;
  padding: 30rpx 30rpx 32rpx;
  background-color: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.04);
}

.detail-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.detail-card__title {
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #111827;
}

.readonly-chip {
  display: flex;
  align-items: center;
  height: 40rpx;
  padding: 0 14rpx;
  background-color: #f3f4f6;
  border-radius: 20rpx;
}

.readonly-chip__text {
  margin-left: 6rpx;
  font-size: 22rpx;
  line-height: 1;
  color: #8a94a6;
}

.info-row {
  display: flex;
  align-items: flex-start;
  font-size: 28rpx;
  line-height: 1.75;
  color: #1f2937;
}

.info-row + .info-row {
  margin-top: 4rpx;
}

.info-row__label {
  flex-shrink: 0;
  width: 168rpx;
  color: #4b5563;
}

.info-row__value {
  flex: 1;
  min-width: 0;
  color: #1f2937;
  word-break: break-all;
}

.photo-block {
  display: flex;
  align-items: flex-start;
  margin-top: 14rpx;
}

.photo-block__label {
  flex-shrink: 0;
  width: 168rpx;
  font-size: 28rpx;
  line-height: 1.75;
  color: #4b5563;
}

.photo-block__grid {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  min-width: 0;
  margin: -6rpx;
}

.photo-item {
  width: 148rpx;
  height: 148rpx;
  margin: 6rpx;
  overflow: hidden;
  background-color: #f3f4f6;
  border-radius: 12rpx;
}

.photo-item__image {
  display: block;
  width: 100%;
  height: 100%;
}

.timeline {
  display: flex;
  align-items: flex-start;
  padding: 28rpx 8rpx 34rpx;
}

.timeline__step {
  flex: 0 0 auto;
  width: 148rpx;
  text-align: center;
}

.timeline__label {
  display: block;
  font-size: 26rpx;
  line-height: 1.4;
  color: #9ca3af;
}

.timeline__label--done {
  font-weight: 500;
  color: #1f2937;
}

.timeline__time {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.4;
  color: #9ca3af;
}

.timeline__connector {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  padding-top: 17rpx;
}

.timeline__line {
  flex: 1;
  height: 2rpx;
  background-color: #d8dee8;
}

.worker-row {
  display: flex;
  align-items: center;
  margin-bottom: 18rpx;
}

.worker-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  background-image: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-radius: 50%;
}

.worker-name {
  flex: 1;
  min-width: 0;
  margin-left: 18rpx;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.4;
  color: #111827;
  word-break: break-all;
}

.call-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 18rpx;
  margin-left: 16rpx;
  background-color: #ffffff;
  border: 2rpx solid #bfdbfe;
  border-radius: 28rpx;
}

.call-btn--pressed {
  background-color: #eff6ff;
}

.call-btn__text {
  margin-left: 6rpx;
  font-size: 24rpx;
  line-height: 1;
  color: #3b82f6;
}

.complete-row {
  display: flex;
  align-items: flex-start;
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.75;
}

@keyframes detail-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
