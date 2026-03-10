import { useState } from "react";

const MANUAL_ITEMS = [
  "팀페이지 우피 페이지로 연결되어 있는지 확인하기",
  "그리팅 설정 (사전질문) 잘 들어가 있는지 확인",
  "그리팅 설정 (사내추천) 잘 설정되어 있는지 확인",
  "그리팅 설정 (평가표) 잘 설정되어 있는지 확인",
  "지원 완료 안내 메일 문구 수정 확인",
];

function checkText(text) {
  const results = [];

  const haeyoMatches = text.match(/[가-힣]+해요[.!]?/g) || [];
  const hammidaMatches = text.match(/[가-힣]+합니다[.!]?/g) || [];
  if (haeyoMatches.length > 0 && hammidaMatches.length > 0) {
    results.push({ label: "제목 해요체 / 본문 합니다체 혼용 여부", pass: null, msg: "해요체와 합니다체가 함께 발견됐어요. 직접 확인해주세요.", warn: true });
  } else {
    results.push({ label: "제목 해요체 / 본문 합니다체 혼용 여부", pass: true, msg: "혼용 없음" });
  }

  const emojiNoSpace = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}][^\s]/u;
  const emojiIssue = emojiNoSpace.test(text);
  results.push({ label: "이모지 뒤 띄어쓰기 1칸", pass: !emojiIssue, msg: emojiIssue ? "이모지 뒤 띄어쓰기가 없는 부분이 있어요." : "이상 없음" });

  const hasLink = text.includes("http") || text.includes("링크");
  const hasLinkEmoji = text.includes("🔗");
  if (hasLink && !hasLinkEmoji) {
    results.push({ label: "🔗 아웃링크 이모지 형식", pass: false, msg: "링크가 있는데 🔗 이모지가 없어요." });
  } else {
    results.push({ label: "🔗 아웃링크 이모지 형식", pass: true, msg: "이상 없음" });
  }

  const wantText = text.includes("찾고 있어요") || text.includes("좋아요");
  const hanBun = text.includes("한 분");
  if (wantText && !hanBun) {
    results.push({ label: "찾고 있어요/좋아요 어미 (~한 분)", pass: false, msg: "'~한 분' 어미가 없어요." });
  } else {
    results.push({ label: "찾고 있어요/좋아요 어미 (~한 분)", pass: true, msg: "이상 없음" });
  }

  const hasJobInfo = text.includes("채용 정보") || text.includes("채용정보");
  results.push({ label: "채용 정보 제목 존재 여부", pass: hasJobInfo, msg: hasJobInfo ? "이상 없음" : "'채용 정보' 제목이 없어요." });

  const hasProcess = text.includes("채용 전형") || text.includes("전형");
  results.push({ label: "채용 전형 및 소요 시간", pass: hasProcess, msg: hasProcess ? "이상 없음" : "'채용 전형' 내용이 없어요." });

  const isRegular = text.includes("정규직");
  const hasOnboarding = text.includes("온보딩") || text.includes("수습");
  if (isRegular && !hasOnboarding) {
    results.push({ label: "정규직 온보딩/수습기간 안내", pass: false, msg: "정규직 공고인데 온보딩/수습 내용이 없어요." });
  } else {
    results.push({ label: "정규직 온보딩/수습기간 안내", pass: true, msg: isRegular ? "이상 없음" : "정규직 공고가 아닌 것으로 판단됨" });
  }

  return results;
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoResults, setAutoResults] = useState(null);
  const [manualChecks, setManualChecks] = useState({});
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setAutoResults(null);
    setManualChecks({});

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are a web content extractor. Fetch the given URL and return ONLY the raw visible text content. No commentary, no formatting, just the text.",
          messages: [{ role: "user", content: `다음 채용 페이지의 텍스트 내용을 추출해줘. URL: ${url}\n\n텍스트만 그대로 반환해줘.` }],
          tools: [{ type: "web_search_20250305", name: "web_search" }]
        })
      });

      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("\n") || "";
      const results = checkText(text);
      setAutoResults(results);
    } catch (e) {
      setError("페이지를 불러오는 중 오류가 발생했어요. URL을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const toggleManual = (item) => {
    setManualChecks(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const passCount = autoResults ? autoResults.filter(r => r.pass === true).length : 0;
  const failCount = autoResults ? autoResults.filter(r => r.pass === false).length : 0;
  const warnCount = autoResults ? autoResults.filter(r => r.warn).length : 0;
  const manualDone = Object.values(manualChecks).filter(Boolean).length;

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>📋 공고 오픈 자동 검사</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>채용 페이지 URL을 입력하면 자동으로 검사해드려요.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://채용페이지URL"
          style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          style={{ padding: "10px 20px", borderRadius: 8, background: loading ? "#ccc" : "#4F46E5", color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 14 }}
        >
          {loading ? "검사 중..." : "검사하기"}
        </button>
      </div>

      {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

      {autoResults && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { label: "통과", count: passCount, color: "#D1FAE5", text: "#065F46" },
              { label: "문제", count: failCount, color: "#FEE2E2", text: "#991B1B" },
              { label: "확인 필요", count: warnCount, color: "#FEF3C7", text: "#92400E" },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.color, borderRadius: 8, padding: "10px 0", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.text }}>{s.count}</div>
                <div style={{ fontSize: 12, color: s.text }}>{s.label}</div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🤖 자동 검사 결과</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {autoResults.map((r, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                background: r.pass === false ? "#FFF5F5" : r.warn ? "#FFFBEB" : "#F0FDF4",
                borderRadius: 8, padding: "10px 14px",
                border: `1px solid ${r.pass === false ? "#FECACA" : r.warn ? "#FDE68A" : "#BBF7D0"}`
              }}>
                <span style={{ fontSize: 16, marginTop: 1 }}>{r.pass === false ? "❌" : r.warn ? "⚠️" : "✅"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{r.msg}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>👀 직접 확인 항목 ({manualDone}/{MANUAL_ITEMS.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {MANUAL_ITEMS.map((item, i) => (
              <div key={i} onClick={() => toggleManual(item)} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: manualChecks[item] ? "#F0FDF4" : "#FAFAFA",
                border: `1px solid ${manualChecks[item] ? "#BBF7D0" : "#E5E7EB"}`,
                borderRadius: 8, padding: "10px 14px", cursor: "pointer"
              }}>
                <span style={{ fontSize: 16 }}>{manualChecks[item] ? "✅" : "⬜"}</span>
                <span style={{ fontSize: 13, color: manualChecks[item] ? "#065F46" : "#374151", textDecoration: manualChecks[item] ? "line-through" : "none" }}>{item}</span>
              </div>
            ))}
          </div>

          {failCount === 0 && manualDone === MANUAL_ITEMS.length && (
            <div style={{ background: "#4F46E5", color: "#fff", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 20 }}>🚀</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>모든 항목 통과! 공고 오픈해도 좋아요.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
