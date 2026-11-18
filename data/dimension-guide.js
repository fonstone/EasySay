/**
 * 维度解释器
 * -------------------------------------------------
 * 评分是本地规则引擎算出来的，用户看到「流畅 68」并不知道依据什么、怎么改。
 * 这里把每个维度的计算依据与可执行的改进动作写清楚，报告页与「我的」页共用，
 * 避免两处各写一套互相矛盾的说法。
 *
 * from: voice = 只来自录音；text = 需要补文字稿才会出现
 */

const DIMENSION_GUIDE = {
  content: {
    from: 'text',
    meaning: '你说的有没有扣题，题目给的要点讲到了几个。',
    basis: '文字稿与题目要点的关键词覆盖情况，只在补写文字稿后计算。',
    improve: '先列 2–3 个要点再开口，每说完一个点就用一句话明确收住。'
  },
  structure: {
    from: 'text',
    meaning: '开场、分点、过渡和收尾是否让人跟得住。',
    basis: '文字稿里观点句、分点词、转折词和收尾句的出现情况。',
    improve: '试着「先说结论 → 第一 / 第二 → 所以」，结尾用一句话重申观点。'
  },
  fluency: {
    from: 'voice',
    meaning: '有没有说满、有没有长时间卡住。',
    basis: '录音里的有效发声比例、停顿次数与最长停顿。',
    improve: '把超过 1.5 秒的停顿用一句短过渡填上，例如「换句话说」。'
  },
  rhythm: {
    from: 'voice',
    meaning: '语速和停顿是否落在舒服的区间。',
    basis: '录音时长、语速估计与停顿分布。',
    improve: '重点句前停半拍，其余保持匀速；别越说越快。'
  },
  vocabulary: {
    from: 'text',
    meaning: '用词是否具体、有没有被口头禅拖住。',
    basis: '文字稿的词汇丰富度与「嗯 / 呃 / 那个」等口头禅密度。',
    improve: '把「那个东西」换成具体名词，口头禅出现时先停一下再说。'
  },
  energy: {
    from: 'voice',
    meaning: '声音有没有起伏，还是整段一个调子。',
    basis: '录音的音量变异与能量分布，属于声音事实，不受文字稿影响。',
    improve: '关键结论稍微加重音量，其他句子放松，形成对比。'
  },
  completion: {
    from: 'voice',
    meaning: '有没有在目标时长里把话说完。',
    basis: '实际录音时长与这道题的 minSeconds / maxSeconds。',
    improve: '开练前看一眼建议时长，收尾留 3 秒说完最后一句。'
  }
}

const FROM_LABEL = { voice: '来自录音', text: '需补文字稿' }

const SCORE_GUIDE = {
  title: '这个分数怎么来的',
  lines: [
    '本机规则引擎根据录音的能量、停顿、时长和语速计算，同一段录音永远得到同一个分，不联网、不上传。',
    '没补文字稿时只有 4 个声音维度；补上文字稿后才加入内容、结构、用词，且每份报告只能补一次。',
    '点下面的任意维度，可以看它依据什么、下一次具体怎么练。'
  ]
}

function getDimensionGuide(key) {
  return DIMENSION_GUIDE[key] || {
    from: 'voice',
    meaning: '这一维度反映本次练习的一个侧面。',
    basis: '由本地规则引擎根据当次练习计算。',
    improve: '下一次只挑一个动作来改，比一次改全部更有效。'
  }
}

function fromLabel(key) {
  return FROM_LABEL[(DIMENSION_GUIDE[key] || {}).from] || FROM_LABEL.voice
}

module.exports = {
  DIMENSION_GUIDE,
  SCORE_GUIDE,
  FROM_LABEL,
  getDimensionGuide,
  fromLabel
}
