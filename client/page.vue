<template>
  <k-layout main="page-driftbottle">
    <template #header>漂流瓶管理</template>

    <div class="db-main">
      <div class="db-toolbar">
        <div class="db-tabs">
          <button
            :class="['db-tab', { active: activeTab === 'bottles' }]"
            @click="activeTab = 'bottles'"
          >漂流瓶列表</button>
          <button
            :class="['db-tab', { active: activeTab === 'comments' }]"
            @click="activeTab = 'comments'"
          >评论管理</button>
        </div>
        <div class="db-filters">
          <span class="db-filter-label">状态：</span>
          <div class="db-status-group">
            <button :class="['db-status-btn', { active: currentStatus === 0 }]" @click="setStatus(0)">待审核</button>
            <button :class="['db-status-btn', { active: currentStatus === 1 }]" @click="setStatus(1)">已通过</button>
            <button :class="['db-status-btn', { active: currentStatus === 2 }]" @click="setStatus(2)">已驳回</button>
          </div>
        </div>
      </div>

      <div class="db-scroll">
        <!-- 漂流瓶列表 -->
        <table class="db-table" v-if="activeTab === 'bottles'">
          <thead>
            <tr>
              <th width="55">ID</th>
              <th width="110">发布者</th>
              <th>内容预览</th>
              <th width="60">打捞</th>
              <th width="150">发布时间</th>
              <th width="80">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in bottles" :key="item.id">
              <td class="cell-id">#{{ item.id }}</td>
              <td class="cell-user">{{ item.username }}</td>
              <td><div class="cell-content" v-html="renderHtml(item.content)"></div></td>
              <td class="cell-count">{{ item.fishCount || 0 }}</td>
              <td class="cell-time">{{ formatTime(item.createdAt) }}</td>
              <td>
                <button class="db-btn small primary" @click="openBottleModal(item)">详情</button>
              </td>
            </tr>
            <tr v-if="bottles.length === 0">
              <td colspan="6" class="cell-empty">暂无数据</td>
            </tr>
          </tbody>
        </table>

        <!-- 评论管理 -->
        <table class="db-table" v-if="activeTab === 'comments'">
          <thead>
            <tr>
              <th width="55">ID</th>
              <th width="70">瓶ID</th>
              <th width="110">评论者</th>
              <th>内容</th>
              <th width="150">时间</th>
              <th width="160">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in comments" :key="item.id">
              <td class="cell-id">#{{ item.id }}</td>
              <td>
                <span class="cell-link" @click="activeTab = 'bottles'">#{{ item.bottleId }}</span>
              </td>
              <td class="cell-user">
                <div>{{ item.username }}</div>
                <div class="cell-sub">{{ item.userId }}</div>
              </td>
              <td><div class="cell-content" v-html="renderHtml(item.content)"></div></td>
              <td class="cell-time">{{ formatTime(item.createdAt) }}</td>
              <td class="cell-actions">
                <button class="db-btn small success" v-if="item.status !== 1" @click="reviewComment(item.id, 1)">通过</button>
                <button class="db-btn small warning" v-if="item.status !== 2" @click="reviewComment(item.id, 2)">驳回</button>
                <button class="db-btn small danger" @click="deleteComment(item.id)">删除</button>
              </td>
            </tr>
            <tr v-if="comments.length === 0">
              <td colspan="6" class="cell-empty">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div class="db-modal-mask" v-if="selectedBottle" @click.self="selectedBottle = null">
      <div class="db-dialog">
        <div class="db-dialog-header">
          <h3>漂流瓶 #{{ selectedBottle.id }}</h3>
          <button class="db-dialog-close" @click="selectedBottle = null">&times;</button>
        </div>
        <div class="db-dialog-body">
          <div class="db-info-grid">
            <div class="db-info-item">
              <span class="db-info-label">发布者</span>
              <span>{{ selectedBottle.username }}</span>
            </div>
            <div class="db-info-item">
              <span class="db-info-label">时间</span>
              <span>{{ formatTime(selectedBottle.createdAt) }}</span>
            </div>
            <div class="db-info-item">
              <span class="db-info-label">状态</span>
              <span :class="['db-tag', statusTagClass(selectedBottle.status)]">{{ statusText(selectedBottle.status) }}</span>
            </div>
            <div class="db-info-item">
              <span class="db-info-label">打捞</span>
              <span>{{ selectedBottle.fishCount || 0 }} 次</span>
            </div>
          </div>

          <div class="db-section-title">内容</div>
          <div class="db-content-box" v-html="renderHtml(selectedBottle.content)"></div>

          <div class="db-two-col">
            <div class="db-col">
              <div class="db-section-title">评论 ({{ selectedBottle.comments?.length || 0 }})</div>
              <div class="db-list-box">
                <div class="db-list-item" v-for="comment in selectedBottle.comments" :key="comment.id">
                  <div class="db-list-meta">
                    <strong>{{ comment.username }}</strong>
                    <span class="cell-time">{{ formatTime(comment.createdAt) }}</span>
                  </div>
                  <div class="db-list-content" v-html="renderHtml(comment.content)"></div>
                </div>
                <div v-if="!selectedBottle.comments?.length" class="cell-empty">暂无评论</div>
              </div>
            </div>
            <div class="db-col">
              <div class="db-section-title">日志</div>
              <div class="db-list-box">
                <div class="db-list-item" v-for="log in selectedBottle.logs" :key="log.id">
                  <span class="cell-time">[{{ formatTime(log.createdAt) }}]</span>
                  <span v-html="renderLogEvent(log)"></span>
                </div>
                <div v-if="!selectedBottle.logs?.length" class="cell-empty">暂无日志</div>
              </div>
            </div>
          </div>
        </div>
        <div class="db-dialog-footer">
          <button class="db-btn danger" @click="deleteBottle(selectedBottle.id)">删除</button>
          <div class="db-dialog-footer-right">
            <button class="db-btn" @click="selectedBottle = null">关闭</button>
            <button class="db-btn warning" v-if="selectedBottle.status !== 2" @click="reviewBottle(selectedBottle.id, 2)">驳回</button>
            <button class="db-btn primary" v-if="selectedBottle.status !== 1" @click="reviewBottle(selectedBottle.id, 1)">通过</button>
          </div>
        </div>
      </div>
    </div>
  </k-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { send } from '@koishijs/client'

const activeTab = ref('bottles')
const currentStatus = ref(0)
const bottles = ref<any[]>([])
const comments = ref<any[]>([])
const selectedBottle = ref<any>(null)

const formatTime = (t: any) => {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (isToday) return time
  return `${d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} ${time}`
}

const renderHtml = (content: string) => {
  const safeStr = (content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return safeStr.replace(/&lt;(?:img|image)\b(.*?)&gt;/gi, (match, attrsStr) => {
    const urlMatch = attrsStr.match(/(?:url|src)=(?:&quot;|")([^"]+?)(?:&quot;|")/i) || attrsStr.match(/(?:url|src)=([^\s&]+)/i)
    if (!urlMatch) return match
    const url = urlMatch[1].replace(/&amp;/g, '&')
    if (url.startsWith('http') || url.startsWith('data:')) {
      return `<span class="db-img-wrap"><img src="${url}" alt="image" /></span>`
    }
    const filenameMatch = url.match(/[\\/]([^\\/]+)$/)
    const filename = filenameMatch ? filenameMatch[1] : url
    let base = ''
    const config = (window as any).KOISHI_CONFIG
    if (config && config.endpoint) {
      base = config.endpoint.replace(/\/status\/?$/, '')
    }
    return `<span class="db-img-wrap"><img src="${base}/driftbottle/image/${filename}" alt="image" /></span>`
  })
}

const renderLogEvent = (log: any) => {
  if (log.action === 'throw') return `用户 <b>${log.username}</b> 发布了漂流瓶`
  if (log.action === 'fish') return `用户 <b>${log.username}</b> 进行了打捞`
  if (log.action === 'comment') return `用户 <b>${log.username}</b> 发表了评论`
  if (log.action === 'approve') return `<span style="color:var(--k-color-success)">管理员通过了审核</span>`
  if (log.action === 'reject') return `<span style="color:var(--k-color-danger)">管理员驳回了内容</span>`
  return `用户 ${log.username} 执行了操作`
}

const statusText = (status: number) => {
  if (status === 0) return '待审核'
  if (status === 1) return '已通过'
  if (status === 2) return '已驳回'
  return '未知'
}

const statusTagClass = (status: number) => {
  if (status === 0) return 'warning'
  if (status === 1) return 'success'
  if (status === 2) return 'danger'
  return ''
}

const openBottleModal = (item: any) => {
  selectedBottle.value = item
}

const fetchData = async () => {
  if (activeTab.value === 'bottles') {
    bottles.value = await send('driftbottle/bottles', currentStatus.value)
    if (selectedBottle.value) {
      selectedBottle.value = bottles.value.find((b: any) => b.id === selectedBottle.value.id) || null
    }
  } else {
    comments.value = await send('driftbottle/comments', currentStatus.value)
  }
}

const setStatus = (status: number) => {
  currentStatus.value = status
  fetchData()
}

const reviewBottle = async (id: number, status: number) => {
  await send('driftbottle/review-bottle', id, status)
  fetchData()
}

const reviewComment = async (id: number, status: number) => {
  await send('driftbottle/review-comment', id, status)
  fetchData()
}

const deleteBottle = async (id: number) => {
  if (!confirm('确定要永久删除该漂流瓶及所有关联评论吗？')) return
  await send('driftbottle/delete-bottle', id)
  selectedBottle.value = null
  fetchData()
}

const deleteComment = async (id: number) => {
  if (!confirm('确定要删除此条评论吗？')) return
  await send('driftbottle/delete-comment', id)
  fetchData()
}

watch(activeTab, () => {
  fetchData()
})

onMounted(() => {
  fetchData()
})
</script>

<style lang="scss">
.page-driftbottle {
  .db-main {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .db-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--k-color-divider);
    background: var(--k-card-bg);
    flex-wrap: wrap;
  }

  .db-tabs {
    display: flex;
    gap: 0.25rem;
    background: var(--k-page-bg);
    padding: 0.2rem;
    border-radius: 6px;
  }

  .db-tab {
    border: none;
    background: transparent;
    padding: 0.4rem 0.875rem;
    font-size: 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    color: var(--k-text-normal);
    transition: 0.2s ease;
    font-weight: 500;

    &:hover {
      color: var(--k-color-primary);
    }

    &.active {
      background: var(--k-card-bg);
      color: var(--k-color-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
  }

  .db-filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .db-filter-label {
    font-size: 0.8rem;
    color: var(--k-text-light);
  }

  .db-status-group {
    display: flex;
    border: 1px solid var(--k-color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .db-status-btn {
    border: none;
    background: var(--k-card-bg);
    padding: 0.3rem 0.625rem;
    font-size: 0.75rem;
    cursor: pointer;
    color: var(--k-text-normal);
    transition: 0.2s ease;
    border-right: 1px solid var(--k-color-border);

    &:last-child {
      border-right: none;
    }

    &:hover {
      background: var(--k-hover-bg);
    }

    &.active {
      background: var(--k-color-primary);
      color: #fff;
    }
  }

  .db-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .db-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.8rem;

    th, td {
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid var(--k-color-divider);
    }

    th {
      position: sticky;
      top: 0;
      background: var(--k-card-bg);
      color: var(--k-text-light);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
      z-index: 1;
    }

    tbody tr {
      transition: 0.15s ease;

      &:hover {
        background: var(--k-hover-bg);
      }

      &:last-child td {
        border-bottom: none;
      }
    }
  }

  .cell-id {
    color: var(--k-text-light);
    font-family: var(--font-family-code);
    font-size: 0.75rem;
  }

  .cell-user {
    font-size: 0.8rem;
    color: var(--k-text-dark);
  }

  .cell-sub {
    font-size: 0.7rem;
    color: var(--k-text-light);
    font-family: var(--font-family-code);
  }

  .cell-content {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
    color: var(--k-text-dark);

    img {
      height: 1.25rem;
      vertical-align: middle;
      border-radius: 2px;
    }
  }

  .cell-count {
    font-size: 0.8rem;
    color: var(--k-text-normal);
    text-align: center;
  }

  .cell-time {
    font-size: 0.75rem;
    color: var(--k-text-light);
    white-space: nowrap;
  }

  .cell-actions {
    display: flex;
    gap: 0.375rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .cell-link {
    color: var(--k-color-primary);
    cursor: pointer;
    font-family: var(--font-family-code);
    font-size: 0.75rem;

    &:hover {
      text-decoration: underline;
    }
  }

  .cell-empty {
    text-align: center;
    padding: 3rem 1rem !important;
    color: var(--k-text-light);
    font-size: 0.85rem;
  }

  .db-btn {
    border: 1px solid var(--k-color-border);
    background: var(--k-card-bg);
    color: var(--k-text-normal);
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: 0.2s ease;
    white-space: nowrap;

    &:hover {
      border-color: var(--k-color-primary);
      color: var(--k-color-primary);
    }

    &.primary {
      background: var(--k-color-primary);
      border-color: var(--k-color-primary);
      color: #fff;
      &:hover { opacity: 0.85; color: #fff; }
    }

    &.success {
      background: var(--k-color-success);
      border-color: var(--k-color-success);
      color: #fff;
      &:hover { opacity: 0.85; color: #fff; }
    }

    &.warning {
      background: var(--k-color-warning);
      border-color: var(--k-color-warning);
      color: #fff;
      &:hover { opacity: 0.85; color: #fff; }
    }

    &.danger {
      background: var(--k-color-danger);
      border-color: var(--k-color-danger);
      color: #fff;
      &:hover { opacity: 0.85; color: #fff; }
    }

    &.small {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
  }

  .db-tag {
    display: inline-block;
    padding: 0.125rem 0.4rem;
    border-radius: 3px;
    font-size: 0.7rem;
    font-weight: 500;

    &.warning {
      color: var(--k-color-warning);
      background: var(--k-color-warning-fade, rgba(230, 162, 60, 0.1));
    }

    &.success {
      color: var(--k-color-success);
      background: var(--k-color-success-fade, rgba(103, 194, 58, 0.1));
    }

    &.danger {
      color: var(--k-color-danger);
      background: var(--k-color-danger-fade, rgba(245, 108, 108, 0.1));
    }
  }

  // ===== 弹窗 =====
  .db-modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .db-dialog {
    width: 780px;
    max-width: 90vw;
    max-height: 85vh;
    background: var(--k-card-bg);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  }

  .db-dialog-header {
    flex-shrink: 0;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--k-color-divider);
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--k-text-dark);
    }
  }

  .db-dialog-close {
    border: none;
    background: transparent;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--k-text-light);
    line-height: 1;
    padding: 0.25rem;

    &:hover {
      color: var(--k-color-danger);
    }
  }

  .db-dialog-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
  }

  .db-dialog-footer {
    flex-shrink: 0;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--k-color-divider);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .db-dialog-footer-right {
    display: flex;
    gap: 0.5rem;
  }

  .db-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    background: var(--k-page-bg);
    padding: 1rem;
    border-radius: 6px;
    margin-bottom: 1.25rem;
    font-size: 0.8rem;
  }

  .db-info-item {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .db-info-label {
    color: var(--k-text-light);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .db-section-title {
    font-weight: 600;
    font-size: 0.8rem;
    margin: 1.25rem 0 0.5rem;
    padding-left: 0.5rem;
    border-left: 3px solid var(--k-color-primary);
    line-height: 1;
    color: var(--k-text-dark);
  }

  .db-content-box {
    border: 1px solid var(--k-color-divider);
    padding: 1rem;
    border-radius: 6px;
    line-height: 1.6;
    font-size: 0.85rem;
    color: var(--k-text-dark);
    min-height: 60px;

    img {
      max-width: 100%;
      border-radius: 4px;
      margin-top: 0.5rem;
    }
  }

  .db-two-col {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .db-col {
    flex: 1;
    min-width: 0;
  }

  .db-list-box {
    border: 1px solid var(--k-color-divider);
    border-radius: 6px;
    max-height: 220px;
    overflow-y: auto;
  }

  .db-list-item {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--k-color-divider);
    font-size: 0.8rem;

    &:last-child {
      border-bottom: none;
    }
  }

  .db-list-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
  }

  .db-list-content {
    line-height: 1.4;
    color: var(--k-text-dark);

    img {
      height: 1.5rem;
      vertical-align: middle;
    }
  }

  .db-img-wrap img {
    max-height: 1.25rem;
    vertical-align: middle;
    border-radius: 2px;
  }
}
</style>
