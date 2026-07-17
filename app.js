/* ============================================================================
   骏马 JUNMA dApp logic (ethers v6, vanilla). Read-only landing stats work without
   a wallet; staking / binding require a connection.
   ============================================================================ */
(function () {
  "use strict";

  const CFG = window.JUNMA_CONFIG;
  const ABIS = window.JUNMA_ABIS;
  const NET = CFG.networks[CFG.ACTIVE];
  const ZERO = "0x0000000000000000000000000000000000000000";
  const hasToken = NET.token && NET.token.toLowerCase() !== ZERO;
  const hasStaking = NET.staking && NET.staking.toLowerCase() !== ZERO;

  const el = (id) => document.getElementById(id);
  const roProvider = new ethers.JsonRpcProvider(NET.rpc, NET.chainId);

  let provider = null, signer = null, account = null;
  let tokenRO = null, stakingRO = null, tokenRW = null, stakingRW = null;

  if (hasToken) tokenRO = new ethers.Contract(NET.token, ABIS.token, roProvider);
  if (hasStaking) stakingRO = new ethers.Contract(NET.staking, ABIS.staking, roProvider);

  // ---------------- helpers ----------------
  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
  function fmtNum(x, dp) {
    dp = dp == null ? 2 : dp;
    if (!isFinite(x)) return "0";
    if (x >= 1e9) return (x / 1e9).toFixed(2) + "B";
    if (x >= 1e6) return (x / 1e6).toFixed(2) + "M";
    if (x >= 1e3) return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return x.toLocaleString(undefined, { maximumFractionDigits: dp });
  }
  const fmtTok = (bi, dp) => fmtNum(Number(ethers.formatUnits(bi, 18)), dp);
  const fmtBnb = (bi) => Number(ethers.formatEther(bi)).toLocaleString(undefined, { maximumFractionDigits: 4 });

  let toastTimer = null;
  function toast(msg, isErr) {
    const t = el("toast");
    t.textContent = msg;
    t.className = "show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ""), 3600);
  }

  // Robust copy: in-app browsers (wallet webviews) often block navigator.clipboard,
  // so fall back to selecting the field + execCommand, then to a manual long-press hint.
  async function copyRefLink() {
    const inp = el("refLink");
    const text = inp.value;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return toast("邀请链接已复制 ✓");
      }
    } catch (e) { /* fall through */ }
    try {
      inp.removeAttribute("readonly");
      inp.focus();
      inp.select();
      inp.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      inp.setAttribute("readonly", "");
      if (ok) return toast("邀请链接已复制 ✓");
    } catch (e) { /* fall through */ }
    // last resort: leave it selected so the user can long-press → Copy
    inp.removeAttribute("readonly");
    inp.focus();
    inp.select();
    toast("已选中链接,请长按选择“复制”", true);
  }

  // ---------------- static wiring ----------------
  function wireStatic() {
    if (hasToken) {
      el("tokenScanLink").href = NET.explorer + "/token/" + NET.token;
      el("chipToken").href = NET.explorer + "/address/" + NET.token;
      el("tokenAddrShort").textContent = short(NET.token);
    } else {
      el("tokenScanLink").classList.add("hidden");
    }
    if (hasStaking) {
      el("chipStaking").href = NET.explorer + "/address/" + NET.staking;
      el("stakingAddrShort").textContent = short(NET.staking);
    }
    // Social links only render once a real URL is set in config.js — no dead placeholder links.
    [["lnkTwitter", CFG.socials.twitter], ["lnkTelegram", CFG.socials.telegram]].forEach(function (pair) {
      const n = el(pair[0]);
      if (!n) return;
      if (pair[1]) {
        n.href = pair[1];
        n.classList.remove("hidden");
      } else {
        n.classList.add("hidden");
      }
    });
    el("netName").textContent = NET.name;
  }

  // ---------------- referral capture ----------------
  function captureRef() {
    const p = new URLSearchParams(location.search);
    const r = p.get("ref");
    if (r && ethers.isAddress(r)) localStorage.setItem("junma_ref", ethers.getAddress(r));
  }
  const storedRef = () => localStorage.getItem("junma_ref") || null;

  // ---------------- routing ----------------
  function showView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    document.querySelectorAll(".nav-links a").forEach((a) => a.classList.toggle("active", a.dataset.view === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "stake") refreshStake();
    if (name === "bind") refreshBind();
  }
  function wireNav() {
    document.querySelectorAll("[data-view]").forEach((n) =>
      n.addEventListener("click", (e) => { e.preventDefault(); showView(n.dataset.view); })
    );
  }

  // ---------------- wallet ----------------
  async function connect() {
    if (!window.ethereum) return toast("未检测到钱包,请安装 MetaMask / OKX / TokenPocket", true);
    try {
      provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      await ensureChain();
      signer = await provider.getSigner();
      account = await signer.getAddress();
      if (hasToken) tokenRW = new ethers.Contract(NET.token, ABIS.token, signer);
      if (hasStaking) stakingRW = new ethers.Contract(NET.staking, ABIS.staking, signer);
      onConnected();
    } catch (e) {
      toast(prettyErr(e), true);
    }
  }

  async function ensureChain() {
    const cur = await provider.send("eth_chainId", []);
    if (parseInt(cur, 16) === NET.chainId) return;
    try {
      await provider.send("wallet_switchEthereumChain", [{ chainId: NET.chainIdHex }]);
    } catch (e) {
      if (e && (e.code === 4902 || (e.data && e.data.originalError && e.data.originalError.code === 4902))) {
        await provider.send("wallet_addEthereumChain", [{
          chainId: NET.chainIdHex, chainName: NET.name, rpcUrls: [NET.rpc],
          nativeCurrency: NET.nativeCurrency, blockExplorerUrls: [NET.explorer],
        }]);
      } else throw e;
    }
  }

  function onConnected() {
    el("connectBtn").textContent = short(account);
    el("netChip").style.display = "inline-flex";
    el("gateConnect") && (el("stakeGate").classList.add("hidden"), el("stakePanel").classList.remove("hidden"));
    el("bindGate").classList.add("hidden");
    el("bindPanel").classList.remove("hidden");
    toast("钱包已连接");
    refreshStake();
    refreshBind();
    maybeAutoBind();
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.removeAllListeners && window.ethereum.removeAllListeners("accountsChanged");
      window.ethereum.on("accountsChanged", () => location.reload());
      window.ethereum.on("chainChanged", () => location.reload());
    }
  }

  function prettyErr(e) {
    const m = (e && (e.shortMessage || e.reason || e.message)) || "交易失败";
    if (/user rejected|denied/i.test(m)) return "已取消";
    if (/insufficient funds/i.test(m)) return "余额不足以支付 gas";
    if (/Pool insufficient/i.test(m)) return "奖励池余额不足,请稍后再试";
    if (/Staking closed/i.test(m)) return "质押已暂停";
    return m.length > 80 ? m.slice(0, 80) + "…" : m;
  }

  async function txRun(btn, label, fn) {
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> ' + label;
    try {
      const tx = await fn();
      await tx.wait();
      toast("成功 ✓");
      return true;
    } catch (e) {
      toast(prettyErr(e), true);
      return false;
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
    }
  }

  // ---------------- landing stats ----------------
  async function loadLandingStats() {
    try {
      if (hasToken) {
        const [burned, treasury] = await Promise.all([tokenRO.totalBurned(), tokenRO.treasuryBnb()]);
        el("stBurned").textContent = fmtTok(burned, 0);
        el("stTreasury").textContent = fmtBnb(treasury);
      }
      if (hasStaking) {
        const staked = await stakingRO.totalStaked();
        el("stStaked").textContent = fmtTok(staked, 0);
      }
    } catch (e) { /* addresses set but chain unreachable — leave placeholders */ }
  }

  // ---------------- stake view ----------------
  function wireStake() {
    el("gateConnect").addEventListener("click", connect);
    el("maxBtn").addEventListener("click", async () => {
      if (!account || !tokenRO) return;
      const b = await tokenRO.balanceOf(account);
      el("stakeAmt").value = ethers.formatUnits(b, 18);
      updatePreview();
    });
    el("stakeAmt").addEventListener("input", updatePreview);
    el("stakeBtn").addEventListener("click", doStake);
    el("claimAllBtn").addEventListener("click", doClaimAll);
  }

  function updatePreview() {
    const amt = parseFloat(el("stakeAmt").value || "0") || 0;
    const e = CFG.economics;
    el("pvInstant").textContent = fmtNum(amt * e.instantPct / 100) + " JUNMA";
    el("pvDaily").textContent = fmtNum(amt * e.dailyPct / 100) + " JUNMA / 天";
    el("pvTotal").textContent = fmtNum(amt) + " JUNMA";
    el("pvSum").textContent = fmtNum(amt * e.totalReturnPct / 100) + " JUNMA";
  }

  async function refreshStake() {
    if (!account || !hasStaking) return;
    try {
      const [bal, upline, open, pool] = await Promise.all([
        tokenRO.balanceOf(account), stakingRO.referrer(account), stakingRO.stakingOpen(), stakingRO.poolBalance(),
      ]);
      el("myBal").textContent = fmtTok(bal) + " JUNMA";
      const boundUp = upline !== ZERO ? upline : storedRef();
      el("myUpline").textContent = boundUp ? short(boundUp) : "无(可选)";
      el("stakeOpen").innerHTML = open ? '<span class="gold">开放中</span>' : '<span class="ember">已暂停</span>';
      el("poolNote").textContent = "奖励池余额: " + fmtTok(pool, 0) + " JUNMA";
      el("refNote").innerHTML = boundUp
        ? "推荐人已识别:<span class='addr gold'>" + short(boundUp) + "</span> · 首次质押自动绑定"
        : "支持多次质押,每笔订单独立计息、独立释放。";
      renderOrders();
    } catch (e) { /* ignore */ }
  }

  async function renderOrders() {
    const box = el("ordersList");
    let views;
    try { views = await stakingRO.getUserOrderViews(account); } catch (e) { return; }
    if (!views.length) { box.innerHTML = '<div class="note">还没有质押订单,质押后在此查看进度。</div>'; return; }
    box.innerHTML = "";
    views.forEach((o) => {
      const principal = fmtTok(o.principal);
      const days = Number(o.daysElapsed);
      const pct = Math.min(100, (days / CFG.economics.durationDays) * 100);
      const claimable = fmtTok(o.claimable);
      const done = days >= CFG.economics.durationDays;
      const c = document.createElement("div");
      c.className = "card order";
      c.innerHTML =
        '<div class="order-top"><span class="amt">' + principal + ' JUNMA</span>' +
        '<span class="day">第 ' + days + " / " + CFG.economics.durationDays + " 天" + (done ? " · 已完成" : "") + "</span></div>" +
        '<div class="bar"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        '<div class="order-foot"><span class="claimable">可领取 <b>' + claimable + "</b> JUNMA</span>" +
        '<button class="btn btn-primary btn-sm" ' + (Number(o.claimable) === 0 ? "disabled" : "") +
        ' data-oid="' + o.id.toString() + '">领取</button></div>';
      const btn = c.querySelector("button");
      btn.addEventListener("click", () => doClaim(btn, o.id));
      box.appendChild(c);
    });
  }

  async function doStake() {
    if (!account) return connect();
    const raw = el("stakeAmt").value;
    const amt = parseFloat(raw || "0");
    if (!amt || amt <= 0) return toast("请输入质押数量", true);
    let amountWei;
    try { amountWei = ethers.parseUnits(raw, 18); } catch (e) { return toast("数量格式错误", true); }

    const bal = await tokenRO.balanceOf(account);
    if (amountWei > bal) return toast("余额不足", true);

    // referrer: on-chain bound wins, else stored ref (self excluded)
    let upline = await stakingRO.referrer(account);
    if (upline === ZERO) {
      const r = storedRef();
      upline = r && r.toLowerCase() !== account.toLowerCase() ? r : ZERO;
    } else {
      upline = ZERO; // already bound; contract ignores the arg anyway
    }

    const allowance = await tokenRO.allowance(account, NET.staking);
    if (allowance < amountWei) {
      const ok = await txRun(el("stakeBtn"), "授权中…", () => tokenRW.approve(NET.staking, ethers.MaxUint256));
      if (!ok) return;
    }
    const ok = await txRun(el("stakeBtn"), "质押中…", () => stakingRW.stake(amountWei, upline));
    if (ok) { el("stakeAmt").value = ""; updatePreview(); refreshStake(); loadLandingStats(); }
  }

  async function doClaim(btn, oid) {
    if (await txRun(btn, "领取中…", () => stakingRW.claim(oid))) refreshStake();
  }
  async function doClaimAll() {
    if (await txRun(el("claimAllBtn"), "领取中…", () => stakingRW.claimAll())) refreshStake();
  }

  // ---------------- bind view ----------------
  function wireBind() {
    el("gateConnect2").addEventListener("click", connect);
    el("copyRef").addEventListener("click", () => copyRefLink());
    el("bindBtn").addEventListener("click", doBind);
  }

  async function refreshBind() {
    if (!account || !hasStaking) return;
    el("refLink").value = location.origin + location.pathname + "?ref=" + account;
    try {
      const [upline, dc, dv, earned, directs] = await Promise.all([
        stakingRO.referrer(account), stakingRO.directCount(account), stakingRO.directStaked(account),
        stakingRO.referralEarned(account), stakingRO.directsOf(account),
      ]);
      const bound = upline !== ZERO;
      el("uplineBound").classList.toggle("hidden", !bound);
      el("uplineUnbound").classList.toggle("hidden", bound);
      if (bound) el("bUpline").textContent = short(upline);
      else if (storedRef()) el("bindAddr").value = storedRef();

      el("tDirects").textContent = dc.toString();
      el("tVolume").textContent = fmtTok(dv, 0);
      el("tEarned").textContent = fmtTok(earned, 0);

      const list = el("directsList");
      if (!directs.length) list.innerHTML = '<div class="note">暂无直推,分享你的邀请链接吧。</div>';
      else list.innerHTML = directs.map((a, i) =>
        '<div class="team-row"><span>#' + (i + 1) + "</span><span class='addr'>" + short(a) + "</span></div>").join("");
    } catch (e) { /* ignore */ }
  }

  /// Visitor arrived through someone's ?ref= link: the moment their wallet connects, pop the bind
  /// signature for them. A true "bind just by opening the link" is impossible — binding is an
  /// on-chain tx that needs the visitor's own signature. If they decline here, their first stake
  /// still binds them automatically (belt and suspenders).
  async function maybeAutoBind() {
    if (!account || !hasStaking || !stakingRW) return;
    const r = storedRef();
    if (!r || r.toLowerCase() === account.toLowerCase()) return;
    try {
      if ((await stakingRO.referrer(account)) !== ZERO) return; // already bound — permanent
      toast("检测到推荐人 " + short(r) + ",请在钱包确认绑定");
      const tx = await stakingRW.bind(r);
      await tx.wait();
      toast("已绑定推荐人 ✓");
      refreshBind();
      refreshStake();
    } catch (e) {
      toast(prettyErr(e) + " · 首次质押时会自动绑定", true);
    }
  }

  async function doBind() {
    if (!account) return connect();
    const a = el("bindAddr").value.trim();
    if (!ethers.isAddress(a)) return toast("请输入有效地址", true);
    if (a.toLowerCase() === account.toLowerCase()) return toast("不能绑定自己", true);
    if (await txRun(el("bindBtn"), "绑定中…", () => stakingRW.bind(ethers.getAddress(a)))) refreshBind();
  }

  // ---------------- boot ----------------
  function boot() {
    wireStatic();
    captureRef();
    wireNav();
    wireStake();
    wireBind();
    el("connectBtn").addEventListener("click", connect);
    updatePreview();
    loadLandingStats();
    // auto-reconnect if already authorized
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then((accs) => { if (accs && accs.length) connect(); }).catch(() => {});
    }
    if (!hasStaking) toast("提示:合约地址未配置,请在 config.js 填入后启用交互");
  }

  boot();
})();
