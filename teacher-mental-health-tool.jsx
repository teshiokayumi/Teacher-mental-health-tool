import { useState, useEffect } from "react";

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      if (typeof window === "undefined") return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn("Error reading localStorage", error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn("Error setting localStorage", error);
    }
  };

  return [storedValue, setValue];
}

const C = {
  primary: "#2D6A4F", light: "#52B788", bg: "#D8F3DC", accent: "#1B4332",
  warn: "#E76F51", warnBg: "#FDEBD0", muted: "#6C757D",
  border: "#DEE2E6", pageBg: "#F8FBF9", white: "#FFFFFF", text: "#212529",
  textMuted: "#6C757D", danger: "#C0392B", dangerBg: "#FADBD8",
};

// ─── テキスト推定 ──────────────────────────────────────────
const INFERENCE_RULES = [
  { kw: ["頭から離れない", "考えてしまう", "ぐるぐる", "夢にも"], q: [0], add: 2 },
  { kw: ["保護者", "クレーム", "苦情", "モンスター"], q: [0, 2], add: 1 },
  { kw: ["業務", "仕事量", "追いつかない", "終わらない", "間に合わない"], q: [1], add: 2 },
  { kw: ["部活", "土日", "休日", "顧問", "残業", "帰れない"], q: [1], add: 2 },
  { kw: ["怒り", "イライラ", "感情的", "キレ", "怒鳴"], q: [2], add: 2 },
  { kw: ["疲れ", "しんどい", "きつい", "つらい", "消耗", "ヘトヘト"], q: [1, 3], add: 1 },
  { kw: ["眠れ", "不眠", "睡眠", "目が覚め", "寝られ", "夜中"], q: [3], add: 2 },
  { kw: ["限界", "もう無理", "辞めたい", "消えたい", "死にた", "追い詰め"], q: [4], add: 3 },
  { kw: ["理解されない", "孤独", "一人", "誰にも", "孤立"], q: [0, 4], add: 1 },
  { kw: ["怖い", "不安", "心配", "緊張", "プレッシャー"], q: [0], add: 1 },
];

function inferScoresFromText(text) {
  const base = [1, 1, 1, 1, 1];
  INFERENCE_RULES.forEach(({ kw, q, add }) => {
    if (kw.some((k) => text.includes(k)))
      q.forEach((qi) => { base[qi] = Math.min(5, base[qi] + add); });
  });
  return base;
}

function inferScoresFromWorkLog(workLog) {
  const total = Object.values(workLog).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const base = [1, 1, 1, 1, 1];
  if (total >= 60) base[1] = 5;
  else if (total >= 50) base[1] = 4;
  else if (total >= 45) base[1] = 3;
  else if (total >= 40) base[1] = 2;
  const parentH = workLog["parent"] || 0;
  if (parentH >= 10) { base[0] = Math.min(5, base[0] + 2); base[2] = Math.min(5, base[2] + 1); }
  else if (parentH >= 5) { base[0] = Math.min(5, base[0] + 1); }
  const clubH = workLog["club"] || 0;
  if (clubH >= 15) { base[1] = Math.min(5, base[1] + 1); base[3] = Math.min(5, base[3] + 1); }
  const adminH = workLog["admin"] || 0;
  if (adminH >= 15) base[1] = Math.min(5, base[1] + 1);
  if (total >= 60) base[4] = Math.min(5, base[4] + 1);
  return base;
}

function detectUrgent(text) {
  return ["限界", "もう無理", "消えたい", "死にた", "追い詰め"].some((k) => text.includes(k));
}

const SQ = [
  { label: "認知", text: "仕事のことが頭から離れない時間が多い" },
  { label: "負荷", text: "業務量が多く、終わりが見えない感覚がある" },
  { label: "感情", text: "子どもや同僚につい感情的になってしまった" },
  { label: "身体", text: "睡眠が浅い、または眠れない夜があった" },
  { label: "限界感", text: "「もう限界かも」と感じる瞬間があった" },
];

const CONTACTS = [
  {
    id: "counselor", title: "スクールカウンセラー", icon: "🧑‍⚕️",
    trigger: (s, h) => s.some((v) => v >= 3), urgency: "medium",
    desc: "校内配置の心理専門家。秘密は守られます。「少し話したいことがある」と養護教諭経由で申し込めます。",
    howto: "① 養護教諭か教頭に「スクールカウンセラーに相談したい」と伝える\n② 週1回の来校日に30〜50分の面談",
    available: "週1〜2回・無料・校内"
  },
  {
    id: "sangyoi", title: "産業医・産業カウンセラー", icon: "🏥",
    trigger: (s, h) => s[3] >= 3 || s[1] >= 4 || h >= 55, urgency: "medium",
    desc: "睡眠や身体症状、長時間労働が続いている場合に有効。業務調整の助言ももらえます。",
    howto: "① 人事・教育企画課に「産業医への相談」を申し込む\n② 週あたりの勤務時間のメモを持参すると話が早い",
    available: "要予約・無料・勤務時間内"
  },
  {
    id: "hotline", title: "教員相談ホットライン", icon: "📞",
    trigger: (s, h) => s[4] >= 3 || s.reduce((a, b) => a + b, 0) >= 15, urgency: "high",
    desc: "教職員専用の無料相談窓口。匿名で電話でき、職場に知られることはありません。",
    howto: "電話するだけ。名前不要。\n「何から話せばいいか」も含めて受け付けています。",
    available: "0120-053-077 ／ 平日9〜17時・無料"
  },
  {
    id: "yorisoi", title: "よりそいホットライン", icon: "🌙",
    trigger: (s, h) => s[4] >= 4, urgency: "urgent",
    desc: "24時間対応。「限界」「消えたい」という気持ちがあるときにすぐ電話できます。",
    howto: "今すぐ電話。名前不要。深夜・休日も対応。",
    available: "0120-279-338 ／ 24時間・無料"
  },
];

function stressLevel(avg) {
  if (avg <= 1.8) return { label: "良好", color: "#40916C", bg: "#D8F3DC" };
  if (avg <= 2.8) return { label: "やや注意", color: "#E67E22", bg: "#FDEBD0" };
  if (avg <= 3.8) return { label: "注意が必要", color: C.warn, bg: C.warnBg };
  return { label: "要相談", color: C.danger, bg: C.dangerBg };
}

const WORK_CATEGORIES = [
  { id: "class", label: "授業準備・実施", icon: "📚", color: "#52B788" },
  { id: "homeroom", label: "学級経営・生徒対応", icon: "👥", color: "#3A86FF" },
  { id: "parent", label: "保護者対応", icon: "📞", color: "#E76F51" },
  { id: "club", label: "部活動", icon: "🏃", color: "#8338EC" },
  { id: "admin", label: "校務・事務作業", icon: "📋", color: "#FB8500" },
  { id: "meeting", label: "会議・研修", icon: "🗣️", color: "#06D6A0" },
];

// ─── ダミーデータ（管理職ダッシュボード用） ───────────────
// 実運用ではサーバー集計が必要。ここではデモデータを表示。
const DEMO_SCHOOL = {
  name: "○○中学校（デモデータ）",
  period: "2026年4月",
  totalUsers: 24,
  activeUsers: 18,
  weeklyAvg: [2.1, 2.4, 2.8, 3.1], // 過去4週
  weekLabels: ["3週前", "2週前", "先週", "今週"],
  scoreDistribution: [
    { label: "良好（〜1.8）", count: 6, color: "#40916C" },
    { label: "やや注意（〜2.8）", count: 7, color: "#E67E22" },
    { label: "注意が必要（〜3.8）", count: 4, color: "#E76F51" },
    { label: "要相談（3.9〜）", count: 1, color: "#C0392B" },
  ],
  topStressFactors: [
    { label: "業務量・負荷", pct: 68, color: "#E76F51" },
    { label: "保護者対応", pct: 52, color: "#8338EC" },
    { label: "認知（頭から離れない）", pct: 41, color: "#E67E22" },
    { label: "睡眠・身体", pct: 35, color: "#3A86FF" },
    { label: "限界感", pct: 18, color: "#C0392B" },
  ],
  avgWorkHours: 51.2,
  workHoursByCategory: [
    { label: "授業準備・実施", h: 22.1, color: "#52B788" },
    { label: "校務・事務", h: 9.8, color: "#FB8500" },
    { label: "部活動", h: 8.4, color: "#8338EC" },
    { label: "学級経営", h: 6.2, color: "#3A86FF" },
    { label: "保護者対応", h: 3.1, color: "#E76F51" },
    { label: "会議・研修", h: 1.6, color: "#06D6A0" },
  ],
  alerts: [
    { type: "danger", msg: "限界感スコア4以上の職員が1名確認されています。早急なフォローを推奨します。" },
    { type: "warn", msg: "業務ログ平均51.2時間は3週連続上昇中です。業務配分の見直しを検討してください。" },
    { type: "info", msg: "保護者対応を主因とするストレスが先週比+12%増加しています。" },
  ],
  improvements: [
    { phase: "即時対応", icon: "🔴", actions: ["限界感スコア高の職員に個別声かけ（直接・非公式に）", "スクールカウンセラーの面談枠を緊急確保"] },
    { phase: "今月中", icon: "🟡", actions: ["部活顧問の業務時間を職員会議で共有・見直し協議", "校務分掌の集中箇所を洗い出し再配分を検討"] },
    { phase: "来学期", icon: "🟢", actions: ["ストレスチェック推移を人事配置の参考情報として活用", "業務削減候補の洗い出しと実施計画策定"] },
  ],
};

// ─── ContactCard ─────────────────────────────────────────
function ContactCard({ contact }) {
  const [open, setOpen] = useState(false);
  const uc = contact.urgency === "urgent" ? C.danger : contact.urgency === "high" ? C.warn : C.primary;
  const ubg = contact.urgency === "urgent" ? C.dangerBg : contact.urgency === "high" ? C.warnBg : C.bg;
  return (
    <div style={{ border: `1px solid ${uc}`, borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: ubg }}>
        <span style={{ fontSize: 20 }}>{contact.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: uc }}>{contact.title}</div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{contact.available}</div>
        </div>
        <span style={{ fontSize: 14, color: uc }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "12px 14px", background: C.white, borderTop: `1px solid ${uc}` }}>
          <div style={{ fontSize: 13, lineHeight: 1.75, color: C.text, marginBottom: 10 }}>{contact.desc}</div>
          <div style={{ background: C.pageBg, borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>相談の仕方</div>
            <pre style={{ fontSize: 12, lineHeight: 1.8, color: C.text, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0 }}>{contact.howto}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ChatTab ─────────────────────────────────────────────
function ChatTab({ onTransferToStress }) {
  const [input, setInput] = useLocalStorage("tmh_chat_input", "");
  function handleSubmit() {
    if (!input.trim()) return;
    onTransferToStress(inferScoresFromText(input), detectUrgent(input), "text");
  }
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: C.bg, borderRadius: 8, padding: "9px 14px", fontSize: 12, color: C.accent, textAlign: "center", marginBottom: 16 }}>
        このツールは匿名です。入力内容は外部に送信・記録されません。
      </div>
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🌿</div>
          <div style={{ background: "#F0F7F4", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", fontSize: 13, lineHeight: 1.75, color: C.text, flex: 1 }}>
            今日あったこと、しんどいと感じていることを書いてください。<br />
            <span style={{ fontSize: 12, color: C.muted }}>内容を分析して、ストレスチェックに自動で連携します。</span>
          </div>
        </div>
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={"例：保護者からのクレームが続いていて、職場に行くのが怖くなってきた\n例：部活と校務が重なって、睡眠が3〜4時間しかとれていない\n例：誰にも相談できず、限界かもしれない"}
          style={{ width: "100%", minHeight: 110, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, lineHeight: 1.7, fontFamily: "inherit", resize: "vertical", outline: "none", color: C.text, background: C.white }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <div style={{ fontSize: 11, color: C.muted }}>{input.length}文字</div>
          <button onClick={handleSubmit} disabled={!input.trim()}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: input.trim() ? C.primary : C.border, color: C.white, fontWeight: 600, fontSize: 14, cursor: input.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            チェックに連携する →
          </button>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 7 }}>例文から選ぶ</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["保護者対応が怖くなってきた", "眠れない夜が続いている", "部活で土日が全くない", "もう限界かもしれない", "誰にも理解してもらえない"].map((q) => (
            <button key={q} onClick={() => setInput(q)}
              style={{ background: C.pageBg, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── StressTab ───────────────────────────────────────────
function StressTab({ presetScores, urgent, presetSource, totalWorkH, clearPreset }) {
  const [answers, setAnswers] = useLocalStorage("tmh_stress_answers", [1, 1, 1, 1, 1]);
  const [submitted, setSubmitted] = useLocalStorage("tmh_stress_submitted", false);
  const [history] = useState([
    { week: "3週前", score: 2.1 }, { week: "2週前", score: 2.8 }, { week: "先週", score: 3.2 },
  ]);

  useEffect(() => {
    if (presetScores) {
      setAnswers(presetScores);
      setSubmitted(false);
    }
  }, [presetScores, setAnswers, setSubmitted]);

  const avg = Math.round((answers.reduce((a, b) => a + b, 0) / answers.length) * 10) / 10;
  const lv = stressLevel(avg);
  const recommended = CONTACTS.filter((c) => c.trigger(answers, totalWorkH));

  return (
    <div style={{ padding: 16 }}>
      {presetScores && !submitted && (
        <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.accent, lineHeight: 1.6 }}>
          ✅ {presetSource === "worklog" ? "業務ログ" : "入力内容"}からスコアを推定して自動入力しました。実際の感覚と違う場合は修正できます。
        </div>
      )}
      {urgent && (
        <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: C.danger, fontWeight: 600, lineHeight: 1.6 }}>
          ⚠ 入力内容に「限界」を示すキーワードが含まれていました。チェック後、相談窓口を必ず確認してください。
        </div>
      )}
      {presetSource === "worklog" && totalWorkH > 0 && !submitted && (
        <div style={{ background: C.warnBg, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#7D4E00", lineHeight: 1.6 }}>
          ⏱ 業務ログの合計 <strong>{totalWorkH}時間</strong> をもとに負荷スコアを算出しました。
          {totalWorkH >= 55 && "　産業医への相談が推奨される水準です。"}
        </div>
      )}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>今週のストレスチェック</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>1＝まったくない　5＝とてもある</div>
        {SQ.map((q, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ background: C.bg, color: C.primary, fontSize: 10, padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>{q.label}</span>
                {q.text}
              </div>
              {presetScores && <span style={{ fontSize: 10, color: C.muted, marginLeft: 8, flexShrink: 0 }}>推定: {presetScores[i]}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} onClick={() => { if (!submitted) setAnswers((p) => { const n = [...p]; n[i] = v; return n; }); }}
                  style={{ flex: 1, height: 40, borderRadius: 8, border: `2px solid ${answers[i] === v ? C.primary : C.border}`, background: answers[i] === v ? C.primary : C.white, color: answers[i] === v ? C.white : C.muted, cursor: submitted ? "default" : "pointer", fontWeight: 600, fontSize: 14, transition: "all 0.15s", fontFamily: "inherit" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!submitted ? (
          <button onClick={() => setSubmitted(true)}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: C.primary, color: C.white, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            チェック結果を見る
          </button>
        ) : (
          <div>
            <div style={{ textAlign: "center", padding: "20px 0 12px" }}>
              <div style={{ fontSize: 52, fontWeight: 700, color: lv.color }}>{avg}</div>
              <div style={{ background: lv.bg, color: lv.color, borderRadius: 20, padding: "4px 18px", display: "inline-block", fontWeight: 600, fontSize: 14, marginTop: 8 }}>{lv.label}</div>
            </div>
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              {SQ.map((q, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 40, fontSize: 10, color: C.textMuted, flexShrink: 0 }}>{q.label}</div>
                  <div style={{ flex: 1, height: 16, background: C.pageBg, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((answers[i] / 5) * 100)}%`, height: "100%", borderRadius: 8, background: answers[i] >= 4 ? C.danger : answers[i] >= 3 ? C.warn : C.primary, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ width: 16, fontSize: 12, fontWeight: 600, color: answers[i] >= 4 ? C.danger : answers[i] >= 3 ? C.warn : C.primary }}>{answers[i]}</div>
                </div>
              ))}
            </div>
            {presetSource === "worklog" && totalWorkH > 0 && (
              <div style={{ background: totalWorkH >= 55 ? C.dangerBg : totalWorkH >= 45 ? C.warnBg : C.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: totalWorkH >= 55 ? C.danger : totalWorkH >= 45 ? "#7D4E00" : C.accent, lineHeight: 1.6 }}>
                ⏱ 今週の業務合計: <strong>{totalWorkH}時間</strong>{totalWorkH >= 55 ? "　— 業務量も相談先の判断に含めています" : ""}
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 10 }}>過去との推移</div>
              {[...history, { week: "今週", score: avg }].map((w, i) => {
                const l = stressLevel(w.score);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 44, fontSize: 11, color: C.textMuted, flexShrink: 0 }}>{w.week}</div>
                    <div style={{ flex: 1, height: 18, background: C.pageBg, borderRadius: 9, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((w.score / 5) * 100)}%`, height: "100%", background: l.color, borderRadius: 9, transition: "width 0.5s" }} />
                    </div>
                    <div style={{ width: 26, fontSize: 12, fontWeight: 600, color: l.color }}>{w.score}</div>
                  </div>
                );
              })}
            </div>
            {recommended.length > 0 ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
                  <br />あなたの状態に合った相談先
                </div>
                {recommended.map((c) => <ContactCard key={c.id} contact={c} />)}
              </div>
            ) : (
              <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.accent, lineHeight: 1.6 }}>
                今週は比較的良い状態のようです。引き続き週次チェックで変化を把握しましょう。
              </div>
            )}
            <button onClick={() => { setAnswers([1, 1, 1, 1, 1]); setSubmitted(false); clearPreset(); }}
              style={{ width: "100%", padding: 10, marginTop: 16, borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              もう一度入力する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WorkLogTab ───────────────────────────────────────────
function WorkLogTab({ workLog, setWorkLog, onTransferToStress }) {
  const [workInput, setWorkInput] = useState({});
  const totalWork = Math.round(Object.values(workLog).reduce((a, b) => a + b, 0) * 10) / 10;
  const maxWork = Math.max(...Object.values(workLog), 1);

  function addWork(catId) {
    const h = parseFloat(workInput[catId] || 0);
    if (!h || h <= 0) return;
    setWorkLog((p) => ({ ...p, [catId]: Math.round(((p[catId] || 0) + h) * 10) / 10 }));
    setWorkInput((p) => ({ ...p, [catId]: "" }));
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>今週の業務時間ログ</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>カテゴリー別に時間を入力して偏りを把握します</div>
        {WORK_CATEGORIES.map((cat) => (
          <div key={cat.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15 }}>{cat.icon}</span>
              <span style={{ fontSize: 13, flex: 1 }}>{cat.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: workLog[cat.id] ? cat.color : C.muted, minWidth: 40, textAlign: "right" }}>
                {workLog[cat.id] ? `${workLog[cat.id]}h` : "0h"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" min="0" step="0.5" value={workInput[cat.id] || ""}
                onChange={(e) => setWorkInput((p) => ({ ...p, [cat.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addWork(cat.id)}
                placeholder="時間を追加"
                style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", background: C.white, color: C.text }} />
              <button onClick={() => addWork(cat.id)}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: cat.color, color: C.white, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
                追加
              </button>
            </div>
            {workLog[cat.id] > 0 && (
              <div style={{ marginTop: 6, height: 5, background: C.pageBg, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(Math.round((workLog[cat.id] / maxWork) * 100), 100)}%`, height: "100%", background: cat.color, borderRadius: 3, transition: "width 0.4s" }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {totalWork > 0 && (
        <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>今週の業務分布</div>
          {WORK_CATEGORIES.filter((c) => workLog[c.id] > 0).sort((a, b) => (workLog[b.id] || 0) - (workLog[a.id] || 0)).map((cat) => {
            const pct = Math.round(((workLog[cat.id] || 0) / totalWork) * 100);
            return (
              <div key={cat.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span>{cat.icon} {cat.label}</span>
                  <span style={{ color: cat.color, fontWeight: 600 }}>{workLog[cat.id]}h ({pct}%)</span>
                </div>
                <div style={{ height: 8, background: C.pageBg, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: cat.color, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: totalWork >= 55 ? C.dangerBg : totalWork >= 45 ? C.warnBg : C.bg }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: totalWork >= 60 ? C.danger : totalWork >= 45 ? C.warn : "#40916C" }}>
              今週の合計: {totalWork}時間
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {totalWork >= 60 ? "⚠ 業務時間がかなり多い状態です。産業医への相談を検討してください。"
                : totalWork >= 45 ? "業務が集中しています。調整できる部分を探しましょう。"
                  : "概ね適正な範囲です。"}
            </div>
          </div>
          <button onClick={() => onTransferToStress(inferScoresFromWorkLog(workLog), false, "worklog")}
            style={{ width: "100%", marginTop: 14, padding: "11px", borderRadius: 8, border: "none", background: C.primary, color: C.white, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            📊 この業務量をストレスチェックに反映する →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DashboardTab（管理職向け） ───────────────────────────
function DashboardTab() {
  const d = DEMO_SCHOOL;
  const [openImprove, setOpenImprove] = useState(null);

  const currentAvg = d.weeklyAvg[d.weeklyAvg.length - 1];
  const prevAvg = d.weeklyAvg[d.weeklyAvg.length - 2];
  const trend = currentAvg - prevAvg;
  const trendColor = trend > 0.2 ? C.danger : trend < -0.2 ? "#40916C" : C.warn;

  return (
    <div style={{ padding: 16 }}>
      {/* 注記 */}
      <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "9px 14px", fontSize: 11, color: "#3730A3", marginBottom: 16, lineHeight: 1.6 }}>
        📋 これはデモ表示です。実運用では教員のチェックデータを匿名集計して表示します。個人を特定する情報は一切表示されません。
      </div>

      {/* アラート */}
      <div style={{ marginBottom: 14 }}>
        {d.alerts.map((a, i) => (
          <div key={i} style={{ background: a.type === "danger" ? C.dangerBg : a.type === "warn" ? C.warnBg : C.bg, border: `1px solid ${a.type === "danger" ? C.danger : a.type === "warn" ? C.warn : C.light}`, borderRadius: 8, padding: "9px 14px", marginBottom: 8, fontSize: 12, color: a.type === "danger" ? C.danger : a.type === "warn" ? "#7D4E00" : C.accent, lineHeight: 1.6 }}>
            {a.type === "danger" ? "🔴 " : a.type === "warn" ? "🟡 " : "🔵 "}{a.msg}
          </div>
        ))}
      </div>

      {/* KPIカード */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "利用職員数", value: `${d.activeUsers}名`, sub: `全${d.totalUsers}名中`, color: C.primary },
          { label: "平均スコア", value: currentAvg, sub: `先週比 ${trend > 0 ? "+" : ""}${Math.round(trend * 10) / 10}`, color: trendColor },
          { label: "平均業務時間", value: `${d.avgWorkHours}h`, sub: "今週・週あたり", color: d.avgWorkHours >= 55 ? C.danger : d.avgWorkHours >= 45 ? C.warn : C.primary },
        ].map((k, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* スコア分布 */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>スコア分布（今週）</div>
        {d.scoreDistribution.map((s, i) => {
          const pct = Math.round((s.count / d.activeUsers) * 100);
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
                <span style={{ color: C.textMuted }}>{s.count}名（{pct}%）</span>
              </div>
              <div style={{ height: 10, background: C.pageBg, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: s.color, borderRadius: 5, transition: "width 0.6s" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 週次推移 */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>週次スコア推移（職場平均）</div>
        {d.weeklyAvg.map((s, i) => {
          const l = stressLevel(s);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 44, fontSize: 11, color: C.textMuted, flexShrink: 0 }}>{d.weekLabels[i]}</div>
              <div style={{ flex: 1, height: 20, background: C.pageBg, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ width: `${Math.round((s / 5) * 100)}%`, height: "100%", background: l.color, borderRadius: 10, transition: "width 0.6s" }} />
              </div>
              <div style={{ width: 28, fontSize: 13, fontWeight: 700, color: l.color }}>{s}</div>
            </div>
          );
        })}
        {trend > 0.2 && (
          <div style={{ marginTop: 10, background: C.dangerBg, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: C.danger }}>
            ⚠ 3週連続上昇中です。職場環境・業務配分の見直しを検討してください。
          </div>
        )}
      </div>

      {/* 主なストレス要因 */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>主なストレス要因</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>高スコア（3以上）の職員が多く回答した項目</div>
        {d.topStressFactors.map((f, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>{f.label}</span>
              <span style={{ color: f.color, fontWeight: 600 }}>{f.pct}%</span>
            </div>
            <div style={{ height: 8, background: C.pageBg, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${f.pct}%`, height: "100%", background: f.color, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>

      {/* 業務時間内訳 */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>業務時間の内訳（職場平均）</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>週あたり平均 {d.avgWorkHours}時間</div>
        {d.workHoursByCategory.map((w, i) => {
          const pct = Math.round((w.h / d.avgWorkHours) * 100);
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>{w.label}</span>
                <span style={{ color: w.color, fontWeight: 600 }}>{w.h}h（{pct}%）</span>
              </div>
              <div style={{ height: 8, background: C.pageBg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: w.color, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 改善アクション */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>推奨アクション</div>
        {d.improvements.map((imp, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div onClick={() => setOpenImprove(openImprove === i ? null : i)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: C.pageBg, borderRadius: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 16 }}>{imp.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{imp.phase}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{openImprove === i ? "▲" : "▼"}</span>
            </div>
            {openImprove === i && (
              <div style={{ padding: "10px 14px", background: C.white, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
                {imp.actions.map((a, j) => (
                  <div key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6, fontSize: 13, lineHeight: 1.6, color: C.text }}>
                    <span style={{ color: C.primary, flexShrink: 0 }}>•</span>{a}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useLocalStorage("tmh_tab", "chat");
  const [mode, setMode] = useLocalStorage("tmh_mode", "staff"); // "staff" | "manager"
  const [presetScores, setPresetScores] = useState(null);
  const [urgent, setUrgent] = useState(false);
  const [presetSource, setPresetSource] = useState("text");
  const [workLog, setWorkLog] = useLocalStorage("tmh_workLog", {});

  const totalWorkH = Math.round(Object.values(workLog).reduce((a, b) => a + b, 0) * 10) / 10;

  function handleTransfer(scores, urg, source) {
    setPresetScores(scores);
    setUrgent(urg);
    setPresetSource(source);
    setTab("stress");
  }

  const staffTabs = [
    { id: "chat", label: "💬 入力" },
    { id: "stress", label: "📊 ストレス" },
    { id: "worklog", label: "⏱ 業務ログ" },
  ];
  const managerTabs = [
    { id: "dashboard", label: "📋 ダッシュボード" },
  ];
  const tabs = mode === "manager" ? managerTabs : staffTabs;

  return (
    <div style={{ fontFamily: "'Hiragino Sans', 'Noto Sans JP', sans-serif", background: C.pageBg, minHeight: "100vh", color: C.text }}>
      <div style={{ background: C.primary, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.light, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
        <div>
          <div style={{ color: C.white, fontWeight: 600, fontSize: 15 }}>教員こころのサポートツール</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>匿名・安全・いつでも使えます</div>
        </div>
        {/* モード切替 */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {["staff", "manager"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setTab(m === "manager" ? "dashboard" : "chat"); }}
              style={{ padding: "4px 10px", borderRadius: 16, border: "none", fontSize: 11, fontFamily: "inherit", cursor: "pointer", fontWeight: mode === m ? 600 : 400, background: mode === m ? C.white : "rgba(255,255,255,0.15)", color: mode === m ? C.primary : C.white, transition: "all 0.2s" }}>
              {m === "staff" ? "教職員" : "管理職"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: C.white }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "12px 8px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? C.primary : C.muted, borderBottom: tab === t.id ? `2px solid ${C.primary}` : "2px solid transparent", transition: "all 0.2s", fontFamily: "inherit" }}>
            {t.label}
            {t.id === "stress" && presetScores && tab !== "stress" && (
              <span style={{ marginLeft: 4, background: C.light, color: C.white, borderRadius: 10, padding: "1px 5px", fontSize: 10 }}>連携済</span>
            )}
            {t.id === "worklog" && totalWorkH > 0 && (
              <span style={{ marginLeft: 4, background: C.muted, color: C.white, borderRadius: 10, padding: "1px 5px", fontSize: 10 }}>{totalWorkH}h</span>
            )}
          </button>
        ))}
      </div>
      {tab === "chat" && <ChatTab onTransferToStress={handleTransfer} />}
      {tab === "stress" && <StressTab presetScores={presetScores} urgent={urgent} presetSource={presetSource} totalWorkH={totalWorkH} clearPreset={() => { setPresetScores(null); setUrgent(false); }} />}
      {tab === "worklog" && <WorkLogTab workLog={workLog} setWorkLog={setWorkLog} onTransferToStress={handleTransfer} />}
      {tab === "dashboard" && <DashboardTab />}
    </div>
  );
}
