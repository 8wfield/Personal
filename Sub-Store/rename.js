/**
 * Sub-Store 节点重命名
 * 用法：在 Sub-Store 脚本操作中添加此脚本
 * 参数格式：以 # 开头，多个参数用 & 连接
 *
 * @author Minis
 * @date   2026-09-25
 *
 * 输出格式
 *
 *   🇭🇰 机场名 香港¹ [家宽 IPLC 0.1X]
 *    │   │      │   └─ 标签 + 倍率，全部关闭时不出现括号
 *    │   │      └────── 地区名 + 上标序号（写法由 out 决定）
 *    │   └────────────── 机场名（name）
 *    └────────────────── 国旗（flag）
 *
 *   各段用单个空格连接，未开启的段整段省略（不留空位）。
 *
 * 参数（$arguments，全部可选）
 *
 *   in        输入地区名写法：quan 全称 / en|us 缩写 / cn|zh 中文 / gq|flag 国旗
 *   out       输出地区名写法，取值同 in，默认 cn；台湾一律显示为 🇨🇳
 *   name      机场名，默认接在国旗后面
 *   nf        name 提到国旗前面
 *   flag      加国旗前缀；out=gq 时地区本身就是国旗，不再重复添加
 *   one       该地区只有 1 个节点时省略序号
 *   bl        解析倍率写入标签，1X 与无倍率不写
 *   blkey     自定义标签，+ 分隔；写成 A>B 表示把标签 A 改名为 B
 *   blgd      自动识别线路标签：家宽 / IPLC / BGP / CN2 / CMI / 机房 /
 *             CERNET / 静态 / 三线 / 专线 / 游戏加速
 *   clear     丢弃名中含套餐、到期、流量、客服等杂字的节点
 *   nx        只保留无倍率或 1X 的节点
 *   blnx      只保留倍率大于 1 的节点
 *   key       只保留名中含「关键 / key」的节点
 *   nm        保留无法识别地区的节点（前缀 + 原名），不加序号；默认丢弃
 *   blockquic on / off 写入 block-quic，不填则删除该字段
 *
 * 其它
 *
 *   地区别名表 rurekey 会把深港、Los Angeles 一类写法归一到标准地区名后再匹配。
 *   地区名匹配大小写不敏感（hk01 / RUSSIA01 / SINGAPORE01 均可识别）。
 *   节点排序：香港 → 台湾 → 日本 → 韩国 → 新加坡 → 美国 靠前，其余保持原有顺序。
 */
const $a = $arguments,
  nx = !!$a.nx,
  bl = !!$a.bl,
  nf = !!$a.nf,
  key = !!$a.key,
  blgd = !!$a.blgd,
  blnx = !!$a.blnx,
  numone = !!$a.one,
  clear = !!$a.clear,
  addflag = !!$a.flag,
  nm = !!$a.nm,
  dec = v => {
    try {
      return decodeURI(v);
    } catch (e) {
      return v;
    }
  },
  FNAME = $a.name == undefined ? "" : dec($a.name),
  BLKEY = $a.blkey == undefined ? "" : dec($a.blkey),
  blockquic = $a.blockquic == undefined ? "" : dec($a.blockquic),
  INMAP = {
    cn: "cn",
    zh: "cn",
    us: "us",
    en: "us",
    quan: "quan",
    gq: "gq",
    flag: "gq",
  },
  inname = INMAP[$a.in] || "",
  outname = INMAP[$a.out] || "";
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱'];
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来西亚','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];

const nameclear = /(套餐|到期|有效|剩余|版本|已用|过期|失联|测试|官方|网址|备用|群|TEST|客服|网站|获取|订阅|流量|机场|下次|官址|联系|邮箱|工单|学术|USE|USED|TOTAL|EXPIRE|EMAIL|GB)/i,
  keya = /关键|\bkey/i,
  rstrict = /(\d+(?:\.\d+)?)[xX×倍]|[xX×倍]\s*(\d+(?:\.\d+)?)/,
  rloose = /(\d+(?:\.\d+)?)\s+[xX×倍]/,
  SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹",
  SORTMAP = [
    ["香港", /香港|HK|Hong|🇭🇰/],
    ["台湾", /台湾|TW|Taiwan|🇹🇼|🇨🇳/],
    ["日本", /日本|JP|Japan|🇯🇵/],
    ["韩国", /韩国|KR|\bKorea\b|🇰🇷/],
    ["新加坡", /新加坡|SG|Singapore|🇸🇬/],
    ["美国", /美国|US|United States|🇺🇸/],
  ],
  SORT = SORTMAP.map(e => e[0]),
  GD = [
    [/家宽|家庭宽带/i, "家宽"],
    [/IPLC/i, "IPLC"],
    [/B-G-P|BGP/i, "BGP"],
    [/CN2/i, "CN2"],
    [/CMI/i, "CMI"],
    [/机房|IDC/i, "机房"],
    [/CERNET|教育网/i, "CERNET"],
    [/静态/i, "静态"],
    [/三线/i, "三线"],
    [/专线|骨干/i, "专线"],
    [/游戏|Gaming/i, "游戏加速"],
  ],
  rurekey = {
    GB: /UK/g,
    "B-G-P": /BGP/g,
    "Russia": /Moscow|莫斯科/gi,
    "Korea Chuncheon": /Chuncheon|Seoul/g,
    朝鲜: /North Korea/gi,
    "Hong Kong": /Hongkong|HONG KONG/gi,
    "United Kingdom London": /London|Great Britain/g,
    "Dubai United Arab Emirates": /United Arab Emirates|UAE/gi,
    "Taiwan TW 台湾 🇹🇼": /(台|Tai\s?wan|TW).*?🇨🇳|🇨🇳.*?(台|Tai\s?wan|TW)/g,
    "United States": /USA|Los Angeles|San Jose|Silicon Valley|Michigan/gi,
    美属维尔京群岛: /U\.?S\.?\s+Virgin Islands|USVI/gi,
    澳大利亚: /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳/g,
    德国: /(深|沪|呼|京|广|杭)德(?!.*(I|线))|法兰克福|滬德/g,
    香港: /(深|沪|呼|京|广|杭)港(?!.*(I|线))/g,
    日本: /(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))|东京|大坂|[tT][oO][kK][yY][oO]/g,
    新加坡: /狮城|(深|沪|呼|京|广|杭)新/g,
    美国: /(深|沪|呼|京|广|杭)美|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|芝加哥/g,
    G: /\d\s?GB/gi,
  };

const RURE = Object.entries(rurekey);

function reof(k) {
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(k.length <= 3 && /^[A-Za-z0-9]+$/.test(k) ? "\\b" + esc + "(?![A-Za-z])" : esc);
}

const OUTLIST = getList(outname),
  ALLMAP = {};

(inname ? [getList(inname)] : [ZH, FG, QC, EN]).forEach(arr => {
  arr.forEach((v, i) => {
    ALLMAP[v] = OUTLIST[i];
  });
});

const MKEY = Object.entries(ALLMAP),
  VLOW = new Map(MKEY.map(([k, v]) => [k.toLowerCase(), v])),
  PAT = new RegExp(MKEY.map(([k]) => reof(k).source).join("|"), "i");

function getr(n) {
  const m = n.match(rstrict) || n.match(rloose);
  if (!m) return null;
  const r = parseFloat(m[1] || m[2]);
  return r > 0 ? r : null;
}

function sup(n) {
  const s = String(n);
  let o = "";
  for (let i = 0; i < s.length; i++) o += SUP[s.charCodeAt(i) - 48];
  return o;
}

function sortkey(name) {
  for (let i = 0; i < SORTMAP.length; i++) {
    if (SORTMAP[i][1].test(name)) return SORTMAP[i][0];
  }
  return null;
}

function getList(arg) {
  if (arg === "us") return EN;
  if (arg === "gq") return FG;
  if (arg === "quan") return QC;
  return ZH;
}

function operator(pro) {
  if (clear || nx || blnx || key) {
    pro = pro.filter(res => {
      const n = res.name,
        r = getr(n);
      if (clear && nameclear.test(n)) return false;
      if (nx && !(r === null || r === 1)) return false;
      if (blnx && !(r !== null && r > 1)) return false;
      if (key && !keya.test(n)) return false;
      return true;
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : [];

  pro.forEach(e => {
    const ens = e.name;
    let n = ens;
    RURE.forEach(([to, re]) => {
      n = n.replace(re, to);
    });

    if (blockquic === "on") e["block-quic"] = "on";
    else if (blockquic === "off") e["block-quic"] = "off";
    else delete e["block-quic"];

    const tags = [];
    if (blgd) {
      GD.forEach(([re, label]) => {
        if (re.test(n) && !tags.includes(label)) tags.push(label);
      });
    }

    if (BLKEYS.length) {
      BLKEYS.filter(i => !i.includes(">")).forEach(i => {
        if (ens.includes(i) && !tags.includes(i)) tags.push(i);
      });
      BLKEYS.filter(i => i.includes(">")).forEach(i => {
        const p = i.split(">"),
          to = p[1] || p[0];
        if (ens.includes(p[0])) {
          const at = tags.indexOf(p[0]);
          if (at !== -1) tags[at] = to;
          else if (!tags.includes(to)) tags.push(to);
        }
      });
    }

    const extra = tags.slice();
    if (bl) {
      const r = getr(n);
      if (r !== null && r !== 1) extra.push(r + "X");
    }
    const bracket = extra.length ? "[" + extra.join(" ") + "]" : "",
      mm = PAT.exec(n);

    if (mm) {
      const v = VLOW.get(mm[0].toLowerCase());
      let region = v;
      if (outname === "gq") region = v === "🇹🇼" ? "🇨🇳" : v;
      const fi = OUTLIST.indexOf(v),
        flag = addflag && outname !== "gq" ? (FG[fi] === "🇹🇼" ? "🇨🇳" : FG[fi]) : "";
      e.name = region;
      e._base = region;
      e._head = [nf ? FNAME : flag, nf ? flag : FNAME].filter(Boolean).join(" ");
      e._bracket = bracket;
      e._sort = sortkey(region);
    } else if (nm) {
      e.name = (FNAME ? FNAME + "-" : "") + n;
    } else {
      e.name = null;
    }
  });

  pro = pro.filter(e => e.name !== null);

  pro.sort((a, b) => {
    const i = SORT.indexOf(a._sort),
      j = SORT.indexOf(b._sort);
    if (i === j) return 0;
    if (i === -1) return 1;
    if (j === -1) return -1;
    return i - j;
  });

  const out = [],
    groups = {},
    gk = [];
  pro.forEach(p => {
    const k = p._base || p.name;
    if (!groups[k]) {
      groups[k] = [];
      gk.push(k);
    }
    groups[k].push(p);
  });
  gk.forEach(k => {
    const g = groups[k];
    g.forEach((p, i) => {
      const q = Object.assign({}, p);
      ["_base", "_head", "_bracket", "_sort"].forEach(f => delete q[f]);
      q.name = [p._head, k + (p._base && !(g.length === 1 && numone) ? sup(i + 1) : ""), p._bracket].filter(Boolean).join(" ");
      out.push(q);
    });
  });

  pro.splice(0, pro.length, ...out);
  return pro;
}
