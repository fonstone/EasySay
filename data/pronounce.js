/**
 * 普通话纠音
 * 声母 / 韵母 / 绕口令
 */

const SECTIONS = [
  {
    id: 'initial',
    name: '声母',
    glyph: '声',
    en: 'INITIALS',
    desc: '平翘舌、鼻边音、唇齿音，先把字咬准。',
    color: '#1B5A47',
    soft: '#E4F0EA'
  },
  {
    id: 'final',
    name: '韵母',
    glyph: '韵',
    en: 'FINALS',
    desc: '前后鼻音、圆唇音，解决「听不出差别」。',
    color: '#4C6A7A',
    soft: '#E9F0F3'
  },
  {
    id: 'tongue',
    name: '绕口令',
    glyph: '绕',
    en: 'TWISTERS',
    desc: '在速度里保持清楚，练的是控制力。',
    color: '#7A6846',
    soft: '#F3EEE4'
  }
]

const DRILLS = [
  {
    id: 'zh1',
    section: 'initial',
    title: '平翘舌：四是四，十是十',
    pinyin: 'sì shì sì, shí shì shí',
    focus: 's / sh',
    words: [
      { word: '四十', pinyin: 'sì shí' },
      { word: '十四', pinyin: 'shí sì' },
      { word: '事实', pinyin: 'shì shí' },
      { word: '私事', pinyin: 'sī shì' }
    ],
    tip: '发 s 时舌尖抵住下齿背，发 sh 时舌尖抬起靠近硬腭。先慢读，确认舌头位置，再加速。',
    text: '四是四，十是十，十四是十四，四十是四十。不要把十四说成四十，也不要把四十说成十四。',
    minSeconds: 20,
    maxSeconds: 45,
    challenge: '先慢读三遍，再正常速度读两遍。'
  },
  {
    id: 'nl1',
    section: 'initial',
    title: '鼻边音：刘奶奶买牛奶',
    pinyin: 'liú nǎi nai mǎi niú nǎi',
    focus: 'n / l',
    words: [
      { word: '牛奶', pinyin: 'niú nǎi' },
      { word: '刘奶奶', pinyin: 'liú nǎi nai' },
      { word: '老刘', pinyin: 'lǎo liú' },
      { word: '能耐', pinyin: 'néng nài' }
    ],
    tip: 'n 的气流从鼻腔走，l 的气流从舌头两边走。捏住鼻子读 l 不受影响，读 n 会憋住。',
    text: '刘奶奶找牛奶奶买牛奶，牛奶奶给刘奶奶拿牛奶。刘奶奶说牛奶奶的牛奶不如自己家的鲜，牛奶奶说刘奶奶的牛奶不如自己家的甜。',
    minSeconds: 25,
    maxSeconds: 55,
    challenge: '先捏住鼻子试 n 和 l，再放开读整段。'
  },
  {
    id: 'h1',
    section: 'initial',
    title: '唇齿音：红凤凰，粉凤凰',
    pinyin: 'hóng fèng huáng, fěn fèng huáng',
    focus: 'h / f',
    words: [
      { word: '凤凰', pinyin: 'fèng huáng' },
      { word: '红粉', pinyin: 'hóng fěn' },
      { word: '挥发', pinyin: 'huī fā' },
      { word: '花会', pinyin: 'huā huì' }
    ],
    tip: 'f 用上齿轻触下唇，h 从喉咙摩擦出声。不要把「凤凰」读成「哄凰」。',
    text: '红凤凰，粉凤凰，红粉凤凰花凤凰。红凤凰飞，粉凤凰追，红粉凤凰围着花凤凰飞。',
    minSeconds: 20,
    maxSeconds: 45,
    challenge: '先分开读「红」和「凤」，再连起来。'
  },
  {
    id: 'j1',
    section: 'initial',
    title: '舌面音：七加一，七减一',
    pinyin: 'qī jiā yī, qī jiǎn yī',
    focus: 'j / q / x',
    words: [
      { word: '七加一', pinyin: 'qī jiā yī' },
      { word: '星期', pinyin: 'xīng qī' },
      { word: '机器', pinyin: 'jī qì' },
      { word: '稀奇', pinyin: 'xī qí' }
    ],
    tip: 'j/q/x 的舌尖要抵住下齿背，舌面前部抬起。不要读成「zī/cī/sī」。',
    text: '七加一，七减一，加完减完等于几？七加一，七减一，加完减完还是七。',
    minSeconds: 15,
    maxSeconds: 40,
    challenge: '每个字都咬住，不要连读成一片。'
  },
  {
    id: 'z1',
    section: 'initial',
    title: '平舌音：知道就说知道',
    pinyin: 'zhī dào jiù shuō zhī dào',
    focus: 'z / zh',
    words: [
      { word: '知道', pinyin: 'zhī dào' },
      { word: '字典', pinyin: 'zì diǎn' },
      { word: '制作', pinyin: 'zhì zuò' },
      { word: '自在', pinyin: 'zì zài' }
    ],
    tip: 'z 的舌尖平放，zh 的舌尖翘起。可以用「手放在嘴前」感受气流方向。',
    text: '知道就说知道，不知道就说不知道。不要知道说不知道，也不要不知道说知道。',
    minSeconds: 15,
    maxSeconds: 40,
    challenge: '先读「知道」，再读「字道」，感受舌尖差别。'
  },
  {
    id: 'an1',
    section: 'final',
    title: '前鼻音：长城长',
    pinyin: 'cháng chéng cháng',
    focus: 'an / ang',
    words: [
      { word: '长城', pinyin: 'cháng chéng' },
      { word: '长安', pinyin: 'cháng ān' },
      { word: '班车', pinyin: 'bān chē' },
      { word: '帮忙', pinyin: 'bāng máng' }
    ],
    tip: 'an 的舌尖最后抵住上齿龈，ang 的舌根抬起、口腔打开。读完 an 时嘴巴是闭拢的趋势。',
    text: '长城长，城墙长，长城外面是故乡。长安的班车慢慢开，帮忙的人儿排成行。',
    minSeconds: 20,
    maxSeconds: 45,
    challenge: '把「长安」和「帮忙」交替读五遍。'
  },
  {
    id: 'en1',
    section: 'final',
    title: '前后鼻音：陈程姓陈也姓程',
    pinyin: 'chén chéng xìng chén yě xìng chéng',
    focus: 'en / eng',
    words: [
      { word: '陈程', pinyin: 'chén chéng' },
      { word: '真诚', pinyin: 'zhēn chéng' },
      { word: '成本', pinyin: 'chéng běn' },
      { word: '根本', pinyin: 'gēn běn' }
    ],
    tip: 'en 收在舌尖，eng 收在舌根。读 eng 时，最后嘴巴可以微微张开。',
    text: '陈程姓陈也姓程，真诚做人认真做事。成本要算清，根本不能忘，陈程做事从来有章程。',
    minSeconds: 20,
    maxSeconds: 50,
    challenge: '慢读时用手摸喉结，感受 eng 的舌根动作。'
  },
  {
    id: 'in1',
    section: 'final',
    title: '前后鼻音：晶晶和明明',
    pinyin: 'jīng jīng hé míng míng',
    focus: 'in / ing',
    words: [
      { word: '晶晶', pinyin: 'jīng jīng' },
      { word: '明明', pinyin: 'míng míng' },
      { word: '北京', pinyin: 'běi jīng' },
      { word: '信心', pinyin: 'xìn xīn' }
    ],
    tip: 'in 的舌尖最后抵住上齿龈，ing 的舌根抬起。不要把「北京」读成「北今」。',
    text: '晶晶和明明去北京，晶晶看风景，明明拍风景。晶晶说风景真安静，明明说镜头里的风景更干净。',
    minSeconds: 20,
    maxSeconds: 45,
    challenge: '先读「信心」，再读「行星」，交替五遍。'
  },
  {
    id: 'v1',
    section: 'final',
    title: '圆唇音：女律师穿绿雨衣',
    pinyin: 'nǚ lǜ shī chuān lǜ yǔ yī',
    focus: 'u / ü',
    words: [
      { word: '女律师', pinyin: 'nǚ lǜ shī' },
      { word: '绿雨衣', pinyin: 'lǜ yǔ yī' },
      { word: '区域', pinyin: 'qū yù' },
      { word: '语句', pinyin: 'yǔ jù' }
    ],
    tip: 'ü 要先摆好「i」的舌位，再把嘴唇收圆。不要读成「u」。',
    text: '女律师穿绿雨衣，绿雨衣里下小雨。女律师说雨衣绿，绿雨衣说律师女。',
    minSeconds: 20,
    maxSeconds: 45,
    challenge: '对着镜子看嘴唇，读 ü 时嘴唇必须是圆的。'
  },
  {
    id: 'tw1',
    section: 'tongue',
    title: '四是四，十是十',
    pinyin: 'sì shì sì, shí shì shí',
    focus: '平翘舌 · 入门',
    words: [],
    tip: '绕口令不是越快越好。先用一半速度读清楚，再逐渐加速。',
    text: '四是四，十是十，十四是十四，四十是四十。谁能说准四十、十四、四十四，谁来试一试。',
    minSeconds: 20,
    maxSeconds: 45,
    challenge: '目标：清楚读完两遍，第二遍比第一遍快一点。'
  },
  {
    id: 'tw2',
    section: 'tongue',
    title: '吃葡萄不吐葡萄皮',
    pinyin: 'chī pú tao bù tǔ pú tao pí',
    focus: '唇音 · 入门',
    words: [],
    tip: '注意「葡萄」的轻声，不要把每个字都读成重音。',
    text: '吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮。吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮。',
    minSeconds: 15,
    maxSeconds: 40,
    challenge: '先慢读，再正常速度读三遍，不能吃字。'
  },
  {
    id: 'tw3',
    section: 'tongue',
    title: '黑化肥发灰会挥发',
    pinyin: 'hēi huà féi fā huī huì huī fā',
    focus: 'h / f · 进阶',
    words: [],
    tip: '这题专门练 h 和 f 的切换。先拆成「黑化肥」「发灰」「会挥发」三段。',
    text: '黑化肥发灰会挥发，灰化肥挥发会发黑。黑化肥挥发发灰，灰化肥挥发发黑。',
    minSeconds: 25,
    maxSeconds: 55,
    challenge: '拆成三段读顺，再连起来读两遍。'
  },
  {
    id: 'tw4',
    section: 'tongue',
    title: '牛郎恋刘娘',
    pinyin: 'niú láng liàn liú niáng',
    focus: 'n / l · 进阶',
    words: [],
    tip: 'n 和 l 交替出现，慢读时确认每一个字的气流出口。',
    text: '牛郎恋刘娘，刘娘念牛郎。牛郎年年恋刘娘，刘娘年年念牛郎。郎恋娘来娘念郎。',
    minSeconds: 25,
    maxSeconds: 55,
    challenge: '先逐个词读准，再连成整句。'
  },
  {
    id: 'tw5',
    section: 'tongue',
    title: '扁担长，板凳宽',
    pinyin: 'biǎn dan cháng, bǎn dèng kuān',
    focus: 'an / ang · 高阶',
    words: [],
    tip: '「扁担」「板凳」「长」「宽」里藏着前后鼻音，注意字尾归音。',
    text: '扁担长，板凳宽，扁担没有板凳宽，板凳没有扁担长。扁担要绑在板凳上，板凳不让扁担绑在板凳上。',
    minSeconds: 25,
    maxSeconds: 60,
    challenge: '完整读完一遍不卡壳，再挑战第二遍加速。'
  },
  {
    id: 'tw6',
    section: 'tongue',
    title: '八百标兵奔北坡',
    pinyin: 'bā bǎi biāo bīng bēn běi pō',
    focus: '双唇音 · 高阶',
    words: [],
    tip: 'b/p 的爆破要有力，但不要喷麦。每个字都要站住。',
    text: '八百标兵奔北坡，炮兵并排北边跑。炮兵怕把标兵碰，标兵怕碰炮兵炮。',
    minSeconds: 20,
    maxSeconds: 50,
    challenge: '先慢读，再用正常语速读三遍，最后一遍尽量不停。'
  }
]

const SECTION_MAP = {}
SECTIONS.forEach(s => { SECTION_MAP[s.id] = s })

DRILLS.forEach(d => {
  const s = SECTION_MAP[d.section] || {}
  d.sectionName = s.name || ''
  d.sectionColor = s.color || '#1B5A47'
  d.sectionSoft = s.soft || '#E4F0EA'
  d.audio = '/assets/audio/' + d.id + '.mp3'
})

function getDrill(id) {
  return DRILLS.find(d => d.id === id) || null
}

function getDrills(sectionId) {
  return sectionId ? DRILLS.filter(d => d.section === sectionId) : DRILLS
}

function getSection(id) {
  return SECTION_MAP[id] || null
}

function toQuestion(drill) {
  if (!drill) return null
  return {
    id: 'pr_' + drill.id,
    categoryId: 'pronounce',
    categoryName: '普通话纠音',
    categoryGlyph: '音',
    level: 1,
    levelName: '跟读',
    title: drill.title,
    subtitle: drill.focus,
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '先看清楚每个字的声母韵母，再用稳定的语速读完整段。录完回听，找出最含糊的那个字。',
    material: drill.text,
    tips: [drill.tip, drill.challenge],
    keyPoints: [
      { label: '字音清楚', keywords: [] },
      { label: '节奏稳定', keywords: [] },
      { label: '句尾不吞', keywords: [] }
    ],
    prepSeconds: 15,
    minSeconds: drill.minSeconds || 20,
    maxSeconds: drill.maxSeconds || 45,
    coachTip: drill.challenge,
    isDrill: true
  }
}

module.exports = {
  SECTIONS,
  DRILLS,
  getDrill,
  getDrills,
  getSection,
  toQuestion
}
