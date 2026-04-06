<template>
  <k-layout class="driftbottle-admin">
    <k-card class="admin-header">
      <h2>漂流瓶管理后台</h2>
      <div class="admin-tabs">
        <button :class="['tab-btn', { active: activeTab === 'bottles' }]" @click="activeTab = 'bottles'">漂流瓶列表</button>
        <button :class="['tab-btn', { active: activeTab === 'comments' }]" @click="activeTab = 'comments'">评论管理</button>
      </div>
    </k-card>

    <k-card class="admin-content">
      <div class="filter-section">
        <span class="filter-label">状态筛选：</span>
        <div class="radio-group">
          <button :class="['radio-btn', { active: currentStatus === 0 }]" @click="setStatus(0)">待审核</button>
          <button :class="['radio-btn', { active: currentStatus === 1 }]" @click="setStatus(1)">已通过</button>
          <button :class="['radio-btn', { active: currentStatus === 2 }]" @click="setStatus(2)">已驳回</button>
        </div>
      </div>

      <div v-if="activeTab === 'bottles'" class="table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th width="80">ID</th>
              <th width="120">发布者</th>
              <th>内容预览</th>
              <th width="80">打捞数</th>
              <th width="160">发布时间</th>
              <th width="120">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in bottles" :key="item.id">
              <td>#{{ item.id }}</td>
              <td>{{ item.username }}</td>
              <td>
                <div class="text-truncate" v-html="renderHtml(item.content)"></div>
              </td>
              <td>{{ item.fishCount || 0 }}</td>
              <td class="text-muted">{{ new Date(item.createdAt).toLocaleString() }}</td>
              <td>
                <button class="btn btn-text" @click="openBottleModal(item)">查看 / 审核</button>
              </td>
            </tr>
            <tr v-if="bottles.length === 0">
              <td colspan="6" class="empty-text">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="activeTab === 'comments'" class="table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th width="80">评论ID</th>
              <th width="100">所属瓶ID</th>
              <th width="120">评论者</th>
              <th>内容</th>
              <th width="160">评论时间</th>
              <th width="200">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in comments" :key="item.id">
              <td>#{{ item.id }}</td>
              <td>
                <span class="link-text" @click="activeTab = 'bottles'">#{{ item.bottleId }}</span>
              </td>
              <td>
                <div>{{ item.username }}</div>
                <div class="text-small text-muted">{{ item.userId }}</div>
              </td>
              <td>
                <div class="text-truncate" v-html="renderHtml(item.content)"></div>
              </td>
              <td class="text-muted">{{ new Date(item.createdAt).toLocaleString() }}</td>
              <td class="action-cell">
                <button class="btn btn-success btn-small" v-if="item.status !== 1" @click="reviewComment(item.id, 1)">通过</button>
                <button class="btn btn-warning btn-small" v-if="item.status !== 2" @click="reviewComment(item.id, 2)">驳回</button>
                <button class="btn btn-danger btn-small" @click="deleteComment(item.id)">删除</button>
              </td>
            </tr>
            <tr v-if="comments.length === 0">
              <td colspan="6" class="empty-text">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-mask" v-if="selectedBottle" @click.self="selectedBottle = null">
        <div class="standard-dialog">
          <div class="dialog-header">
            <h3>漂流瓶详情 (ID: #{{ selectedBottle.id }})</h3>
            <button class="icon-close" @click="selectedBottle = null">×</button>
          </div>
          
          <div class="dialog-body">
            <div class="info-grid">
              <div class="info-item">
                <span class="label">发布者：</span>
                <span>{{ selectedBottle.username }}</span>
              </div>
              <div class="info-item">
                <span class="label">发布时间：</span>
                <span>{{ new Date(selectedBottle.createdAt).toLocaleString() }}</span>
              </div>
              <div class="info-item">
                <span class="label">当前状态：</span>
                <span :class="statusClass(selectedBottle.status)">{{ statusText(selectedBottle.status) }}</span>
              </div>
              <div class="info-item">
                <span class="label">打捞次数：</span>
                <span>{{ selectedBottle.fishCount || 0 }} 次</span>
              </div>
            </div>

            <div class="section-title">漂流瓶内容</div>
            <div class="content-box" v-html="renderHtml(selectedBottle.content)"></div>

            <div class="two-col-layout">
              <div class="col-section">
                <div class="section-title">所属评论 ({{ selectedBottle.comments?.length || 0 }})</div>
                <div class="list-box">
                  <div class="list-item" v-for="comment in selectedBottle.comments" :key="comment.id">
                    <div class="item-meta">
                      <strong>{{ comment.username }}</strong>
                      <span class="text-small text-muted">{{ new Date(comment.createdAt).toLocaleString() }}</span>
                    </div>
                    <div class="item-content" v-html="renderHtml(comment.content)"></div>
                  </div>
                  <div v-if="!selectedBottle.comments?.length" class="empty-text">暂无评论</div>
                </div>
              </div>

              <div class="col-section">
                <div class="section-title">操作日志</div>
                <div class="list-box">
                  <div class="log-item" v-for="log in selectedBottle.logs" :key="log.id">
                    <span class="text-small text-muted">[{{ new Date(log.createdAt).toLocaleString() }}]</span>
                    <span class="log-text" v-html="renderLogEvent(log)"></span>
                  </div>
                  <div v-if="!selectedBottle.logs?.length" class="empty-text">暂无日志</div>
                </div>
              </div>
            </div>
          </div>

          <div class="dialog-footer">
            <div class="left-actions">
              <button class="btn btn-danger" @click="deleteBottle(selectedBottle.id)">删除此瓶</button>
            </div>
            <div class="right-actions">
              <button class="btn" @click="selectedBottle = null">取消</button>
              <button class="btn btn-warning" v-if="selectedBottle.status !== 2" @click="reviewBottle(selectedBottle.id, 2)">驳回</button>
              <button class="btn btn-primary" v-if="selectedBottle.status !== 1" @click="reviewBottle(selectedBottle.id, 1)">通过审核</button>
            </div>
          </div>
        </div>
      </div>
    </k-card>
  </k-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { send } from '@koishijs/client'

const activeTab = ref('bottles')
const currentStatus = ref(0) // 0 = 待审核, 1 = 已通过, 2 = 已驳回

const bottles = ref([])
const comments = ref([])
const selectedBottle = ref<any>(null)

const renderHtml = (content: string) => {
  const safeStr = (content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safeStr.replace(/&lt;(?:img|image)\s+(?:url|src)="([^"]+)"[^&]*&gt;/gi, (match, url) => {
    const filenameMatch = url.match(/[\\/]([^\\/]+)$/);
    const filename = filenameMatch ? filenameMatch[1] : '';
    if (filename) return `<span class="img-wrapper"><img src="/driftbottle/image/${filename}" alt="image" /></span>`;
    return match;
  });
}

const renderLogEvent = (log: any) => {
  if (log.action === 'throw') return `用户 <b>${log.username}</b> 发布了漂流瓶`;
  if (log.action === 'fish') return `用户 <b>${log.username}</b> 进行了打捞`;
  if (log.action === 'comment') return `用户 <b>${log.username}</b> 发表了评论`;
  if (log.action === 'approve') return `<span style="color:var(--success)">管理员通过了审核</span>`;
  if (log.action === 'reject') return `<span style="color:var(--error)">管理员驳回了内容</span>`;
  return `用户 ${log.username} 执行了操作`;
}

const statusText = (status: number) => {
  if (status === 0) return '待审核'
  if (status === 1) return '已通过'
  if (status === 2) return '已驳回'
  return '未知'
}

const statusClass = (status: number) => {
  if (status === 0) return 'text-warning'
  if (status === 1) return 'text-success'
  if (status === 2) return 'text-danger'
  return ''
}

const openBottleModal = (item: any) => {
  selectedBottle.value = item
}

const fetchData = async () => {
  if (activeTab.value === 'bottles') {
    bottles.value = await send('driftbottle/bottles', currentStatus.value)
    if (selectedBottle.value) {
      selectedBottle.value = bottles.value.find(b => b.id === selectedBottle.value.id) || null
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
  if (!confirm('确定要永久删除该漂流瓶及所有关联评论吗？此操作不可逆。')) return
  await send('driftbottle/delete-bottle', id)
  selectedBottle.value = null
  fetchData()
}

const deleteComment = async (id: number) => {
  if (!confirm('确定要删除此条评论吗？此操作不可逆。')) return
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

<style scoped>
/* ================= 全局变量与基础设定 ================= */
.driftbottle-admin {
  --primary: #409eff;
  --success: #67c23a;
  --warning: #e6a23c;
  --danger: #f56c6c;
  --text-main: var(--fg1, #303133);
  --text-regular: var(--fg2, #606266);
  --text-muted: var(--fg3, #909399);
  --border-color: var(--border, #dcdfe6);
  --bg-color: var(--bg1, #ffffff);
  --bg-page: var(--bg2, #f5f7fa);
  
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-main);
  font-size: 14px;
}

/* ================= 头部与 Tab ================= */
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px !important;
}
.admin-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.admin-tabs {
  display: flex;
  gap: 8px;
  background: var(--bg-page);
  padding: 4px;
  border-radius: 6px;
}
.tab-btn {
  border: none;
  background: transparent;
  padding: 8px 16px;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-regular);
  transition: all 0.2s;
}
.tab-btn:hover { color: var(--primary); }
.tab-btn.active {
  background: var(--bg-color);
  color: var(--primary);
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* ================= 过滤与工具栏 ================= */
.admin-content {
  padding: 24px !important;
  min-height: 500px;
}
.filter-section {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
.filter-label {
  margin-right: 12px;
  color: var(--text-regular);
}
.radio-group {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}
.radio-btn {
  border: none;
  background: var(--bg-color);
  padding: 6px 16px;
  border-right: 1px solid var(--border-color);
  cursor: pointer;
  color: var(--text-regular);
}
.radio-btn:last-child { border-right: none; }
.radio-btn.active {
  background: var(--primary);
  color: white;
}

/* ================= 数据表格 ================= */
.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}
.admin-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.admin-table th, .admin-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}
.admin-table th {
  background-color: var(--bg-page);
  color: var(--text-regular);
  font-weight: 500;
  white-space: nowrap;
}
.admin-table tbody tr:hover {
  background-color: var(--bg-page);
}
.admin-table tbody tr:last-child td {
  border-bottom: none;
}
.text-truncate {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
:deep(.text-truncate img) {
  height: 20px;
  vertical-align: middle;
  border-radius: 2px;
}
.empty-text {
  text-align: center;
  padding: 40px !important;
  color: var(--text-muted);
}
.link-text {
  color: var(--primary);
  cursor: pointer;
}
.link-text:hover { text-decoration: underline; }

/* ================= 通用按钮样式 ================= */
.btn {
  border: 1px solid var(--border-color);
  background: var(--bg-color);
  color: var(--text-regular);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.btn:hover { border-color: var(--primary); color: var(--primary); }
.btn-small { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: var(--primary); color: white; border-color: var(--primary); }
.btn-primary:hover { background: #66b1ff; border-color: #66b1ff; color: white;}
.btn-success { background: var(--success); color: white; border-color: var(--success); }
.btn-success:hover { background: #85ce61; color: white; border-color: #85ce61; }
.btn-warning { background: var(--warning); color: white; border-color: var(--warning); }
.btn-warning:hover { background: #ebb563; color: white; border-color: #ebb563; }
.btn-danger { background: var(--danger); color: white; border-color: var(--danger); }
.btn-danger:hover { background: #f78989; color: white; border-color: #f78989; }
.btn-text { border: none; background: transparent; color: var(--primary); padding: 0; }
.btn-text:hover { background: transparent; text-decoration: underline; }
.action-cell { display: flex; gap: 8px; flex-wrap: wrap; }

/* ================= 辅助文本类 ================= */
.text-small { font-size: 12px; }
.text-muted { color: var(--text-muted); }
.text-success { color: var(--success); }
.text-warning { color: var(--warning); }
.text-danger { color: var(--danger); }

/* ================= 弹窗 (Dialog) ================= */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.standard-dialog {
  width: 800px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--bg-color);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 32px rgba(0,0,0,0.1);
}
.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dialog-header h3 { margin: 0; font-size: 16px; }
.icon-close {
  border: none; background: transparent; font-size: 20px;
  cursor: pointer; color: var(--text-muted);
}
.icon-close:hover { color: var(--danger); }
.dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}
.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.right-actions { display: flex; gap: 12px; }

/* ================= 弹窗内部布局 ================= */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: var(--bg-page);
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}
.info-item .label { color: var(--text-muted); }
.section-title {
  font-weight: 600;
  margin: 20px 0 10px 0;
  padding-left: 8px;
  border-left: 3px solid var(--primary);
  line-height: 1;
}
.content-box {
  border: 1px solid var(--border-color);
  padding: 16px;
  border-radius: 4px;
  line-height: 1.6;
  min-height: 80px;
}
:deep(.content-box img) { max-width: 100%; border-radius: 4px; margin-top: 10px; }

.two-col-layout {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}
.col-section { flex: 1; min-width: 0; }
.list-box {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  height: 250px;
  overflow-y: auto;
}
.list-item {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}
.list-item:last-child { border-bottom: none; }
.item-meta { display: flex; justify-content: space-between; margin-bottom: 6px; }
.item-content { line-height: 1.4; }
:deep(.item-content img) { height: 30px; vertical-align: middle; }

.log-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--bg-page);
}
.log-item .log-text { margin-left: 8px; }
</style>