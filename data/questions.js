/**
 * 题库数据
 * 6 个练习方向 × 4 个难度 × 每关 2 题 = 48 题
 *
 * 字段说明：
 * mode: read（朗读）| speak（口头表达）
 * scoreProfile: delivery（只评声音表现）| full（有文字稿时评内容结构）
 * keyPoints: [{ label, keywords }] —— keywords 用于确定性要点覆盖检测
 */

const LEVELS = [
  { n: 1, name: '入门', en: 'START', desc: '先开口，不追求完美' },
  { n: 2, name: '初阶', en: 'EASY', desc: '把一件事说完整' },
  { n: 3, name: '进阶', en: 'GROW', desc: '让结构听得出来' },
  { n: 4, name: '高阶', en: 'EDGE', desc: '在压力下仍然清楚' }
]

const CATEGORIES = [
  {
    id: 'read',
    name: '美文朗读',
    glyph: '读',
    en: 'READ ALOUD',
    tagline: '让声音有形状',
    desc: '借一段好文字，练语感、停顿与气息。',
    longDesc: '朗读不是念字。你要处理停连、重音和句尾，让听的人不用费力就明白。',
    color: '#2F7B63',
    soft: '#E7F1EC'
  },
  {
    id: 'reflect',
    name: '述思用共读',
    glyph: '述',
    en: 'READ · THINK · USE',
    tagline: '把读到的，说成自己的',
    desc: '读懂一段材料，再用自己的话讲出来。',
    longDesc: '读懂不等于会说。先抓住材料的骨架，再换掉作者的语言，才算真正属于你。',
    color: '#7A6846',
    soft: '#F3EEE4'
  },
  {
    id: 'story',
    name: '故事复述',
    glyph: '复',
    en: 'RETELL',
    tagline: '抓住重点，讲清来龙去脉',
    desc: '看一遍故事，合上材料，把它讲给没听过的人。',
    longDesc: '复述训练的是信息压缩：人物、冲突、转折、结果，一个都不能丢，一句废话都不要多。',
    color: '#4C6A7A',
    soft: '#E9F0F3'
  },
  {
    id: 'topic',
    name: '随机话题',
    glyph: '题',
    en: 'SPEAK ON SPOT',
    tagline: '没有准备，也能开口',
    desc: '抽一个话题，构思 30 秒，直接说。',
    longDesc: '临场表达不是天赋。你只需要一个可以反复使用的四步框架：观点、理由、例子、收尾。',
    color: '#8A5D4B',
    soft: '#F5EAE5'
  },
  {
    id: 'structure',
    name: '结构表达',
    glyph: '构',
    en: 'STRUCTURE',
    tagline: '观点—理由—例子—收尾',
    desc: '用固定结构，把一件事讲得让人跟得住。',
    longDesc: '结构不是八股。它是给听众修的一条路，让人知道你现在走到哪、还要走多久。',
    color: '#4E5F45',
    soft: '#EDF1E9'
  },
  {
    id: 'scene',
    name: '场景对练',
    glyph: '场',
    en: 'REAL SCENES',
    tagline: '把难说的话，练成日常',
    desc: '汇报、拒绝、面试、降温，提前练一遍。',
    longDesc: '真正难的从来不是普通话，而是在有压力、有对象、有后果的时候，还能把话说清楚。',
    color: '#5A4E6B',
    soft: '#EFEBF3'
  }
]

function kp(label, keywords) {
  return { label: label, keywords: keywords || [] }
}

const QUESTIONS = [
  /* ========================================================
     美文朗读
     ======================================================== */
  {
    id: 'r1',
    categoryId: 'read',
    level: 1,
    title: '《春》节选',
    subtitle: '朱自清 · 轻快明亮',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '用轻快、明亮的声音朗读这段文字。注意「盼望着」的递进，写景句要放慢。',
    material: '盼望着，盼望着，东风来了，春天的脚步近了。\n一切都像刚睡醒的样子，欣欣然张开了眼。山朗润起来了，水涨起来了，太阳的脸红起来了。\n小草偷偷地从土里钻出来，嫩嫩的，绿绿的。园子里，田野里，瞧去，一大片一大片满是的。',
    tips: ['「盼望着」第二次要比第一次更轻、更快一点', '写景句在逗号处换气，不要一句读到底', '「嫩嫩的，绿绿的」读得短促，像刚冒头'],
    keyPoints: [kp('读出盼春的递进'), kp('写景句放慢'), kp('句尾不要拖')],
    prepSeconds: 15,
    minSeconds: 25,
    maxSeconds: 60,
    coachTip: '先小声通读一遍，把不认识的字查清楚，再开始录。'
  },
  {
    id: 'r2',
    categoryId: 'read',
    level: 1,
    title: '《济南的冬天》节选',
    subtitle: '老舍 · 温厚舒展',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '用温厚、从容的语气朗读。注意长句的换气位置，不要把句子读碎。',
    material: '对于一个在北平住惯的人，像我，冬天要是不刮风，便觉得是奇迹；济南的冬天是没有风声的。\n对于一个刚由伦敦回来的人，像我，冬天要能看得见日光，便觉得是怪事；济南的冬天是响晴的。\n自然，在热带的地方，日光是永远那么毒，响亮的天气，反有点叫人害怕。可是，在北中国的冬天，而能有温晴的天气，济南真得算个宝地。',
    tips: ['「像我」是插入语，前后都要留一点气口', '「奇迹」「怪事」要读出对比的趣味', '最后一句放慢，「宝地」收住'],
    keyPoints: [kp('长句换气自然'), kp('读出对比'), kp('收尾稳住')],
    prepSeconds: 20,
    minSeconds: 35,
    maxSeconds: 75,
    coachTip: '这段的难点是排比长句。先用笔划出换气点，再录。'
  },
  {
    id: 'r3',
    categoryId: 'read',
    level: 2,
    title: '《荷塘月色》节选',
    subtitle: '朱自清 · 安静克制',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '用安静、克制的声线朗读。句与句之间留白，让画面自己浮出来。',
    material: '曲曲折折的荷塘上面，弥望的是田田的叶子。叶子出水很高，像亭亭的舞女的裙。\n层层的叶子中间，零星地点缀着些白花，有袅娜地开着的，有羞涩地打着朵儿的；正如一粒粒的明珠，又如碧天里的星星，又如刚出浴的美人。\n微风过处，送来缕缕清香，仿佛远处高楼上渺茫的歌声似的。',
    tips: ['比喻句要读得轻，不要用力过猛', '「缕缕清香」放慢，给听众留想象空间', '整体音量比平时低半档'],
    keyPoints: [kp('气声轻而不虚'), kp('比喻句有层次'), kp('留白自然')],
    prepSeconds: 20,
    minSeconds: 35,
    maxSeconds: 75,
    coachTip: '这段适合练「轻」。试着用七成音量读，句尾不要掉。'
  },
  {
    id: 'r4',
    categoryId: 'read',
    level: 2,
    title: '《故乡》结尾',
    subtitle: '鲁迅 · 沉静收束',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '用沉静、克制的语气读结尾。最后一句要慢下来，让意思落地。',
    material: '我躺着，听船底潺潺的水声，知道我在走我的路。\n我想：希望是本无所谓有，无所谓无的。这正如地上的路；其实地上本没有路，走的人多了，也便成了路。',
    tips: ['重复句第二次要更慢、更轻', '「走的人多了」后面停半拍', '「也便成了路」不要上扬'],
    keyPoints: [kp('重复句有变化'), kp('停顿留得住'), kp('收尾不飘')],
    prepSeconds: 20,
    minSeconds: 30,
    maxSeconds: 65,
    coachTip: '这段文字极短，难在克制。宁可慢，不要用力煽情。'
  },
  {
    id: 'r5',
    categoryId: 'read',
    level: 3,
    title: '《将进酒》节选',
    subtitle: '李白 · 大开大合',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '读出气势的起伏：开头沉，中间扬，结尾收。注意不要从头到尾一个音量。',
    material: '君不见，黄河之水天上来，奔流到海不复回。\n君不见，高堂明镜悲白发，朝如青丝暮成雪。\n人生得意须尽欢，莫使金樽空对月。\n天生我材必有用，千金散尽还复来。\n烹羊宰牛且为乐，会须一饮三百杯。',
    tips: ['两个「君不见」一句比一句高', '「天生我材必有用」是全段的重音', '最后一句收住，不要喊'],
    keyPoints: [kp('音量有层次'), kp('重音准确'), kp('气势收得住')],
    prepSeconds: 25,
    minSeconds: 35,
    maxSeconds: 80,
    coachTip: '古诗朗读最怕从头喊到尾。先把音量画成一条曲线。'
  },
  {
    id: 'r6',
    categoryId: 'read',
    level: 3,
    title: '《岳阳楼记》节选',
    subtitle: '范仲淹 · 开阔端正',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '用端正、开阔的声音朗读。四字句要读出节奏，长句要托住气。',
    material: '至若春和景明，波澜不惊，上下天光，一碧万顷；沙鸥翔集，锦鳞游泳；岸芷汀兰，郁郁青青。\n而或长烟一空，皓月千里，浮光跃金，静影沉璧，渔歌互答，此乐何极！\n登斯楼也，则有心旷神怡，宠辱偕忘，把酒临风，其喜洋洋者矣。',
    tips: ['四字句两两一组，不要平均用力', '「浮光跃金，静影沉璧」读出对仗', '「其喜洋洋者矣」放慢收尾'],
    keyPoints: [kp('四字句有节奏'), kp('对仗读得清'), kp('气息托得住')],
    prepSeconds: 25,
    minSeconds: 40,
    maxSeconds: 85,
    coachTip: '先查「芷、汀、偕」的读音，再开始。读错一个字，整段的信任会掉。'
  },
  {
    id: 'r7',
    categoryId: 'read',
    level: 4,
    title: '《把话说清楚》',
    subtitle: '原创演讲 · 克制有力',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '这是一段演讲稿。用「对人说话」的感觉朗读，不要像念课文。',
    material: '把话说清楚，不是把每个字都说标准，而是让听的人知道：你现在在哪里，你要带他去哪里。\n先说结论，是给听众一个落脚点；再讲理由，是给他一条路；最后举个例子，是让他看见这条路真的有人走过。\n我们练的从来不是嘴皮子，是在关键时刻，不让自己被误会。',
    tips: ['「你现在在哪里，你要带他去哪里」要读出方向感', '三个分句「先说结论、再讲理由、最后举个例子」层层递进', '最后一句放慢，不要喊口号'],
    keyPoints: [kp('像对人说话'), kp('三个分句有递进'), kp('结尾落得住')],
    prepSeconds: 25,
    minSeconds: 40,
    maxSeconds: 85,
    coachTip: '把手机当成一个具体的人，看着镜头说完。'
  },
  {
    id: 'r8',
    categoryId: 'read',
    level: 4,
    title: '《凌晨四点的城市》',
    subtitle: '原创散文 · 画面感',
    mode: 'read',
    scoreProfile: 'delivery',
    prompt: '用低声、带画面的方式朗读。让听众听见街道的空，而不是听见你在表演。',
    material: '凌晨四点，城市像一张被摊开的旧报纸。路灯还亮着，早餐铺的蒸汽先从卷帘门缝里钻出来。\n清洁工把落叶扫成一小堆，扫帚划过地面，沙沙，沙沙。\n第一班公交从街角拐过来，车灯把路面照出一小段白。有人在站牌下打了个哈欠，把外套裹紧了一点。\n这座城市还没有醒，但已经有人在替它准备白天。',
    tips: ['「沙沙，沙沙」读得像真的听见', '「一小段白」放轻', '最后一句不要拔高，平静地说完'],
    keyPoints: [kp('低声有画面'), kp('拟声词自然'), kp('结尾平静')],
    prepSeconds: 20,
    minSeconds: 40,
    maxSeconds: 85,
    coachTip: '把语速降到平时的七成，先听见自己的呼吸。'
  },

  /* ========================================================
     述思用共读
     ======================================================== */
  {
    id: 'rf1',
    categoryId: 'reflect',
    level: 1,
    title: '反馈比努力更稀缺',
    subtitle: '600 字材料的浓缩版',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '合上材料，用 60 秒说说：为什么反馈比闷头努力更重要？结合一次你自己的经历。',
    material: '很多人把成长理解成「重复」。但重复只负责熟练，不负责正确。\n如果一个动作本身是错的，练一百遍只会把错误固化得更深。真正让练习产生价值的，是中间那一次具体的反馈：哪里不对、为什么不对、下一次改哪一个动作。\n反馈不需要来自名师。一个愿意认真听你说话的人，一句「你刚才那段我没听懂」，就足够把你从自我感觉良好里拽出来。',
    tips: ['先用自己的话复述作者的核心判断', '再讲一次你「练了很久却没进步」的经历', '最后给一个你准备采用的反馈方式'],
    keyPoints: [
      kp('反馈决定改进方向', ['反馈', '改进', '方向', '哪里不对']),
      kp('只重复会固化错误', ['固化', '错误', '重复', '练错']),
      kp('找具体的人给具体意见', ['具体', '意见', '找人', '愿意听'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '不要背原文。你只需要回答「为什么」和「我怎么办」。'
  },
  {
    id: 'rf2',
    categoryId: 'reflect',
    level: 1,
    title: '慢下来，才看得见',
    subtitle: '关于注意力的短文',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 60 秒复述这段话，并说说：你最近一次真正「慢下来」是什么时候？',
    material: '我们习惯用速度证明自己重要。消息要秒回，视频要倍速，连休息都要安排得满满当当。\n但有些东西只在慢的时候出现：一句话背后的情绪，一个方案里被忽略的漏洞，一个人欲言又止的表情。\n慢不是效率的反面。慢是把注意力从「下一件事」收回来，放在「眼前这件事」上。',
    tips: ['先讲「快」带来了什么代价', '再讲「慢」能看见什么', '用一个具体场景收尾，不要空谈'],
    keyPoints: [
      kp('速度会让人忽略细节', ['速度', '忽略', '细节', '快']),
      kp('慢是把注意力收回来', ['注意力', '收回来', '眼前', '慢']),
      kp('给一个具体场景', ['有一次', '那天', '比如', '最近'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '把「慢」说成一个动作，而不是一种态度。'
  },
  {
    id: 'rf3',
    categoryId: 'reflect',
    level: 2,
    title: '先说观察，不急着评价',
    subtitle: '非暴力沟通的第一句',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 70 秒解释：为什么沟通时要把「观察」和「评价」分开？举一个你说错的例子。',
    material: '「你总是迟到」是评价，「这周你有三次比约定时间晚到十分钟」是观察。\n评价会让人立刻进入防御：我没有总是。观察则把事实放在桌面上，让对方有机会解释，也让你的需求更容易被听见。\n非暴力沟通不是说话变软，而是把「我判断你是什么人」换成「我看见了什么，我因此有什么感受」。',
    tips: ['先给一组对比句，让听众秒懂', '再讲评价为什么会引发防御', '最后给出你自己的改写练习'],
    keyPoints: [
      kp('观察是事实，评价是判断', ['观察', '事实', '评价', '判断']),
      kp('评价会引发防御', ['防御', '反驳', '抵触', '总是']),
      kp('说出感受和需要', ['感受', '需要', '我希望', '因为'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '开头直接给「你总是迟到 / 这周三次晚到」的对比，听众立刻能进场。'
  },
  {
    id: 'rf4',
    categoryId: 'reflect',
    level: 2,
    title: '被讨厌的勇气',
    subtitle: '课题分离，不是冷漠',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 70 秒讲清楚「课题分离」是什么意思，并说明它不是冷漠。',
    material: '课题分离，是分清一件事的后果最终由谁承担。\n你表达你的观点，这是你的课题；别人喜不喜欢，这是别人的课题。你认真准备一场汇报，这是你的课题；老板最后怎么评价，不完全由你控制。\n分清课题，不是不管别人，而是不再把「别人的反应」当成「自己的考卷」。这样你才有余力把该做的事做好。',
    tips: ['先给一句定义，不要绕', '用工作或家庭中的一个例子说明', '点明「不是冷漠，是边界」'],
    keyPoints: [
      kp('分清后果由谁承担', ['后果', '承担', '谁的事', '课题']),
      kp('别人的反应是别人的课题', ['别人', '反应', '评价', '喜欢']),
      kp('边界不是冷漠', ['冷漠', '边界', '不管', '尊重'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '这个题目容易被讲成鸡汤。多讲一个你真实遇到的场景。'
  },
  {
    id: 'rf5',
    categoryId: 'reflect',
    level: 3,
    title: '结论先行',
    subtitle: '金字塔原理的最小动作',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 70 秒解释「结论先行」为什么有效，并用一次汇报经历说明。',
    material: '听众的注意力是有限的。你一上来铺背景、讲过程，他会一直猜：所以呢？\n结论先行，是把「所以」放在最前面。先说结果，再给三条理由，最后补必要的过程。\n这不是省略过程，而是把过程放在听众需要的时候再展开。先给地图，再走路。',
    tips: ['开头先给一句「结论先行就是先给地图」', '用一次汇报或周会经历说明', '结尾回扣「先给地图，再走路」'],
    keyPoints: [
      kp('听众注意力有限', ['注意力', '有限', '猜', '所以呢']),
      kp('先说结果再给理由', ['结论', '结果', '先说', '理由']),
      kp('先给地图再走路', ['地图', '过程', '展开', '需要'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '试着用「我先说结论：……」开头，再展开。'
  },
  {
    id: 'rf6',
    categoryId: 'reflect',
    level: 3,
    title: '刻意练习，不是重复',
    subtitle: '离开舒适区的那一步',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 80 秒说说：什么样的练习才算「刻意练习」？你准备怎么改自己的练法？',
    material: '刻意练习有三个条件：目标具体、难度略高于当前水平、反馈及时。\n重复已经会的东西，叫维持；只有在你做不好的地方反复试，才叫练习。\n所以有效的练习往往不舒服。你需要把一个大目标拆成一个今天能完成的小动作，然后盯着它改。',
    tips: ['先给出三个条件', '再对照自己现在的练法', '最后只定一个下周能执行的动作'],
    keyPoints: [
      kp('目标具体', ['目标', '具体', '小动作', '拆']),
      kp('难度略高于当前水平', ['难度', '舒适区', '高一点', '挑战']),
      kp('反馈及时', ['反馈', '及时', '改', '盯着'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 100,
    coachTip: '不要泛泛说「多练」。说清楚你下周具体练哪一个动作。'
  },
  {
    id: 'rf7',
    categoryId: 'reflect',
    level: 4,
    title: '事实、观点与判断',
    subtitle: '把三样东西分开',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 80 秒讲清事实、观点、判断的区别，并各举一个职场中的例子。',
    material: '事实可以被验证：这个月销售额是 120 万。\n观点表达偏好：我认为这个价格偏高。\n判断带有推理：因为转化率连续三周下降，所以问题更可能出在落地页。\n把三者混在一起，讨论就会变成争吵。先确认事实，再交换观点，最后检验判断，会议才开得下去。',
    tips: ['三个概念各用一句话定义', '每个概念配一个职场例子', '最后给出一个开会的具体建议'],
    keyPoints: [
      kp('事实可验证', ['事实', '验证', '数据', '120']),
      kp('观点表达偏好', ['观点', '偏好', '认为', '我觉得']),
      kp('判断带有推理', ['判断', '推理', '因为', '所以']),
      kp('先确认事实再讨论', ['先确认', '事实', '讨论', '会议'])
    ],
    prepSeconds: 35,
    minSeconds: 65,
    maxSeconds: 110,
    coachTip: '这是思维题，不是语文题。例子越具体，区别越清楚。'
  },
  {
    id: 'rf8',
    categoryId: 'reflect',
    level: 4,
    title: '把复杂问题拆成三个小问题',
    subtitle: '结构化思考的入口',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 80 秒解释「问题拆解」的方法，并现场拆一个你正在面对的问题。',
    material: '面对一个太大的问题，人容易停在焦虑里。拆解的作用，是把它变成几个可以动手的小问题。\n一个好用的拆法是：现状是什么、目标是什么、差距卡在哪里。\n拆完还不算完。你还要给每个小问题排优先级，先解决那个「解决了就能带动其他」的。',
    tips: ['先讲为什么大问题让人焦虑', '给出「现状—目标—差距」三步', '现场拆一个你真实的问题'],
    keyPoints: [
      kp('大问题让人停在焦虑里', ['焦虑', '太大', '无从下手', '停']),
      kp('现状、目标、差距', ['现状', '目标', '差距', '卡在哪里']),
      kp('排优先级', ['优先级', '先解决', '带动', '排序'])
    ],
    prepSeconds: 35,
    minSeconds: 65,
    maxSeconds: 110,
    coachTip: '不要只讲方法。最后 20 秒一定用来拆一个真实问题。'
  },

  /* ========================================================
     故事复述
     ======================================================== */
  {
    id: 'st1',
    categoryId: 'story',
    level: 1,
    title: '曾子杀猪',
    subtitle: '守信 · 80 字',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '合上材料，用 60 秒把故事讲给一个没听过的人，最后用一句话点出启示。',
    material: '曾子的妻子要去集市，儿子哭着要跟。妻子哄他说：你回去，等我回来给你杀猪吃。\n妻子回来后，看见曾子正准备杀猪，连忙阻止：我只是跟孩子开玩笑。\n曾子说：孩子不能骗。他什么都不懂，只会学父母。你今天骗他，就是在教他骗人。\n于是，曾子把猪杀了。',
    tips: ['人物关系一句话交代清楚', '「开玩笑」和「杀猪」是冲突点，要停一下', '启示不要超过一句话'],
    keyPoints: [
      kp('曾子与妻子', ['曾子', '妻子', '儿子']),
      kp('妻子用杀猪哄孩子', ['杀猪', '哄', '集市', '开玩笑']),
      kp('曾子坚持守信', ['守信', '骗', '教', '榜样']),
      kp('启示', ['启示', '所以', '孩子', '说到做到'])
    ],
    prepSeconds: 30,
    minSeconds: 45,
    maxSeconds: 85,
    coachTip: '复述不是背原文。用「有个人……后来……最后……」的口气讲。'
  },
  {
    id: 'st2',
    categoryId: 'story',
    level: 1,
    title: '塞翁失马',
    subtitle: '得失 · 100 字',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 60 秒复述这个故事，并说说你最近一次「当时觉得倒霉，后来发现不一定是坏事」的经历。',
    material: '边塞有位老人，家里的马跑到了胡人那边。邻居来安慰，他说：这怎么知道不是好事呢？\n过了几个月，那匹马带着一匹胡人的骏马回来了。邻居来祝贺，他说：这怎么知道不是坏事呢？\n后来他儿子骑马摔断了腿。再后来打仗，青壮年都被征走，他儿子因为腿伤留了下来。',
    tips: ['三次转折要讲清楚', '老人每次的反应都相同，形成节奏', '最后接一个自己的经历'],
    keyPoints: [
      kp('马丢失', ['马', '丢', '跑', '胡人']),
      kp('马带回骏马', ['带回', '骏马', '回来']),
      kp('儿子摔断腿', ['儿子', '摔', '腿']),
      kp('因祸得福', ['打仗', '征兵', '留下', '福', '祸'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '这个故事的关键是重复结构。三次「怎么知道不是好事/坏事」要讲出节奏。'
  },
  {
    id: 'st3',
    categoryId: 'story',
    level: 2,
    title: '司马光砸缸',
    subtitle: '急智 · 90 字',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 60 秒复述，并说明：司马光的做法为什么比「叫人」更快？',
    material: '司马光小时候和一群孩子在院子里玩。一个孩子爬上大水缸，不小心掉了进去。\n别的孩子都吓跑了，有的去喊大人。司马光没有跑，他搬起一块石头，把缸砸破。\n水流了出来，落水的孩子得救了。',
    tips: ['先交代场景和危机', '对比「跑」和「砸」两个选择', '解释「为什么更快」是重点'],
    keyPoints: [
      kp('孩子掉进大水缸', ['水缸', '掉', '落水', '孩子']),
      kp('别人跑，司马光砸缸', ['跑', '喊大人', '石头', '砸缸']),
      kp('水流出，孩子得救', ['水', '流出', '得救']),
      kp('砸缸比叫人快', ['更快', '来不及', '现场', '立刻'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '不要只讲故事。最后 20 秒要回答「为什么这样更快」。'
  },
  {
    id: 'st4',
    categoryId: 'story',
    level: 2,
    title: '盲人摸象',
    subtitle: '认知局限 · 100 字',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 70 秒复述这个故事，并举一个「只看到一个局部就下结论」的现实例子。',
    material: '几个盲人摸一头大象。\n摸到象牙的人说，象像一根又粗又长的萝卜；摸到耳朵的人说，象像一把大蒲扇；摸到腿的人说，象像一根柱子；摸到尾巴的人说，象像一根绳子。\n每个人都觉得自己摸到的是全部，于是吵了起来。',
    tips: ['四种触感要讲得具体', '冲突在于「每个人都认为自己是对的」', '现实例子要具体到场景'],
    keyPoints: [
      kp('盲人摸象的不同部位', ['象牙', '耳朵', '腿', '尾巴']),
      kp('各自的结论', ['萝卜', '蒲扇', '柱子', '绳子']),
      kp('每个人都以为看到了全部', ['全部', '局部', '吵', '自己']),
      kp('现实中的局部判断', ['比如', '只看', '局部', '误判'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '故事的画面感来自四个比喻，慢一点讲，让听众看见。'
  },
  {
    id: 'st5',
    categoryId: 'story',
    level: 3,
    title: '画蛇添足',
    subtitle: '过犹不及 · 90 字',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 70 秒复述，并说说：在表达里，「添足」通常长什么样？',
    material: '楚国有一群人分一壶酒。酒不够喝，有人提议：每人在地上画一条蛇，谁先画完，酒就归谁。\n一个人很快画完了，端起酒壶。他看别人还在画，就说：我还能给蛇添上脚。\n脚还没添完，另一个人画完了，一把夺过酒壶：蛇本来没有脚，你添了脚，就不是蛇了。',
    tips: ['规则要交代清楚', '「我还能添脚」是转折，要演出得意', '把「添足」映射到表达里的啰嗦、过度解释'],
    keyPoints: [
      kp('画蛇赢酒', ['画蛇', '酒', '先画完', '规则']),
      kp('给蛇添脚', ['添脚', '得意', '还能']),
      kp('酒被别人拿走', ['夺', '不是蛇', '输']),
      kp('表达里的过度解释', ['啰嗦', '解释', '重点', '收尾'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '最后一定要落到表达上：多说一句，可能把重点冲掉。'
  },
  {
    id: 'st6',
    categoryId: 'story',
    level: 3,
    title: '三个和尚',
    subtitle: '协作 · 90 字',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 70 秒复述，并分析：为什么人多了，反而没水喝？',
    material: '一个和尚住在山上，每天自己挑水喝。\n后来来了第二个和尚，两个人一起抬水喝。\n再后来来了第三个和尚。谁去挑水？三个人推来推去，谁也不愿意多做。\n结果，水缸空了，三个人都没水喝。',
    tips: ['人数变化带来分工变化', '「推来推去」是核心', '分析要落到责任不清，而不是人变坏了'],
    keyPoints: [
      kp('一个和尚挑水', ['一个', '挑水', '自己']),
      kp('两个和尚抬水', ['两个', '抬水', '一起']),
      kp('三个和尚没水喝', ['三个', '没水', '推', '都不去']),
      kp('责任不清导致协作失效', ['责任', '分工', '制度', '公平'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '分析不要停在「人懒」。往「责任有没有被说清楚」上走。'
  },
  {
    id: 'st7',
    categoryId: 'story',
    level: 4,
    title: '面馆的免费面',
    subtitle: '原创 · 善意与边界',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 80 秒复述，并说说：老板的做法是善意，还是纵容？给出你的判断和理由。',
    material: '巷口有家面馆，门口贴着一张纸：遇到困难，可以进来吃一碗面，不用付钱。\n第一个月，来了七个人，都低着头，吃完悄悄走了。\n第三个月，来了一个熟面孔，连续五天。第六天，老板给他加了两个蛋，说：明天开始，帮我收半小时桌子，面照吃。\n那人愣了一下，第二天真的来了。后来，他成了店里的伙计。',
    tips: ['「七个人低着头」是细节，别丢', '老板加蛋和提要求是转折', '最后给出判断，不要只复述'],
    keyPoints: [
      kp('免费面的告示', ['免费', '告示', '困难', '不用付钱']),
      kp('熟客连续来', ['熟面孔', '连续', '五天', '来']),
      kp('老板给活干，保住体面', ['收桌子', '干活', '体面', '伙计']),
      kp('善意与边界的判断', ['善意', '边界', '尊重', '纵容'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 105,
    coachTip: '这是开放题。复述完要明确站边：是善意还是纵容？'
  },
  {
    id: 'st8',
    categoryId: 'story',
    level: 4,
    title: '最后一班公交',
    subtitle: '原创 · 选择的代价',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 80 秒复述，并回答：司机为什么没有等那个跑过来的人？',
    material: '晚上十一点，最后一班公交准备出站。远处有人一边跑一边挥手。\n司机从后视镜看了一眼，还是踩了油门。\n车上有人小声说：就等一分钟嘛。司机说：这一分钟，车上二十多个人都要晚回家。而且，前面还有三站。\n车开出两站，那个跑过来的人上了另一辆夜班车。他坐在窗边，给家里发了条消息：马上到。',
    tips: ['「看了一眼还是踩了油门」是核心动作', '司机的理由要讲全，不是冷血', '结尾「上了另一辆车」让判断变复杂'],
    keyPoints: [
      kp('末班车与奔跑的人', ['末班', '跑', '挥手', '公交']),
      kp('司机没有等', ['司机', '没等', '踩油门', '后视镜']),
      kp('司机的理由', ['一分钟', '二十多个人', '晚回家', '三站']),
      kp('开放式判断', ['选择', '代价', '规则', '公平'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 105,
    coachTip: '不要急着判对错。把司机的两难讲出来，比给结论更重要。'
  },

  /* ========================================================
     随机话题
     ======================================================== */
  {
    id: 'tp1',
    categoryId: 'topic',
    level: 1,
    title: '你最近一次改变主意',
    subtitle: '真实 · 具体',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '你最近一次改变主意是什么时候？原来怎么想，后来为什么变了？',
    tips: ['先给一句结论：因为什么事改变了什么看法', '讲清楚「原来的想法」和「触发改变的具体瞬间」', '最后说现在的你怎么做'],
    keyPoints: [
      kp('明确原来的看法', ['原来', '以前', '我本来', '我以为']),
      kp('触发改变的具体事件', ['后来', '有一次', '因为', '那天']),
      kp('现在的做法', ['现在', '所以', '以后', '我会'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '不要讲大道理。讲那个让你改变的具体瞬间。'
  },
  {
    id: 'tp2',
    categoryId: 'topic',
    level: 1,
    title: '只能保留一个 App',
    subtitle: '选择 · 取舍',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '如果手机里只能保留一个 App，你留哪个？为什么？',
    tips: ['先亮出选择，不要卖关子', '给两个理由：功能不可替代 + 使用频率', '最后承认失去其他 App 的代价'],
    keyPoints: [
      kp('明确的选择', ['我会留', '我选', '保留', '这个']),
      kp('不可替代的理由', ['因为', '离不开', '替代', '需要']),
      kp('承认代价', ['代价', '失去', '不方便', '但是'])
    ],
    prepSeconds: 25,
    minSeconds: 45,
    maxSeconds: 85,
    coachTip: '这题没有标准答案，考的是取舍是否自洽。'
  },
  {
    id: 'tp3',
    categoryId: 'topic',
    level: 2,
    title: '一个没有手机的周末',
    subtitle: '想象 · 生活',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '描述一个完全没有手机的周末。你会怎么过？最难受的会是什么？',
    tips: ['从周六早上醒来开始讲，给画面', '不要只列活动，讲一个具体的片段', '最后说手机到底替你承担了什么'],
    keyPoints: [
      kp('具体的周末安排', ['早上', '上午', '下午', '我会']),
      kp('一个具体片段', ['比如', '有一次', '那天', '画面']),
      kp('手机替我们承担了什么', ['手机', '其实', '害怕', '错过'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '少说「可以读书、运动」，多讲一个真的会发生的画面。'
  },
  {
    id: 'tp4',
    categoryId: 'topic',
    level: 2,
    title: '你曾经误解过谁',
    subtitle: '反思 · 关系',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '说一件你曾经误解别人的事。你当时怎么判断的？后来怎么发现自己错了？',
    tips: ['先交代误解的结果，制造悬念', '讲清楚你当时的判断依据', '不要美化自己，承认判断太草率'],
    keyPoints: [
      kp('误解的对象和结果', ['误解', '以为', '判断', '结果']),
      kp('当时的依据', ['因为', '看到', '听说', '所以']),
      kp('发现判断错了', ['后来', '才发现', '原来', '其实'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '这题最怕讲成「我早就看透一切」。诚实一点，反而有力量。'
  },
  {
    id: 'tp5',
    categoryId: 'topic',
    level: 3,
    title: '你所在的城市',
    subtitle: '推荐 · 画面',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '如果一个外地朋友只来你的城市一天，你会带他去哪？用 80 秒说服他。',
    tips: ['先给一条路线，不要报景点清单', '每个地点讲一个具体理由或故事', '最后说这一天想让他记住什么'],
    keyPoints: [
      kp('一条清晰路线', ['第一站', '然后', '最后', '路线']),
      kp('具体的理由或故事', ['因为', '有一次', '这里', '故事']),
      kp('想让他记住什么', ['记住', '希望', '感受', '这座城市'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 100,
    coachTip: '把「城市」讲成一天，而不是一张旅游宣传单。'
  },
  {
    id: 'tp6',
    categoryId: 'topic',
    level: 3,
    title: '先攒钱，还是先享受',
    subtitle: '观点 · 论证',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '年轻人应该先攒钱再享受生活，还是边赚边享受？给出你的观点和理由。',
    tips: ['明确站边，不要两边都对', '给两个理由，其中一个用具体数字或经历', '主动回应反方最强的一点'],
    keyPoints: [
      kp('明确立场', ['我认为', '我觉得', '应该', '更']),
      kp('两个具体理由', ['因为', '第一', '第二', '比如']),
      kp('回应反方', ['有人会说', '但是', '当然', '反过来'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 100,
    coachTip: '观点题不是求稳。站住一边，再把反方接住。'
  },
  {
    id: 'tp7',
    categoryId: 'topic',
    level: 4,
    title: 'AI 让人变懒还是变强',
    subtitle: '思辨 · 趋势',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: 'AI 会让人变懒，还是让人变强？用 90 秒给出你的判断，并区分「哪部分人」会怎样。',
    tips: ['不要笼统说「看怎么用」，要给出条件', '分成两类人对比，结构更清楚', '最后落到你自己准备怎么用'],
    keyPoints: [
      kp('给出条件而不是和稀泥', ['取决于', '如果', '关键', '条件']),
      kp('区分不同的人', ['一部分', '另一部分', '会用', '不用']),
      kp('落到自己的行动', ['我自己', '我会', '接下来', '准备'])
    ],
    prepSeconds: 40,
    minSeconds: 70,
    maxSeconds: 115,
    coachTip: '高阶题的关键是「分层」。不要用一个答案覆盖所有人。'
  },
  {
    id: 'tp8',
    categoryId: 'topic',
    level: 4,
    title: '给十年前的自己',
    subtitle: '回望 · 具体',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '如果只能给十年前的自己一条建议，你会说什么？为什么是这一条？',
    tips: ['建议要具体到可执行，不要「要快乐」', '讲一个让你得出这条建议的代价', '最后说现在的你有没有做到'],
    keyPoints: [
      kp('一条具体的建议', ['我会说', '建议', '不要', '应该']),
      kp('得出建议的代价', ['因为', '当时', '代价', '后来']),
      kp('现在的自己有没有做到', ['现在', '我仍然', '做到', '还在'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 105,
    coachTip: '越具体越动人。「别怕选错」不如「大二那次实习，去试，别等准备好」。'
  },

  /* ========================================================
     结构表达
     ======================================================== */
  {
    id: 'str1',
    categoryId: 'structure',
    level: 1,
    title: '为什么早起对你有用',
    subtitle: '观点—理由—例子—回扣',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用「观点—理由—例子—回扣」四步，60 秒说清楚：为什么早起对你有用？',
    tips: ['第一句必须是观点，不要铺背景', '理由只讲一个，讲透', '例子要有时间、地点、结果'],
    keyPoints: [
      kp('明确观点', ['我认为', '我觉得', '早起', '有用']),
      kp('一个理由', ['因为', '原因', '注意力', '安静']),
      kp('一个具体例子', ['比如', '有一次', '上周', '那天']),
      kp('回扣观点', ['所以', '因此', '这就是', '总之'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '把四步写在纸上，每说完一步看一眼，练三次就能脱稿。'
  },
  {
    id: 'str2',
    categoryId: 'structure',
    level: 1,
    title: '汇报本周项目进展',
    subtitle: '结论先行',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '假设老板只有 60 秒。用「结论—三条进展—一个风险—需要的支持」汇报你的项目。',
    tips: ['第一句先说整体结论：正常/延期/有风险', '三条进展用「第一、第二、第三」', '最后明确说出你需要什么支持'],
    keyPoints: [
      kp('整体结论', ['结论', '整体', '目前', '进度']),
      kp('三条进展', ['第一', '第二', '第三', '完成']),
      kp('一个风险', ['风险', '问题', '可能', '担心']),
      kp('需要的支持', ['需要', '支持', '希望', '协调'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 90,
    coachTip: '老板最想听的是「要不要我出手」。最后一句别省。'
  },
  {
    id: 'str3',
    categoryId: 'structure',
    level: 2,
    title: '说服朋友去跑步',
    subtitle: '三个理由',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用三个理由说服一个长期不运动的朋友开始跑步。要具体，不要喊口号。',
    tips: ['先理解他的顾虑，再给理由', '三个理由按「立刻有用—长期有用—情感有用」排列', '最后给一个极低门槛的行动'],
    keyPoints: [
      kp('理解顾虑', ['我知道', '你可能', '担心', '没时间']),
      kp('三个具体理由', ['第一', '第二', '第三', '因为']),
      kp('低门槛行动', ['先', '只要', '从今天', '十分钟'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '说服不是列举好处，是先让对方觉得你懂他。'
  },
  {
    id: 'str4',
    categoryId: 'structure',
    level: 2,
    title: '给外行解释复利',
    subtitle: '类比 + 例子',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用一个外行能听懂的方式解释「复利」。不能用公式，必须有一个生活化的类比。',
    tips: ['先给一个生活类比', '再用一组具体数字说明差距', '最后说复利的前提是时间和不中断'],
    keyPoints: [
      kp('生活化类比', ['就像', '好比', '滚雪球', '利息']),
      kp('具体数字', ['比如', '一年', '十年', '万']),
      kp('时间与不中断', ['时间', '长期', '不中断', '坚持'])
    ],
    prepSeconds: 35,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '解释概念时，先让听众「看见」，再让他「算清」。'
  },
  {
    id: 'str5',
    categoryId: 'structure',
    level: 3,
    title: '为一次迟到道歉',
    subtitle: '事实—影响—补救',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '你迟到了 20 分钟，对方是重要客户。用「事实—影响—补救」完成一次不卑不亢的道歉。',
    tips: ['第一句直接承认迟到，不找借口', '说清楚给对方造成了什么影响', '补救要具体到时间和动作'],
    keyPoints: [
      kp('直接承认事实', ['抱歉', '迟到', '对不起', '是我的问题']),
      kp('说明影响', ['影响', '让你等', '耽误', '打乱']),
      kp('具体补救', ['补救', '我请', '接下来', '补偿'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '道歉里最伤人的是「路上太堵了」。先认，再解释。'
  },
  {
    id: 'str6',
    categoryId: 'structure',
    level: 3,
    title: '拒绝同事临时甩锅',
    subtitle: '理解—边界—替代方案',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '同事临下班把一个本不属于你的任务推给你。用「理解—边界—替代方案」拒绝，但不撕破脸。',
    tips: ['先承认对方的难处，降低对抗', '边界要说具体的：我今天能做什么、不能做什么', '给一个替代方案，而不是只说不行'],
    keyPoints: [
      kp('理解对方难处', ['理解', '知道你', '着急', '难']),
      kp('明确边界', ['但是', '我今天', '不能', '没办法']),
      kp('替代方案', ['可以', '建议', '明天', '找谁'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '拒绝的核心不是「不」，是「我能做到哪一步」。'
  },
  {
    id: 'str7',
    categoryId: 'structure',
    level: 4,
    title: '面试自我介绍',
    subtitle: '90 秒 · 三段式',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 90 秒做一次面试自我介绍：现在是谁—做过什么—为什么适合这个岗位。',
    tips: ['不要从出生地开始讲', '用一件具体成果证明能力，带数字', '最后一句把经历和岗位需求扣上'],
    keyPoints: [
      kp('现在的身份', ['我是', '目前', '现在', '负责']),
      kp('一件具体成果', ['做过', '项目', '结果', '提升了']),
      kp('为什么适合', ['适合', '匹配', '因为', '这个岗位'])
    ],
    prepSeconds: 35,
    minSeconds: 65,
    maxSeconds: 110,
    coachTip: '自我介绍不是简历朗读。每一段都要回答「所以呢」。'
  },
  {
    id: 'str8',
    categoryId: 'structure',
    level: 4,
    title: '30 秒电梯演讲',
    subtitle: '问题—方案—不同—请求',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '用 30 秒介绍你的项目：问题是什么—你怎么做—有什么不同—你想让对方做什么。',
    tips: ['30 秒只能说四句话，每句一个信息', '不要用行业黑话', '最后一定要有明确的请求'],
    keyPoints: [
      kp('问题', ['问题', '痛点', '现在', '很多人']),
      kp('方案', ['我们', '做法', '产品', '帮助']),
      kp('不同', ['不同', '相比', '优势', '唯一']),
      kp('请求', ['希望', '想请', '能不能', '下一步'])
    ],
    prepSeconds: 30,
    minSeconds: 28,
    maxSeconds: 50,
    coachTip: '电梯演讲不是缩短版 BP。删掉背景，只留冲突和请求。'
  },

  /* ========================================================
     场景对练
     ======================================================== */
  {
    id: 'sc1',
    categoryId: 'scene',
    level: 1,
    title: '汇报项目延期',
    subtitle: '对老板 · 坏消息',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '项目原本周五上线，现在确定要延后一周。老板还不知道。请用 60 秒汇报。',
    tips: ['第一句先说结论和新的时间', '主动说明原因，但不要甩锅', '给出补救方案和需要老板做的决定'],
    keyPoints: [
      kp('结论与新的时间', ['延期', '下周', '结论', '时间']),
      kp('原因', ['因为', '原因', '卡在', '问题']),
      kp('补救方案', ['方案', '补救', '加班', '调整']),
      kp('需要老板决定', ['需要', '决定', '确认', '支持'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '坏消息要「结论—原因—方案」一口气给完，不要先铺垫五分钟。'
  },
  {
    id: 'sc2',
    categoryId: 'scene',
    level: 1,
    title: '面试：你最大的缺点',
    subtitle: '对面试官 · 诚实有边界',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '面试官问：「你最大的缺点是什么？」用 60 秒回答，既不躲，也不自毁。',
    tips: ['选一个真实的、可改进的缺点', '说清楚它曾经造成的具体影响', '重点放在你正在怎么改'],
    keyPoints: [
      kp('真实的缺点', ['缺点', '不足', '我容易', '不太']),
      kp('具体影响', ['有一次', '导致', '影响', '错过']),
      kp('正在怎么改', ['现在', '正在', '方法', '改进']),
      kp('不回避', ['承认', '确实', '是我的'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '「我太追求完美」已经没人信了。说一个真的让你吃过亏的。'
  },
  {
    id: 'sc3',
    categoryId: 'scene',
    level: 2,
    title: '拒绝同事借钱',
    subtitle: '对同事 · 边界',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '关系不错的同事向你借 2 万块，你不想借。用 60 秒拒绝，同时尽量保住关系。',
    tips: ['不要编造离谱理由，容易被拆穿', '拒绝的是这笔钱，不是这个人', '如果愿意，给一个你力所能及的替代帮助'],
    keyPoints: [
      kp('直接但不伤人地拒绝', ['抱歉', '不方便', '不能', '没办法']),
      kp('说明边界而非借口', ['原则', '习惯', '家里', '不借钱']),
      kp('保住关系', ['不是', '关系', '理解', '还是朋友']),
      kp('替代帮助', ['可以', '帮你', '其他', '想想办法'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '拒绝越解释越像借口。一句「我这边确实不方便」就够了。'
  },
  {
    id: 'sc4',
    categoryId: 'scene',
    level: 2,
    title: '吵架后降温',
    subtitle: '对伴侣 · 先接情绪',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '你和伴侣因为一件小事吵了起来，对方现在很生气。用 70 秒说一段降温的话。',
    tips: ['先接住情绪，不要急着讲道理', '承认自己那部分问题，哪怕只有 10%', '提出一个具体可执行的下一步'],
    keyPoints: [
      kp('接住情绪', ['我知道', '你现在', '生气', '难受']),
      kp('承认自己的部分', ['我也有', '是我', '抱歉', '没做好']),
      kp('不急着讲道理', ['先不', '不是要', '争', '对错']),
      kp('具体下一步', ['我们', '等会', '一起', '好不好'])
    ],
    prepSeconds: 30,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '降温的第一句永远不是「你听我解释」。'
  },
  {
    id: 'sc5',
    categoryId: 'scene',
    level: 3,
    title: '向客户解释涨价',
    subtitle: '对客户 · 价值锚点',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '合作两年的客户收到涨价通知，很生气。用 80 秒电话沟通，争取留住他。',
    tips: ['先承认对方的感受，不要上来讲成本', '把涨价翻译成对方能获得的价值', '给一个过渡方案或缓冲期'],
    keyPoints: [
      kp('承认客户感受', ['理解', '知道', '不舒服', '抱歉']),
      kp('解释涨价原因', ['成本', '上涨', '因为', '两年']),
      kp('价值而非价格', ['价值', '服务', '效果', '帮你']),
      kp('缓冲方案', ['过渡', '缓冲', '这段时间', '方案'])
    ],
    prepSeconds: 35,
    minSeconds: 60,
    maxSeconds: 100,
    coachTip: '客户不是不接受涨价，是不接受「只有我吃亏」。'
  },
  {
    id: 'sc6',
    categoryId: 'scene',
    level: 3,
    title: '酒桌上被劝酒',
    subtitle: '对长辈/客户 · 不伤面子',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '饭局上，长辈或客户一直劝你喝酒，你确实不能喝。用 60 秒化解，不冷场。',
    tips: ['先给对方面子，再给理由', '理由要简单，不要编身体重病', '主动提出替代动作：以茶代酒、倒酒、敬一杯'],
    keyPoints: [
      kp('给对方面子', ['感谢', '心意', '敬您', '看得起']),
      kp('简单理由', ['不能喝', '身体', '开车', '过敏']),
      kp('替代动作', ['以茶代酒', '倒酒', '敬一杯', '陪您']),
      kp('不冷场', ['今天', '高兴', '下次', '我来'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '拒绝劝酒的关键是「人到位，酒不到位」。'
  },
  {
    id: 'sc7',
    categoryId: 'scene',
    level: 4,
    title: '催同事交东西',
    subtitle: '对平级 · 不撕破脸',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '同事答应周三给你数据，现在周五还没发，你的汇报卡住了。用 60 秒催他。',
    tips: ['先给对方一个体面的台阶', '说清楚你的时间点和影响，不指责人品', '给出两个具体选项，让对方容易回'],
    keyPoints: [
      kp('给台阶', ['知道你忙', '可能', '理解', '不急']),
      kp('说明影响与时间点', ['今天', '汇报', '卡在', '影响']),
      kp('具体请求', ['能不能', '今天下班前', '发我', '半小时']),
      kp('给选项', ['或者', '要么', '两个方案', '你选'])
    ],
    prepSeconds: 30,
    minSeconds: 50,
    maxSeconds: 90,
    coachTip: '催人不是施加压力，是降低对方回复的成本。'
  },
  {
    id: 'sc8',
    categoryId: 'scene',
    level: 4,
    title: '被误解时澄清',
    subtitle: '对团队 · 事实与感受',
    mode: 'speak',
    scoreProfile: 'full',
    prompt: '会上有人暗示你「故意拖延项目」。你当场很生气。用 70 秒澄清事实，又不让会议失控。',
    tips: ['先复述对方的判断，确认自己没有听错', '只讲事实和时间线，不攻击动机', '最后把话题拉回解决问题'],
    keyPoints: [
      kp('确认对方判断', ['你刚才', '意思是', '我理解', '是不是']),
      kp('事实与时间线', ['实际上', '时间', '记录', '当时']),
      kp('不攻击动机', ['我不猜', '不是', '对事', '不针对']),
      kp('拉回解决问题', ['现在', '怎么解决', '继续', '回到'])
    ],
    prepSeconds: 35,
    minSeconds: 55,
    maxSeconds: 95,
    coachTip: '澄清不是赢辩论。你的目标是让团队继续往前走。'
  }
]

const DAILY_IDS = [
  'r1', 'r7', 'rf1', 'rf5', 'st1', 'st3', 'tp1', 'tp2', 'tp6',
  'str1', 'str2', 'str6', 'sc1', 'sc4', 'sc5', 'tp8', 'st7', 'str8'
]

// 美文朗读的教练示范音频（合成语音）
QUESTIONS.filter(q => q.categoryId === 'read').forEach(q => {
  q.audio = '/assets/audio/read_' + q.id + '.mp3'
})

const DAILY_POOL = DAILY_IDS
  .map(id => QUESTIONS.find(q => q.id === id))
  .filter(Boolean)

const CATEGORY_MAP = {}
CATEGORIES.forEach(c => { CATEGORY_MAP[c.id] = c })

const QUESTION_MAP = {}
QUESTIONS.forEach(q => {
  const cat = CATEGORY_MAP[q.categoryId] || {}
  q.categoryName = cat.name || ''
  q.categoryGlyph = cat.glyph || ''
  q.categoryColor = cat.color || '#1B5A47'
  q.categorySoft = cat.soft || '#E7F1EC'
  const lv = LEVELS.find(l => l.n === q.level) || LEVELS[0]
  q.levelName = lv.name
  QUESTION_MAP[q.id] = q
})

function getQuestion(id) {
  return QUESTION_MAP[id] || null
}

function getCategory(id) {
  return CATEGORY_MAP[id] || null
}

function getQuestions(categoryId) {
  return QUESTIONS.filter(q => q.categoryId === categoryId)
}

function getLevels(categoryId) {
  const list = getQuestions(categoryId)
  return LEVELS.map(lv => ({
    n: lv.n,
    name: lv.name,
    en: lv.en,
    desc: lv.desc,
    questions: list.filter(q => q.level === lv.n)
  })).filter(lv => lv.questions.length)
}

/** 同一天固定，跨天轮换 */
function getDailyQuestion(dateKey) {
  const seed = parseInt(String(dateKey || '').replace(/-/g, ''), 10) || 0
  const pool = DAILY_POOL.length ? DAILY_POOL : QUESTIONS
  return pool[seed % pool.length]
}

function categoryCount(categoryId) {
  return getQuestions(categoryId).length
}

module.exports = {
  LEVELS,
  CATEGORIES,
  QUESTIONS,
  DAILY_POOL,
  getQuestion,
  getCategory,
  getQuestions,
  getLevels,
  getDailyQuestion,
  categoryCount
}
