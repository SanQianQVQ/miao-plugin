import lodash from 'lodash'
import { plugin } from '../adapter/index.js'
import { getMysApi, checkAuth } from '../adapter/mys.js'

class App {
  constructor (cfg) {
    this.id = cfg.id
    this.cfg = cfg
    this.apps = {}
  }

  reg (key, fn, cfg = {}) {
    this.apps[key] = {
      fn,
      ...cfg
    }
  }

  // 获取v3执行方法
  v3App () {
    let cfg = this.cfg || {}
    let rules = []
    let event = cfg.event
    let cls = class extends plugin {
      constructor () {
        super({
          name: `喵喵:${cfg.name || cfg.id}`,
          dsc: cfg.desc || cfg.name || '喵喵插件',
          event: event === 'poke' ? 'notice.*.poke' : 'message',
          priority: 50,
          rule: rules
        })
      }

      accept (e) {
        e.original_msg = e.original_msg || e.msg
      }
    }

    for (let key in this.apps) {
      let app = this.apps[key]
      key = lodash.camelCase(key)
      let rule = app.rule || app.reg || 'noCheck'
      if (event !== 'poke') {
        if (typeof (rule) === 'string') {
          if (rule === 'noCheck') {
            rule = '.*'
          }
        } else {
          rule = lodash.trim(rule.toString(), '/')
        }
      } else {
        rule = '.*'
      }

      rules.push({
        reg: rule,
        fnc: key
      })

      cls.prototype[key] = async function () {
        let e = this.e
        if (event === 'poke') {
          console.log(e)
          if (e.notice_type === 'group') {
            if (e.user_id !== Bot.uin) {
              return false
            }
            e.user_id = e.operator_id
          }
          e.isPoke = true
          e.msg = '#poke#'
        }
        e.original_msg = e.original_msg || e.msg
        e.checkAuth = e.checkAuth || async function (cfg) {
          return await checkAuth(e, cfg)
        }
        e.getMysApi = e.getMysApi || async function (cfg) {
          return await getMysApi(e, cfg)
        }
        return await app.fn.call(this, e)
      }
    }
    return cls
  }

  // 获取v2版rule
  v2Rule () {
    let cfg = this.cfg
    return {
      reg: 'noCheck',
      describe: cfg.desc || '',
      priority: 50,
      hashMark: true
    }
  }

  // v2执行方法
  v2App (e) {
    let apps = this.apps
    return async function (e) {
      let msg = e.original_msg || e.msg || ''
      for (let key in apps) {
        let app = apps[key]
        let rule = app.rule || app.reg || 'noCheck'
        if (app.rule) {
          if (typeof (rule) === 'string') {
            if (rule === '#poke#') {
              continue
            } else if (rule === 'noCheck') {
              rule = /.*/
            }
            rule = new RegExp(rule)
          }
          if (rule.test(msg)) {
            let ret = await app.fn(e, {})
            if (ret === true) {
              return true
            }
          }
        }
      }
      return false
    }
  }
}

App.init = function (cfg) {
  return new App(cfg)
}

export default App
