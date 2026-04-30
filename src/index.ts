import { Context, Schema, Time, h, Session, Random } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { renderBottleHtml, renderLogsHtml } from './html'
import { resolve, join } from 'path'
import { promises as fs } from 'fs'
import { pathToFileURL } from 'url'
import {} from '@koishijs/plugin-console'

export const name = 'driftbottle-with-webui'

export interface Config {
  dailyLimit: number
  cooldown: number
  enableQQNativeMarkdown: boolean
  enableQQInlineCmd: boolean
}

export const Config: Schema<Config> = Schema.object({
  dailyLimit: Schema.number().default(10).description('每日捞瓶子和扔瓶子的次数上限。'),
  cooldown: Schema.number().default(60).description('扔瓶子/捞瓶子的冷却时间（秒）。'),
  enableQQNativeMarkdown: Schema.boolean().default(false).description('是否在 QQ 官方机器人下独立下发包含快捷指令按钮的 Markdown。'),
  enableQQInlineCmd: Schema.boolean().default(true).description('是否在开启原生 Markdown 时启用 mqqapi 快捷操作按钮（仅QQ支持）。'),
})
export const inject = {
  required: ['database', 'console', 'http', 'server', 'puppeteer'],
  optional: ['server.temp']
}

declare module 'koishi' {
  interface Tables {
    driftbottle: DriftBottle
    driftbottle_comment: DriftBottleComment
    driftbottle_usage: DriftBottleUsage
    driftbottle_log: DriftBottleLog
  }
}

export interface DriftBottleLog {
  id: number
  bottleId: number
  userId: string
  username: string
  action: string
  content: string
  createdAt: Date
}

// status: 0 = pending, 1 = approved, 2 = rejected
export interface DriftBottle {
  id: number
  userId: string
  platform: string
  username: string
  content: string
  status: number
  createdAt: Date
}

export interface DriftBottleComment {
  id: number
  bottleId: number
  userId: string
  platform: string
  username: string
  content: string
  status: number
  createdAt: Date
}

export interface DriftBottleUsage {
  id: number
  userId: string
  platform: string
  date: string // YYYY-MM-DD
  count: number
  lastUsedAt: Date
}

// 扩展控制台接口类型
declare module '@koishijs/plugin-console' {
  interface Events {
    'driftbottle/bottles'(status: number): Promise<(DriftBottle & { comments: DriftBottleComment[], logs: DriftBottleLog[], fishCount: number })[]>
    'driftbottle/comments'(status: number): Promise<DriftBottleComment[]>
    'driftbottle/review-bottle'(id: number, status: number): Promise<void>
    'driftbottle/review-comment'(id: number, status: number): Promise<void>
    'driftbottle/delete-bottle'(id: number): Promise<void>
    'driftbottle/delete-comment'(id: number): Promise<void>
  }
}

export function apply(ctx: Context, config: Config) {
  // --- 图像存储设置 ---
  const imageDir = resolve(ctx.baseDir, 'data', 'driftbottle')
  fs.mkdir(imageDir, { recursive: true }).catch(() => {})

  // @ts-ignore
  ctx.server.get('/driftbottle/image/:filename', async (koaCtx) => {
    const filename = koaCtx.params.filename
    if (!filename.match(/^[a-zA-Z0-9_.-]+$/)) {
      koaCtx.status = 400
      return
    }
    const filePath = join(imageDir, filename)
    try {
      const data = await fs.readFile(filePath)
      const ext = filename.split('.').pop()?.toLowerCase()
      let mime = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg'
      else if (ext === 'gif') mime = 'image/gif'
      else if (ext === 'webp') mime = 'image/webp'
      koaCtx.set('Content-Type', mime)
      koaCtx.body = data
    } catch (e) {
      koaCtx.status = 404
    }
  })

  async function processElements(elements: h[]) {
    for (const element of elements) {
      if (element.type === 'img' || element.type === 'image') {
        let url = element.attrs.url || element.attrs.src
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
          try {
            const buffer = await ctx.http.get(url, { responseType: 'arraybuffer' })
            let ext = 'png'
            const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/)
            if (match) {
              const extLower = match[1].toLowerCase()
              if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extLower)) {
                ext = extLower
              }
            }
            const filename = `${Random.id()}.${ext}`
            const fullPath = join(imageDir, filename)
            await fs.writeFile(fullPath, Buffer.from(buffer))
            
            // 保存为内部路由相对链接以用于数据库存储
            element.attrs.url = `/driftbottle/image/${filename}`
            delete element.attrs.src
          } catch (e) {
            ctx.logger('driftbottle').warn('Failed to download image from %s', url, e)
          }
        }
      }
      if (element.children?.length) {
        await processElements(element.children)
      }
    }
  }

  async function downloadImagesLocally(content: string): Promise<string> {
    const elements = h.parse(content)
    await processElements(elements)
    // join() 方法会将 h[] 对象安全地转换回字符串
    return elements.join('')
  }

  async function prepareContentForSending(content: string): Promise<string> {
    const elements = h.parse(content)
    
    async function traverse(nodes: h[]) {
      for (const node of nodes) {
        if (node.type === 'img' || node.type === 'image') {
          const url = node.attrs.url || node.attrs.src
          node.type = 'img'
          
          if (typeof url === 'string' && url.startsWith('/driftbottle/image/')) {
            const filename = url.replace('/driftbottle/image/', '')
            const fullPath = join(imageDir, filename)
            try {
              const buffer = await fs.readFile(fullPath)
              const ext = filename.split('.').pop()?.toLowerCase() || 'png'
              let mime = 'image/png'
              if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg'
              else if (ext === 'gif') mime = 'image/gif'
              else if (ext === 'webp') mime = 'image/webp'
              
              node.attrs.src = `data:${mime};base64,${buffer.toString('base64')}`
              delete node.attrs.url
            } catch (e) {
              ctx.logger('driftbottle').warn('Failed to convert image to base64: %s', fullPath, e)
              node.attrs.src = url
              delete node.attrs.url
            }
          } else {
            node.attrs.src = url
            delete node.attrs.url
          }
        }
        if (node.children?.length) {
          await traverse(node.children)
        }
      }
    }
    
    await traverse(elements)
    return elements.join('')
  }

  // 定义数据库表
  ctx.model.extend('driftbottle', {
    id: 'unsigned',
    userId: 'string',
    platform: 'string',
    username: 'string',
    content: 'text',
    status: 'unsigned',
    createdAt: 'timestamp',
  }, { autoInc: true })

  ctx.model.extend('driftbottle_comment', {
    id: 'unsigned',
    bottleId: 'unsigned',
    userId: 'string',
    platform: 'string',
    username: 'string',
    content: 'text',
    status: 'unsigned',
    createdAt: 'timestamp',
  }, { autoInc: true })

  ctx.model.extend('driftbottle_usage', {
    id: 'unsigned',
    userId: 'string',
    platform: 'string',
    date: 'string',
    count: 'unsigned',
    lastUsedAt: 'timestamp',
  }, { autoInc: true })

  ctx.model.extend('driftbottle_log', {
    id: 'unsigned',
    bottleId: 'unsigned',
    userId: 'string',
    username: 'string',
    action: 'string',
    content: 'text',
    createdAt: 'timestamp',
  }, { autoInc: true })

  // 依赖注入控制台前端
  ctx.inject(['console'], (ctx) => {
    ctx.console.addEntry({
      dev: resolve(__dirname, '../client/index.ts'),
      prod: __dirname.includes('node_modules')
        ? resolve(__dirname, '../dist')
        : resolve(ctx.baseDir, 'node_modules/koishi-plugin-driftbottle-with-webui/dist'),
    })

    ctx.console.addListener('driftbottle/bottles', async (status) => {
      // @ts-ignore
      const bottles = await ctx.database.get('driftbottle', { status }, { sort: { createdAt: 'desc' }, limit: 100 })
      const bottleIds = bottles.map(b => b.id)
      const comments = bottleIds.length ? await ctx.database.get('driftbottle_comment', { bottleId: bottleIds }) : []
      const logs = bottleIds.length ? await ctx.database.get('driftbottle_log', { bottleId: bottleIds }) : []

      return bottles.map(b => ({
        ...b,
        comments: comments.filter(c => c.bottleId === b.id),
        logs: logs.filter(l => l.bottleId === b.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        fishCount: logs.filter(l => l.bottleId === b.id && l.action === 'fish').length
      }))
    }, { authority: 3 })

    ctx.console.addListener('driftbottle/comments', async (status) => {
      // @ts-ignore
      return await ctx.database.get('driftbottle_comment', { status }, { sort: { createdAt: 'desc' }, limit: 100 })
    }, { authority: 3 })

    ctx.console.addListener('driftbottle/review-bottle', async (id, status) => {
      await ctx.database.set('driftbottle', id, { status })
      await ctx.database.create('driftbottle_log', {
        bottleId: id,
        userId: 'Admin',
        username: '管理员',
        action: status === 1 ? 'approve' : 'reject',
        content: '',
        createdAt: new Date()
      })
    }, { authority: 3 })

    ctx.console.addListener('driftbottle/review-comment', async (id, status) => {
      await ctx.database.set('driftbottle_comment', id, { status })
    }, { authority: 3 })

    ctx.console.addListener('driftbottle/delete-bottle', async (id) => {
      await ctx.database.remove('driftbottle', { id })
      // 也删除相关的评论
      await ctx.database.remove('driftbottle_comment', { bottleId: id })
    }, { authority: 3 })

    ctx.console.addListener('driftbottle/delete-comment', async (id) => {
      await ctx.database.remove('driftbottle_comment', { id })
    }, { authority: 3 })
  })

  const getUsage = async (session: Session) => {
    const date = new Date().toISOString().slice(0, 10)
    let usageList = await ctx.database.get('driftbottle_usage', {
      userId: session.userId,
      platform: session.platform,
      date,
    })
    
    let usage: DriftBottleUsage
    if (usageList.length === 0) {
      usage = await ctx.database.create('driftbottle_usage', {
        userId: session.userId,
        platform: session.platform,
        date,
        count: 0,
        lastUsedAt: new Date(0),
      })
    } else {
      usage = usageList[0]
    }
    return usage
  }

  const checkUsage = async (session: Session) => {
    const usage = await getUsage(session)
    if (usage.count >= config.dailyLimit) {
      return '你今天扔/捞瓶子的次数已经用光了，明天再来吧！'
    }
    
    const now = new Date()
    const diff = (now.getTime() - usage.lastUsedAt.getTime()) / 1000
    if (diff < config.cooldown) {
      return `你操作得太快了，请等待 ${Math.ceil(config.cooldown - diff)} 秒后再试。`
    }
    return null
  }

  const updateUsage = async (session: Session) => {
    const usage = await getUsage(session)
    await ctx.database.set('driftbottle_usage', usage.id, {
      count: usage.count + 1,
      lastUsedAt: new Date(),
    })
  }

  // 漂流瓶命令体系
  ctx.command('driftbottle', '漂流瓶')
    .alias('漂流瓶')

  ctx.command('driftbottle.throw <content:text>', '扔一个漂流瓶')
    .alias('扔瓶子')
    .alias('漂流瓶.扔')
    .action(async ({ session }, content) => {
      if (!content) return '瓶子里不能空着哦，请填写内容。'
      
      const error = await checkUsage(session)
      if (error) return error

      const processedContent = await downloadImagesLocally(content)

      const username = session.username || session.author?.nickname || session.userId
      const created = await ctx.database.create('driftbottle', {
        userId: session.userId,
        platform: session.platform,
        username,
        content: processedContent, // 这里支持图片因为是由 Koishi 解析成 h 标签的字符串
        status: 0,
        createdAt: new Date(),
      })

      await ctx.database.create('driftbottle_log', {
        bottleId: created.id,
        userId: session.userId,
        username,
        action: 'throw',
        content: '',
        createdAt: new Date()
      })

      await updateUsage(session)
      return '漂流瓶已仍出！等待管理员审核后即可漂向大海~'
    })

  async function sendDriftBottleOutput(session: Session, imageString: string, mdCommands: { text: string; command: string }[], config: Config) {
    let tempUrl = '';
    let imgW = 500;
    let imgH = 500;
    const tempService = (ctx as any).server?.temp || (ctx as any)['server.temp'];
    // 强制 qq原生md 并且有 tempService 时尝试挂载静态链
    if (session.platform === 'qq' && config.enableQQNativeMarkdown && tempService) {
      try {
        const elements = h.parse(imageString);
        let url = '';
        async function extractUrl(nodes: h[]) {
          for (const node of nodes) {
            if (node.type === 'img' || node.type === 'image') {
              url = node.attrs?.src || node.attrs?.url;
              if (url) return;
            }
            if (node.children?.length) await extractUrl(node.children);
          }
        }
        await extractUrl(elements);
        
        if (url && typeof url === 'string' && url.startsWith('data:image/')) {
          const b64 = url.split('base64,')[1];
          const buffer = Buffer.from(b64, 'base64');
          
          if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
            imgW = buffer.readUInt32BE(16);
            imgH = buffer.readUInt32BE(20);
          } else if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
            let offset = 2;
            while (offset < buffer.length) {
              if (buffer[offset] !== 0xff) break;
              while (buffer[offset] === 0xff) offset++;
              const marker = buffer[offset];
              offset++;
              if (marker === 0xda || marker === 0xd9) break;
              const length = buffer.readUInt16BE(offset);
              if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                imgH = buffer.readUInt16BE(offset + 3);
                imgW = buffer.readUInt16BE(offset + 5);
                break;
              }
              offset += length;
            }
          } else if (buffer.length >= 30 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
            const chunkType = buffer.toString('utf8', 12, 16);
            if (chunkType === 'VP8 ') {
              imgW = buffer.readUInt16LE(26) & 0x3fff;
              imgH = buffer.readUInt16LE(28) & 0x3fff;
            } else if (chunkType === 'VP8L') {
              const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
              imgW = 1 + (((b2 & 0x3F) << 8) | b1);
              imgH = 1 + (((b4 & 0xF) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
            } else if (chunkType === 'VP8X') {
              imgW = 1 + buffer.readUIntLE(24, 3);
              imgH = 1 + buffer.readUIntLE(27, 3);
            }
          }

          const entry = await tempService.create(buffer);
          tempUrl = entry.url;
        }
      } catch (e) {
        ctx.logger('driftbottle').warn('Failed to upload Temp File:', e);
      }
    }

    if (!tempUrl) {
      await session.send(imageString)
    } else {
    }

    // 然后跟随一块包含互动与图片的微型 Markdown
    if (session.platform === 'qq' && config.enableQQNativeMarkdown && config.enableQQInlineCmd && mdCommands.length > 0) {
      // 获取到了图片的真实宽高，写入 QQ markdown 渲染
      let finalMd = tempUrl ? `![image #${imgW}px #${imgH}px](${tempUrl})` : ` `
      
      const buttons = mdCommands.map((cmd, index) => ({
        id: String(index + 1),
        render_data: {
          label: cmd.text,
          visited_label: cmd.text,
          style: 1
        },
        action: {
          type: 2,
          permission: { type: 2 },
          data: cmd.command,
          reply: false,
          enter: !cmd.command.endsWith(' ')
        }
      }))

      session['seq'] = session['seq'] || 0
      const payload: any = {
        msg_type: 2 as const,
        msg_id: session.messageId,
        msg_seq: ++session['seq'],
        content: '漂流瓶 互动引导',
        markdown: { content: finalMd },
        keyboard: {
          content: {
            rows: [ { buttons } ]
          }
        }
      }
      
      try {
        if (session.isDirect) {
          // @ts-ignore
          await session.qq?.sendPrivateMessage(session.channelId, payload)
        } else {
          // @ts-ignore
          await session.qq?.sendMessage(session.channelId, payload)
        }
      } catch (e: any) {
        ctx.logger('driftbottle').warn('Failed to send QQ Markdown interact buttons:', e.response?.data || e.message || e)
      }
    }
  }

  ctx.command('driftbottle.fish', '捞一个漂流瓶')
    .alias('捞瓶子')
    .alias('漂流瓶.捞')
    .action(async ({ session }) => {
      const error = await checkUsage(session)
      if (error) return error

      const bottles = await ctx.database.get('driftbottle', { status: 1 })
      if (!bottles.length) {
        return '大海里空空如也，什么也没捞到。'
      }

      const randomBottle = bottles[Math.floor(Math.random() * bottles.length)]
      
      await updateUsage(session)
      
      const sendContent = await prepareContentForSending(randomBottle.content)

      await ctx.database.create('driftbottle_log', {
        bottleId: randomBottle.id,
        userId: session.userId,
        username: session.username || session.author?.nickname || session.userId,
        action: 'fish',
        content: '',
        createdAt: new Date()
      })

      const comments = await ctx.database.get('driftbottle_comment', { bottleId: randomBottle.id, status: 1 })
      
      const hydratedComments = await Promise.all(comments.map(async (c) => ({
        ...c,
        content: await prepareContentForSending(c.content)
      })))

      const html = renderBottleHtml({
        ...randomBottle,
        content: sendContent
      }, hydratedComments)

      const image = await ctx.puppeteer.render(html)

      return sendDriftBottleOutput(session, image, [
        { text: '捞个瓶子', command: '/捞瓶子' },
        { text: '评论瓶子', command: `/评论瓶子 ${randomBottle.id} ` },
        { text: '我的动态', command: '/我的动态' }
      ], config)
    })

  ctx.command('driftbottle.comment <id:number> <content:text>', '评论一个漂流瓶')
    .alias('评论瓶子')
    .alias('漂流瓶.评论')
    .action(async ({ session }, id, content) => {
      if (!id || !content) return '请提供要评论的漂流瓶 ID 和你要评论的内容。'

      const bottles = await ctx.database.get('driftbottle', { id })
      if (!bottles.length) return `抱歉，找不到 ID 为 ${id} 的漂流瓶。`
      if (bottles[0].status !== 1) return '该漂流瓶不可被评论。'

      const processedContent = await downloadImagesLocally(content)

      const username = session.username || session.author?.nickname || session.userId

      // 发评论不消耗每日次数，但你可以自行决定是否加限制
      const created = await ctx.database.create('driftbottle_comment', {
        bottleId: id,
        userId: session.userId,
        platform: session.platform,
        username,
        content: processedContent,
        status: 0, // 评论也进入审核队列
        createdAt: new Date(),
      })

      await ctx.database.create('driftbottle_log', {
        bottleId: id,
        userId: session.userId,
        username,
        action: 'comment',
        content: processedContent,
        createdAt: new Date()
      })

      return '评论已发送！等待管理员审核后大家就都能看到了。'
    })

  ctx.command('driftbottle.view <id:number>', '查看漂流瓶和它的评论')
    .alias('看瓶子')
    .alias('漂流瓶.看瓶子')
    .alias('漂流瓶.查看')
    .action(async ({ session }, id) => {
      if (!id) return '请输入漂流瓶 ID。'

      const bottles = await ctx.database.get('driftbottle', { id })
      if (!bottles.length) return `找不到 ID 为 ${id} 的漂流瓶。`
      
      const bottle = bottles[0]
      if (bottle.status !== 1 && bottle.userId !== session.userId) {
        return '这是一个还没通过审核或被拒绝的漂流瓶，你无法查看。'
      }

      const comments = await ctx.database.get('driftbottle_comment', { bottleId: id, status: 1 })
      
      const sendBottleContent = await prepareContentForSending(bottle.content)
      
      const hydratedComments = await Promise.all(comments.map(async (c) => ({
        ...c,
        content: await prepareContentForSending(c.content)
      })))

      const html = renderBottleHtml({
        ...bottle,
        content: sendBottleContent
      }, hydratedComments)

      const image = await ctx.puppeteer.render(html)
      
      return sendDriftBottleOutput(session, image, [
        { text: '评论瓶子', command: `/评论瓶子 ${id} ` }
      ], config)
    })

  ctx.command('driftbottle.my', '查看我扔的瓶子')
    .alias('我的瓶子')
    .alias('漂流瓶.我的瓶子')
    .action(async ({ session }) => {
      const bottles = await ctx.database.get('driftbottle', { userId: session.userId, platform: session.platform })
      if (!bottles.length) return '你还没扔过漂流瓶。'

      let msg = ['你有这些漂流瓶：']
      for (const b of bottles.slice(-10)) { // 最多显示最新的10个
        let statusStr = b.status === 0 ? '审核中' : (b.status === 1 ? '已通过' : '已拒绝')
        let excerpt = b.content.length > 10 ? b.content.substring(0, 10).replace(/<[^>]*>/g, '[图片/元素]') + '...' : b.content
        msg.push(`[ID: ${b.id}] ${excerpt} - ${statusStr}`)
      }

      if (bottles.length > 10) msg.push(`...等共 ${bottles.length} 个瓶子`)

      return msg.join('\n')
    })
    
  ctx.command('driftbottle.logs', '查看自己的航海动态')
    .alias('我的动态')
    .alias('漂流瓶.我的动态')
    .action(async ({ session }) => {
      const myBottles = await ctx.database.get('driftbottle', { userId: session.userId })
      const myBottleIds = myBottles.map(b => b.id)
      
      const logs = await ctx.database.get('driftbottle_log', {
        $or: [
          { userId: session.userId },
          ...(myBottleIds.length ? [{ bottleId: myBottleIds }] : [])
        ]
      })

      if (!logs.length) return '你还没有任何航海记录。'

      logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const recentLogs = logs.slice(0, 30)

      const html = renderLogsHtml(recentLogs)
      const image = await ctx.puppeteer.render(html)

      return sendDriftBottleOutput(session, image, [
        { text: '捞个瓶子', command: '/捞瓶子' }
      ], config)
    })

}
