export function renderBottleHtml(bottle: any, comments: any[]) {
  const renderedComments = comments.map(c => `
    <div class="comment-item">
      <span><strong>${c.username}：</strong></span>
      <span class="content-text">${c.content.replace(/\n/g, '<br/>')}</span>
      <span class="comment-time">${new Date(c.createdAt).toLocaleString()}</span>
    </div>
  `).join('')

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: transparent;
      padding: 40px;
      margin: 0;
      width: 600px;
    }
    .bottle-container {
      position: relative;
      border: 1px dashed #b0bec5;
      border-radius: 10px;
      padding: 50px 30px 30px 30px;
      background-color: #fff8e1;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
    .sticky-note {
      position: absolute;
      top: -20px;
      right: -20px;
      width: 60px;
      height: 60px;
      background-color: #ffeb3b;
      transform: rotate(15deg);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      z-index: 1;
      border: 1px solid #fbc02d;
    }
    .license-plate {
      position: absolute;
      top: 10px;
      left: 15px;
      font-size: 20px;
      color: #d32f2f;
      font-weight: bold;
    }
    .bottle-content {
      font-size: 18px;
      color: #333;
      line-height: 1.6;
      margin-top: 10px;
      white-space: pre-wrap;
    }
    .bottle-content img {
      max-width: 100%;
      border-radius: 8px;
      margin-top: 10px;
    }
    .meta {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px dashed #cfd8dc;
      display: flex;
      justify-content: space-between;
      color: #7b5e57;
      font-size: 14px;
    }
    .comments {
      margin-top: 20px;
    }
    .comment-item {
      background-color: #f0f4c3;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 10px;
      font-size: 15px;
      color: #444;
      border: 1px solid #e2e6b3;
    }
    .comment-time { float: right; font-size: 12px; color: #888; }
    .content-text img { height: 30px; vertical-align: middle; margin: 0 5px; }
  </style>
</head>
<body>
  <div class="bottle-container">
    <div class="sticky-note"></div>
    <div class="license-plate">No.${String(bottle.id).padStart(5, '0')}</div>
    
    <div class="bottle-content">
      ${bottle.content}
    </div>
    
    <div class="meta">
      <span>作者：${bottle.username}</span>
      <span>${new Date(bottle.createdAt).toLocaleString()}</span>
    </div>

    ${comments.length ? `
      <div class="comments">
        <h3 style="color: #6d4c41; font-size: 16px;">评论区 (${comments.length})</h3>
        ${renderedComments}
      </div>
    ` : ''}
  </div>
</body>
</html>
  `
}

export function renderLogsHtml(logs: any[]) {
  const renderedLogs = logs.map((log, idx) => {
    let actionHtml = ''
    if (log.action === 'throw') actionHtml = `扔出了一只漂流瓶 (Bottle ID: <span>${log.bottleId}</span>)`
    else if (log.action === 'fish') actionHtml = `捞到了一只漂流瓶 (Bottle ID: <span>${log.bottleId}</span>)`
    else if (log.action === 'comment') actionHtml = `对瓶子 (Bottle ID: <span>${log.bottleId}</span>) 发表了评论`
    else if (log.action === 'approve') actionHtml = `管理员 <span style="color:#2e7d32">通过了</span> 漂流瓶 (Bottle ID: <span>${log.bottleId}</span>)`
    else if (log.action === 'reject') actionHtml = `管理员 <span style="color:#d32f2f">驳回了</span> 漂流瓶 (Bottle ID: <span>${log.bottleId}</span>)`
    
    // Check if the log belongs to the owner of the timeline, or someone else doing it.
    // However, the username is already populated.
    return `
      <div class="timeline-item">
        <div class="bubble-content ${idx === 0 ? 'new' : ''}">
          <div class="event"><strong>${log.username}</strong> ${actionHtml}</div>
          <div class="time">${new Date(log.createdAt).toLocaleString()}</div>
        </div>
      </div>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: transparent;
      padding: 40px;
      margin: 0;
      width: 600px;
    }
    .timeline-container {
      background-color: #fff8e1;
      border: 1px dashed #b0bec5;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
    .title {
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      color: #331e04;
      border-bottom: 2px solid #211a12;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .timeline {
      position: relative;
      margin-left: 20px;
      border-left: 2px dashed #443c3c;
      padding-left: 25px;
    }
    .timeline-item {
      margin-bottom: 20px;
      position: relative;
    }
    .timeline-item:before {
      content: '';
      position: absolute;
      left: -35px;
      top: 15px;
      width: 0; height: 0;
      border: 8px solid transparent;
      border-left-color: #331e04;
    }
    .bubble-content {
      border: 1px solid #ccc;
      background-image: linear-gradient(#ffffff 80%, #fdfef4);
      border-radius: 6px;
      padding: 12px 16px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    .bubble-content.new::before {
      content: '新！';
      position: absolute;
      top: -15px;
      right: 10px;
      color: #00b62a;
      font-weight: bold;
      font-size: 18px;
    }
    .event { color: #331e04; padding-bottom: 6px; border-bottom: 1px dashed #ccc; font-size: 15px; }
    .event span { font-weight: bold; color: #ff5722; }
    .time { margin-top: 8px; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="timeline-container">
    <div class="title">漂流瓶航海日志</div>
    <div class="timeline">
      ${logs.length ? renderedLogs : '<div style="text-align: center; color: #888; margin-top:20px;">暂无航海记录</div>'}
    </div>
  </div>
</body>
</html>
  `
}
