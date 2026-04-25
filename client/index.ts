import { Context } from '@koishijs/client'
import Page from './page.vue'

export default (ctx: Context) => {
  ctx.page({
    name: '漂流瓶管理',
    path: '/driftbottle',
    component: Page,
    authority: 3,
  })
}
