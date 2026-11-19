/**
 * 私教方向配置
 * -------------------------------------------------
 * 这里只定义「方向」，不再定义七天课表本身。
 * plan 字段退化为方向相关的种子题目（也是旧版计划的兼容数据），
 * 真正排题由 utils/plan.js 按最近报告的薄弱维度 + 练习量动态生成：
 * 同一个人练完三次后，重新排一周会拿到不一样的题单。
 *
 * 不联网、不调用模型；命名统一为「私教计划」，不使用 AI 字样。
 */

const GOALS = [
  {
    id: 'work',
    name: '职场汇报',
    glyph: '职',
    desc: '让老板三句话听懂进展。',
    longDesc: '汇报不是流水账。先给结论，再给风险，最后说你需要的支持。',
    color: '#1B5A47',
    soft: '#E4F0EA',
    intro: '你的目标不是「讲全」，是让老板在 60 秒内做出判断。这七天先练结论先行，再练坏消息和边界。',
    focusDims: ['structure', 'rhythm'],
    preferCategories: ['scene', 'structure'],
    plan: ['str2', 'sc1', 'rf5', 'sc7', 'str5', 'sc5', 'str6']
  },
  {
    id: 'interview',
    name: '面试表达',
    glyph: '面',
    desc: '把经历讲成岗位需要的样子。',
    longDesc: '面试官不关心你做过多少事，只关心你能不能解决他的问题。',
    color: '#4C6A7A',
    soft: '#E9F0F3',
    intro: '面试的每一句话都要回答「所以我能胜任」。这七天从自我介绍开始，练到压力问题和反问。',
    focusDims: ['content', 'structure'],
    preferCategories: ['scene', 'story'],
    plan: ['str7', 'sc2', 'tp1', 'str8', 'tp8', 'rf4', 'sc8']
  },
  {
    id: 'boundary',
    name: '拒绝与边界',
    glyph: '界',
    desc: '不撕破脸，也不委屈自己。',
    longDesc: '拒绝的核心不是「不」，是「我能做到哪一步」。',
    color: '#7A6846',
    soft: '#F3EEE4',
    intro: '你不需要变成强势的人，只需要在关键句上不打折。这七天练拒绝、催办和降温。',
    focusDims: ['rhythm', 'energy'],
    preferCategories: ['scene', 'topic'],
    plan: ['str6', 'sc3', 'rf3', 'sc6', 'sc4', 'rf4', 'st7']
  },
  {
    id: 'social',
    name: '社交破冰',
    glyph: '聊',
    desc: '让对话自然往前走。',
    longDesc: '破冰不是会说话，是会让对方有话可说。',
    color: '#5A4E6B',
    soft: '#EFEBF3',
    intro: '社交不是表演。你只需要带一个具体问题、一个自己的故事，和一个不尴尬的收尾。',
    focusDims: ['fluency', 'content'],
    preferCategories: ['topic', 'story'],
    plan: ['tp1', 'tp3', 'tp5', 'tp2', 'tp4', 'st7', 'str8']
  },
  {
    id: 'couple',
    name: '亲密关系沟通',
    glyph: '近',
    desc: '先接情绪，再讲事情。',
    longDesc: '关系里的很多争吵，不是因为意见不同，是因为感受没被接住。',
    color: '#8A5D4B',
    soft: '#F5EAE5',
    intro: '这七天先练「不急着讲道理」，再练道歉、澄清和边界。每道题都建议录两遍。',
    focusDims: ['rhythm', 'vocabulary'],
    preferCategories: ['scene', 'reflect'],
    plan: ['sc4', 'rf3', 'str5', 'tp4', 'rf4', 'st7', 'tp8']
  },
  {
    id: 'stage',
    name: '即兴发言',
    glyph: '即',
    desc: '拿到话题，三十秒就能开口。',
    longDesc: '即兴的底气不是反应快，是有一个可以反复使用的结构。',
    color: '#4E5F45',
    soft: '#EDF1E9',
    intro: '这七天只练一套动作：接住、判断、一个理由、一个例子、一句话收回。',
    focusDims: ['fluency', 'completion'],
    preferCategories: ['topic', 'structure'],
    plan: ['tp2', 'str1', 'tp7', 'st3', 'tp6', 'sc8', 'str8']
  }
]

const GOAL_MAP = {}
GOALS.forEach(g => { GOAL_MAP[g.id] = g })

function getGoal(id) {
  return GOAL_MAP[id] || null
}

function getGoals() {
  return GOALS
}

module.exports = {
  GOALS,
  getGoal,
  getGoals
}
