/**
 * 这个站盯哪些方向，只在这个文件里增删。
 *
 * 增删一个方向：在 DOMAINS 里加或删一项，然后跑 `node scripts/sync-domains.ts`。
 * 脚本会重新生成：industry/taxonomy.ts、industry/topics.json、
 * industry/prompts/domain-scope.md / domain-taste.md / domain-tags.md、site/domains.generated.ts。
 *
 * 注意：
 * - 分类 key 会进网址（/all?category=）和分类订阅地址，上线后不要改已有方向的 key。
 * - 信源配置（sources.json）是资产，脚本不会自动删；删方向后脚本会列出该方向的信源 id，
 *   去后台「信源」页停用即可（框架只在首次启动时导入 sources.json）。
 * - 新增方向时，若要给它配公司/机构主题页，先在 SHARED.entities 里补主体，再在 topics 里引用。
 */

export interface DomainTopic {
  slug: string;
  name: string;
  group: "company" | "field" | "genre";
  entityId?: string;
  tags?: string[];
  aliases?: string[];
  definition: string;
}

export interface Domain {
  /** 分类 key，上线后不改。 */
  key: string;
  label: string;
  feedLabel?: string;
  /** 日报里的分节标题。 */
  section: string;
  /** 飞书推送卡片上这一类小标签的颜色。 */
  tagColor: string;
  /** 结构抽取模型看到的归类原则。 */
  guide: string;
  /** 预筛提示词里一句话说明这个方向收什么。 */
  scope: string;
  /** 这个方向的主题标签，会并进 taxonomy.ts 的 TOPIC_TAGS。 */
  tags: readonly string[];
  /** 主题页，group 为 company / field。 */
  topics: readonly DomainTopic[];
  /** 属于这个方向的信源 id，用于增删方向时给出停用清单。 */
  sourceIds: readonly string[];
  /** 评分标准：这个方向必须正常评价的价值。 */
  important: readonly string[];
  /** 评分标准：这个方向必须压住的噪声。 */
  noise: readonly string[];
}

export const DOMAINS: readonly Domain[] = [
  {
    key: "edu",
    label: "教育",
    section: "教育",
    tagColor: "orange",
    guide: "教育行政部门正式发布的政策与规划、招生考试制度变化、课程与教材调整、学校与教师相关的可核实事件，以及教育技术研究与调查结果。培训机构广告、升学营销和学校常规活动通稿不属于高价值内容。",
    scope: "教育政策与招生考试、学校与教研、教育技术与教育研究结果",
    tags: ["教育政策", "招生考试", "课程/教学", "教育技术"],
    topics: [
      { slug: "moe", name: "教育部", group: "company", entityId: "moe", definition: "教育部正式发布的政策、规划、招生考试与课程标准变化。" },
      { slug: "edu-policy", name: "教育政策", group: "field", tags: ["教育政策"], definition: "各级教育行政部门的政策文件、招生考试制度与课程改革。" },
    ],
    sourceIds: ["web-moe-news", "web-jyb-news", "rss-inside-higher-ed"],
    important: ["教育部及省级教育行政部门的正式政策文件、招生考试制度变化、课程与教材调整、大规模调查与教育研究结果"],
    noise: ["升学机构营销、学校常规活动通稿、无政策依据的「趋势解读」，`sig ≤ 3`"],
  },
  {
    key: "it",
    label: "信息技术",
    section: "信息技术",
    tagColor: "indigo",
    guide: "以「能提升个人或小团队效率的工具与技术」为主：新发布的 AI 工具、GitHub 上新且能直接上手的开源项目，以及建模、音乐、设计、视频剪辑、写作、自动化这些具体工作流里新出现的能力。要说清它解决什么具体问题、怎么装怎么用、有什么门槛与限制。融资与人事、厂商通稿、只有参数没有用法的发布、单个漏洞与补丁公告都不算。",
    scope: "能直接提升效率的新工具与开源项目：AI 工具、GitHub 新项目，以及建模/音乐/设计/视频/自动化等创作与生产工具的新能力",
    tags: ["AI 工具", "开源项目", "3D/建模", "音乐/音频", "设计/图像", "视频/剪辑", "自动化", "开发工具"],
    topics: [
      { slug: "github-new", name: "GitHub 新项目", group: "field", tags: ["开源项目"], definition: "GitHub 上近期发布或快速升温、能解决具体问题的开源项目。" },
      { slug: "ai-tools", name: "AI 工具", group: "field", tags: ["AI 工具"], definition: "能直接用于产出的 AI 工具，与本地能跑起来的开源模型。" },
      { slug: "modeling", name: "3D 与建模", group: "field", tags: ["3D/建模"], definition: "建模、渲染、扫描与场景重建相关工具的新版本与新能力。" },
      { slug: "audio", name: "音乐与音频", group: "field", tags: ["音乐/音频"], definition: "音乐生成、分轨、音频处理与录制工具的新发布。" },
      { slug: "design", name: "设计与图像", group: "field", tags: ["设计/图像"], definition: "设计、排版、图像处理与生成工具的新能力。" },
    ],
    sourceIds: ["rss-github-blog", "rss-hugging-face"],
    important: ["新发布或重大更新、且能直接上手解决具体问题的工具与开源项目", "有可复现数据的能力提升：跑分、耗时、显存占用、支持格式", "明确的门槛与限制：许可证、硬件要求、能否商用"],
    noise: ["单个漏洞与补丁公告、例行安全更新、厂商融资与人事变动、只有参数没有用法的产品页，`sig ≤ 3`", "只列 Star 涨幅与「本周热门清单」而没有具体用法的榜单文，`nov ≤ 3`"],
  },
  {
    key: "gear",
    label: "数码",
    feedLabel: "数码硬件",
    section: "数码与硬件",
    tagColor: "turquoise",
    guide: "电脑与周边硬件：SSD 与机械硬盘、内存、CPU/GPU、主板与整机、HiFi 耳机与音频设备、显示器与外设。新品规格、独立实测数据、价格与供货变化、固件问题与召回都归这里；厂商通稿和带货清单不属于高价值内容。",
    scope: "电脑硬件与音频设备的新品、实测、价格与供货（SSD、机械硬盘、内存、CPU/GPU、HiFi 耳机等）",
    tags: ["存储/SSD", "机械硬盘", "内存/DRAM", "CPU/GPU", "整机/主板", "HiFi耳机", "音频设备", "显示/外设"],
    topics: [
      { slug: "western-digital", name: "西部数据 / 闪迪", group: "company", entityId: "western-digital", aliases: ["WD", "SanDisk"], definition: "西部数据与闪迪的硬盘、SSD 新品、产能与固件动态。" },
      { slug: "samsung", name: "三星半导体", group: "company", entityId: "samsung", definition: "三星在 NAND、DRAM 与存储产品上的发布与供货变化。" },
      { slug: "ssd", name: "SSD 与固态存储", group: "field", tags: ["存储/SSD"], definition: "固态硬盘、NVMe、控制器与 NAND 的新品、实测和价格变化。" },
      { slug: "hdd", name: "机械硬盘", group: "field", tags: ["机械硬盘"], definition: "机械硬盘的容量、技术路线、供货与价格变化。" },
      { slug: "dram", name: "内存与 DRAM", group: "field", tags: ["内存/DRAM"], definition: "DRAM 与内存条的新品、颗粒、频率、产能与价格周期。" },
      { slug: "hifi", name: "HiFi 耳机与音频", group: "field", tags: ["HiFi耳机", "音频设备"], definition: "耳机、耳放、解码与音频设备的新品、测量与使用体验。" },
      { slug: "cpu-gpu", name: "CPU 与 GPU", group: "field", tags: ["CPU/GPU"], definition: "处理器与显卡的架构、规格、实测和供货变化。" },
    ],
    sourceIds: ["rss-storagereview", "rss-toms-hardware", "rss-techpowerup", "rss-thessdreview", "rss-igorslab", "rss-pcworld", "rss-soundguys"],
    important: ["SSD、机械硬盘、内存与 DRAM、CPU/GPU、HiFi 耳机与音频设备的新品规格与实测数据；价格、产能与供货的显著变化；固件问题、批次缺陷与召回", "带方法和数据的第三方实测即使不是行业大事也可以很高"],
    noise: ["只换配色或容量的小改款、无来源的跑分截图、「性价比首选」式推荐、电商价格波动截图，`sig ≤ 3`", "没有方法与数据的「更快、更惊艳」，`nov ≤ 3` 且 `cred ≤ 4`"],
  },
  {
    key: "acgn",
    label: "影视",
    section: "影视",
    tagColor: "violet",
    guide: "以影视作品为核心，四条线并列：日漫（日本电视动画、剧场版动画、日本漫画改编的影像作品）、国漫（国产网络动画、动画电影）、电影（院线与流媒体发行）、剧集与短剧（电视剧、网剧、竖屏短剧）。重点收官方定档、上映与播出的时间与平台、预告与主创阵容、票房与分账/版权合作、平台排播表、有实质影响的行业经营事件。综艺只在直接关联上述作品时收录；明星私生活与绯闻、粉丝吵架站队、影评打分与观后感、无官方来源的爆料不属于这里。游戏归「游戏」方向，不在这里。",
    scope: "日漫、国漫、电影、电视剧与短剧的官方定档上映、主创阵容、票房版权与排播动态",
    tags: ["日漫", "国漫", "电影", "剧集/短剧"],
    topics: [
      { slug: "kyoto-animation", name: "京都动画", group: "company", entityId: "kyoto-animation", aliases: ["京阿尼"], definition: "京都动画的新作企划、制作与上映消息。" },
      { slug: "anime", name: "日漫", group: "field", tags: ["日漫"], definition: "日本电视动画、剧场版动画与漫画改编影像作品的官方企划、定档、制作阵容与上映消息。" },
      { slug: "guoman", name: "国漫", group: "field", tags: ["国漫"], definition: "中国国产网络动画、动画电影的官方企划、定档、播出、票房与版权消息。" },
      { slug: "cinema", name: "电影", group: "field", tags: ["电影"], definition: "院线与流媒体电影的定档、上映、票房、主创与版权消息。" },
      { slug: "drama", name: "剧集与短剧", group: "field", tags: ["剧集/短剧"], definition: "电视剧、网剧与竖屏短剧的开机、定档、排播、完结与平台数据。" },
    ],
    sourceIds: ["rss-ann-news", "rss-ann-newsroom", "rss-ann-press-release"],
    important: ["日漫、国漫、电影、电视剧与短剧的官方定档上映、主创阵容、票房与版权合作、平台排播与有实质影响的行业经营事件"],
    noise: ["明星私生活与绯闻、粉丝吵架站队、影评打分与观后感、无官方来源的爆料，`sig ≤ 2`", "只有「即将公开」「敬请期待」，`nov ≤ 3` 且 `cred ≤ 4`"],
  },
  {
    key: "game",
    label: "游戏",
    section: "游戏",
    tagColor: "red",
    guide: "所有平台的游戏，不限品类：手游、主机（PS/Xbox/Switch）、PC（Steam/Epic）、独立游戏与电竞。看官方版本更新与赛季、新作公布与定档、测试与上线、重要联动与合作、赛事结果与赛制变化、版号与分级监管、厂商与行业经营（营收、并购、工作室重组与裁员）。二次元游戏仍在范围内，但不再是唯一重点，二次元动画漫画仍归「二次元」方向。外挂与封号公告、粉丝站队争吵、无官方来源的爆料与「内鬼」消息、纯攻略与配队推荐、抽卡晒卡不属于这里。",
    scope: "手游、主机与 PC 游戏、独立游戏、电竞的版本更新、新作定档、测试上线、赛事与行业事件",
    tags: ["手游", "主机/PC", "独立游戏", "电竞赛事", "版号/监管", "厂商/行业", "版本更新"],
    topics: [
      { slug: "mobile-game", name: "手游", group: "field", tags: ["手游"], definition: "手机游戏的版本更新、新作上线与运营事件，含二次元与非二次元。" },
      { slug: "console-pc", name: "主机与 PC 游戏", group: "field", tags: ["主机/PC"], definition: "主机与 PC 游戏的新作公布、定档、发售与实机信息。" },
      { slug: "indie", name: "独立游戏", group: "field", tags: ["独立游戏"], definition: "独立游戏的上线、获奖与开发团队动向。" },
      { slug: "esports", name: "电竞赛事", group: "field", tags: ["电竞赛事"], definition: "赛事结果、赛制与规则变化、俱乐部与选手的重要变动。" },
      { slug: "game-policy", name: "版号与监管", group: "field", tags: ["版号/监管"], definition: "游戏版号发放、分级、未成年人保护与相关监管变化。" },
    ],
    sourceIds: [],
    important: ["官方版本更新与新内容、新作定档与发售、测试与上线、重要联动与合作", "版号发放与监管变化、赛事结果与赛制调整、电竞赛事的重要结构性变动", "有具体数字的营收、流水、并购、工作室重组与裁员"],
    noise: ["外挂与封号公告、粉丝站队争吵、无官方来源的爆料与「内鬼」消息、纯攻略与配队推荐、抽卡晒卡，`sig ≤ 3`", "只有「即将公布」「敬请期待」而无实质内容，`nov ≤ 3` 且 `cred ≤ 4`", "「业内人士称」式的传闻与二手转载，`cred ≤ 3`"],
  },
  {
    key: "health",
    label: "健康",
    section: "健康",
    tagColor: "green",
    guide: "只收能落到日常行为与习惯上的健康信息——生理或心理：睡眠与作息、运动与活动量、饮食结构与进食习惯、久坐与屏幕时间、用眼与听力保护、压力与情绪管理、烟酒、防晒、体重管理，以及能直接换成做法的权威指南与疾控建议。一条内容必须有具体的做法、频率或量（比如每周多少分钟、每天多少克、多久起身一次），并写明适用人群与注意边界。纯机制研究、细胞与动物实验、单篇论文里没有行为含义的统计关联、药品与器械审批进展、医院科室介绍、养生营销与个案奇迹都不收。",
    scope: "可落地的健康行为与习惯：睡眠、运动、饮食、心理、久坐、用眼与日常防护，以及权威指南里的具体建议",
    tags: ["睡眠", "运动/活动量", "饮食/营养", "心理健康", "久坐/用眼", "指南/建议"],
    topics: [
      { slug: "who", name: "世界卫生组织", group: "company", entityId: "who", aliases: ["WHO"], definition: "WHO 的公共卫生建议、行为指南与健康风险提示。" },
      { slug: "sleep", name: "睡眠与作息", group: "field", tags: ["睡眠"], definition: "睡眠时长、作息规律与睡前习惯的可操作建议。" },
      { slug: "exercise", name: "运动与活动量", group: "field", tags: ["运动/活动量"], definition: "运动类型、强度、频率与日常活动量的建议。" },
      { slug: "diet", name: "饮食与营养", group: "field", tags: ["饮食/营养"], definition: "膳食结构、进食顺序与盐油糖摄入的行为建议。" },
      { slug: "mental", name: "心理健康", group: "field", tags: ["心理健康"], definition: "压力管理、情绪调节与睡眠心理卫生的可操作方法。" },
    ],
    sourceIds: ["rss-cdc-newsroom"],
    important: ["给出具体做法、频率或量的健康行为建议，来源是权威指南、疾控或高质量行为干预研究", "能直接改变日常习惯的结论：睡眠、运动、饮食、久坐、用眼、压力管理", "官方指南与公共卫生建议的更新，且能落到个人执行"],
    noise: ["纯机制研究、细胞与动物实验、单篇论文里没有行为含义的统计关联，`sig ≤ 3`", "药品与器械审批进展、医院与科室介绍、体检套餐推广，`sig ≤ 2`", "养生营销、个案奇迹、保健品软文、把相关性说成因果、泛泛而谈的「多运动多喝水」，`sig ≤ 2` 且 `cred ≤ 3`"],
  },
  {
    key: "deal",
    label: "薅羊毛",
    section: "薅羊毛",
    tagColor: "yellow",
    guide: "生活里真实可参与的省钱与免费机会：平台赠送会员或积分、限时免费与限量低价、免单与抽奖、免费餐饮（奶茶、咖啡等）、平台补贴与消费券、官方节日活动。一条必须写清平台、活动内容、参与或领取方式、有效期或名额、参与门槛与限制条件，且来自官方或可核实渠道。过期或虚假活动、需要拉人头发展下线、纯营销软文、无法核实的「内部券」、诱导分享、实际隐藏强制消费的伪免费不算。",
    scope: "生活可参与的优惠与免费活动：会员赠送、限时限量低价、免单抽奖、免费餐饮、平台补贴与消费券",
    tags: ["会员赠送", "限时低价", "免单/抽奖", "免费餐饮", "平台补贴", "优惠券"],
    topics: [
      { slug: "free-deals", name: "免费与免单", group: "field", tags: ["免单/抽奖", "免费餐饮"], definition: "官方可核实的免费领取、免单、抽奖与免费餐饮活动。" },
      { slug: "discounts", name: "限时低价与补贴", group: "field", tags: ["限时低价", "平台补贴"], definition: "限时限量的低价、平台补贴、消费券与会员赠送。" },
    ],
    sourceIds: [],
    important: ["官方或可核实渠道、在有效期内且真实可参与的优惠与免费活动", "信息完整：平台、活动内容、领取或参与方式、有效期或名额、门槛与限制写清楚", "能真正省钱或免费获得，且无需强制消费、不拉人头", "本方向不设每轮条数上限，可发多条，但每条都必须真实有用、与生活相关，不凑量"],
    noise: ["过期或虚假活动、无法核实的「内部券」、纯营销软文，`cred ≤ 3`", "拉人头发展下线、诱导分享、实际隐藏强制消费的伪免费，`sig ≤ 2`", "没有明确时间、名额或参与方式的模糊活动预告，`nov ≤ 3`"],
  },
];

/** 不属于某个具体方向、全站共用的配置与规则。 */
export const SHARED = {
  groups: [
    { key: "company", name: "机构与厂商", blurb: "按主管部门、研究机构与厂商追踪动态" },
    { key: "field", name: "关注方向", blurb: "按细分方向深挖：存储、内存、耳机、新番、临床研究……" },
    { key: "genre", name: "内容形态", blurb: "按体裁浏览：政策文件、独立实测、论文、教程……" },
  ] as const,

  /** 每篇资料第一个标签必须来自这里；描述内容形态，不随方向增减。 */
  categoryTags: [
    "政策/文件", "技术发布", "硬件新品", "实测/评测", "价格/供货", "研究/论文",
    "作品/企划", "行业动态", "教程/实践", "观点/评论", "健康/指南", "其他",
  ] as const,

  /** 可选实体标签白名单。新增方向的机构时，在这里和 entities 里一起补。 */
  entityTags: [
    "教育部", "WHO", "FDA", "国家药监局", "OpenAI", "Google", "Microsoft", "GitHub", "NVIDIA",
    "三星", "SK海力士", "美光", "西部数据", "希捷", "铠侠", "森海塞尔", "索尼", "京都动画", "集英社",
  ] as const,

  tagSynonyms: {
    政策法规: "政策/文件", 新规: "政策/文件", 通知: "政策/文件", 规划: "政策/文件",
    发布: "技术发布", 上新: "硬件新品", 新品: "硬件新品", 开售: "硬件新品",
    评测: "实测/评测", 实测: "实测/评测", 跑分: "实测/评测", 横评: "实测/评测",
    降价: "价格/供货", 涨价: "价格/供货", 行情: "价格/供货", 缺货: "价格/供货", 产能: "价格/供货",
    论文: "研究/论文", 研究: "研究/论文", 临床试验: "研究/论文", 考古发现: "研究/论文",
    新番: "作品/企划", 动画化: "作品/企划", 企划: "作品/企划", 定档: "作品/企划",
    教程: "教程/实践", 指南: "教程/实践", 科普: "教程/实践", 玩法: "教程/实践",
    观点: "观点/评论", 评论: "观点/评论", 社论: "观点/评论",
    固态硬盘: "存储/SSD", 硬盘: "机械硬盘", 内存: "内存/DRAM", 耳机: "HiFi耳机",
  } as Record<string, string>,

  plainTerms: ["ai", "api", "cpu", "gpu", "ssd", "hdd", "nvme", "dram", "ram", "pc", "os", "usb", "rss", "who", "fda", "nmpa", "cdc", "unesco", "acgn", "anime", "sci", "ssci", "ipo", "ceo"] as readonly string[],

  /** 内容类型决定五维权重，写在 selection-score.md 的权重表里；是内容形态，不是方向。 */
  itemTypes: [
    "policy_document", "tech_release", "hardware_launch", "benchmark_review", "market_price",
    "research_finding", "creative_release", "industry_event", "opinion_analysis", "tutorial_explainer",
  ] as const,

  /** 主体名录。company 主题页用 entityId 引用它。 */
  entities: {
    moe: { name: "教育部", displayTag: "教育部", aliases: ["教育部", "中华人民共和国教育部"], orgNames: ["教育部"] },
    unesco: { name: "联合国教科文组织", displayTag: null, aliases: ["UNESCO", "联合国教科文组织"] },
    who: { name: "世界卫生组织", displayTag: "WHO", aliases: ["WHO", "世界卫生组织"] },
    fda: { name: "美国 FDA", displayTag: "FDA", aliases: ["FDA", "美国食品药品监督管理局"] },
    nmpa: { name: "国家药监局", displayTag: "国家药监局", aliases: ["NMPA", "国家药监局", "国家药品监督管理局"] },
    openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT"], orgNames: ["OpenAI"] },
    google: { name: "Google", displayTag: "Google", aliases: ["Google", "谷歌", "DeepMind", "Gemini"] },
    microsoft: { name: "Microsoft", displayTag: "Microsoft", aliases: ["Microsoft", "微软"] },
    github: { name: "GitHub", displayTag: "GitHub", aliases: ["GitHub"] },
    nvidia: { name: "NVIDIA", displayTag: null, aliases: ["NVIDIA", "英伟达"] },
    samsung: { name: "三星电子", displayTag: null, aliases: ["Samsung", "三星", "Samsung Electronics"] },
    "sk-hynix": { name: "SK 海力士", displayTag: null, aliases: ["SK hynix", "SK海力士", "海力士"] },
    micron: { name: "美光", displayTag: null, aliases: ["Micron", "美光"] },
    "western-digital": { name: "西部数据", displayTag: null, aliases: ["Western Digital", "WD", "西部数据", "SanDisk", "闪迪"] },
    seagate: { name: "希捷", displayTag: null, aliases: ["Seagate", "希捷"] },
    kioxia: { name: "铠侠", displayTag: null, aliases: ["Kioxia", "铠侠", "东芝存储"] },
    sennheiser: { name: "森海塞尔", displayTag: null, aliases: ["Sennheiser", "森海塞尔"] },
    sony: { name: "索尼", displayTag: null, aliases: ["Sony", "索尼"] },
    "kyoto-animation": { name: "京都动画", displayTag: null, aliases: ["京都动画", "京阿尼", "Kyoto Animation"] },
    shueisha: { name: "集英社", displayTag: null, aliases: ["集英社", "Shueisha"] },
  } as Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }>,

  /** 跨方向通用主题页：按体裁浏览，不随方向增减。 */
  genreTopics: [
    { slug: "review", name: "独立实测", group: "genre", tags: ["实测/评测"], definition: "有方法、有数据的第三方评测与横评，不含厂商通稿。" },
    { slug: "policy", name: "政策文件", group: "genre", tags: ["政策/文件"], definition: "主管部门与机构发布的正式文件、公告与指南。" },
    { slug: "paper", name: "研究与论文", group: "genre", tags: ["研究/论文"], definition: "学术论文、研究报告与数据集的发布及结论。" },
    { slug: "howto", name: "教程与实践", group: "genre", tags: ["教程/实践"], definition: "可复用的方法、设置、选购思路与动手实践。" },
    { slug: "price", name: "价格与供货", group: "genre", tags: ["价格/供货"], definition: "硬件与内容产品的价格、产能、缺货与渠道变化。" },
    { slug: "opinion", name: "观点与评论", group: "genre", tags: ["观点/评论"], definition: "有新事实或新框架的解释、评论与长访谈。" },
  ] as readonly DomainTopic[],

  /** 评分标准里跨方向通用的价值与噪声。 */
  important: [
    "能立即复用的方法、教程与选购思路，只要具体、清楚并有可迁移价值",
    "可信的新事实、反直觉结果与文化反差，只要读者一眼能理解「为什么有意思」",
  ] as readonly string[],
  noise: [
    "营销与带货：厂商通稿只列参数不给实测、导购清单、课程与培训广告、活动与限免、招聘、模糊路线图，`sig ≤ 2`",
    "预告、抢先体验或「即将推出」没有实质参数与可验证内容，`nov ≤ 3` 且 `cred ≤ 4`",
    "新闻摘要合集、早报、周报等多事件打包且没有单一焦点，`sig ≤ 3`",
    "例行小版本、语言或地区补齐、平台上架、普通修复，`sig ≤ 3`",
    "宏大观点若没有新事实、新因果或可复用框架，融资、会面、成立委员会若没有已兑现后果，均应明显低分",
  ] as readonly string[],
};
