# 骏马 JUNMA — 官网 + 质押 DApp

纯静态站(无构建步骤):Landing + 质押 + 绑定关系三页,ethers v6 已本地化(不依赖 CDN,墙内也能开)。

```
index.html    页面结构(三视图)
styles.css    黑金骏马主题
app.js        钱包 / 合约读写 / 推荐绑定
config.js     ← 上线前只需改这个文件
vendor/       ethers v6 (UMD)
```

## 上线前必改 `config.js`

```js
ACTIVE: "mainnet",              // 从 "testnet" 切到 "mainnet"

networks.mainnet.token:   "0x…" // 主网代币合约地址
networks.mainnet.staking: "0x…" // 主网质押合约地址

socials.twitter:  "https://x.com/你的账号"
socials.telegram: "https://t.me/你的群"
```

> 地址填 `0x000…0` 时,页面会显示「未部署」并停用交互——这是保护,不是 bug。

## 本地预览

```bash
python -m http.server 8799
# 打开 http://localhost:8799
```

## 部署到 Vercel

纯静态,**无需构建**:

1. 推到 GitHub 仓库
2. Vercel → New Project → 导入该仓库
3. Framework Preset: **Other**;Build Command: **留空**;Output Directory: **留空(根目录)**
4. Deploy

之后每次 `git push` 会自动重新部署。改完 `config.js` 提交即可生效。

## 邀请链接

绑定页会按当前域名自动生成:`https://你的域名/?ref=0x你的地址`

好友通过该链接进入 → 连钱包时自动弹出绑定签名;若他跳过,首次质押时会自动兜底绑定。绑定一次永久有效,不可更改。

## 说明

- 本仓库只包含公开信息(合约地址、ABI、公共 RPC),**不含任何私钥**。
- 质押为返本 + 每日释放 + 直推奖励模型,收益依赖资金池充裕度。
