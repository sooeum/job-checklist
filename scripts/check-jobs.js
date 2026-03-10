const https = require('https');

const BASE_URL = 'https://career.spartaclub.kr';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractJobUrls(html) {
  const regex = /href="(\/ko\/o\/\d+)"/g;
  const urls = new Set();
  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.add(BASE_URL + match[1]);
  }
  return [...urls];
}

function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/);
  return match ? match[1].replace(' - 팀스파르타 채용페이지', '').trim() : '제목 없음';
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function checkText(text, url) {
  const issues = [];

  const haeyoMatches = text.match(/[가-힣]+해요[.!]?/g) || [];
  const hammidaMatches = text.match(/[가-힣]+합니다[.!]?/g) || [];
  if (haeyoMatches.length > 0 && hammidaMatches.length > 0) {
    issues.push('⚠️ 해요체/합니다체 혼용 확인 필요');
  }

  const emojiNoSpace = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}][^\s]/u;
  if (emojiNoSpace.test(text)) {
    issues.push('❌ 이모지 뒤 띄어쓰기 없음');
  }

  const hasLink = text.includes('http') || text.includes('링크');
  const hasLinkEmoji = text.includes('🔗');
  if (hasLink && !hasLinkEmoji) {
    issues.push('❌ 🔗 아웃링크 이모지 없음');
  }

  const wantText = text.includes('찾고 있어요') || text.includes('좋아요');
  if (wantText && !text.includes('한 분')) {
    issues.push('❌ ~한 분 어미 없음');
  }

  if (!text.includes('채용 정보') && !text.includes('채용정보')) {
    issues.push('❌ 채용 정보 제목 없음');
  }

  if (!text.includes('채용 전형') && !text.includes('전형')) {
    issues.push('❌ 채용 전형 내용 없음');
  }

  if (text.includes('정규직') && !text.includes('온보딩') && !text.includes('수습')) {
    issues.push('❌ 정규직인데 온보딩/수습 내용 없음');
  }

  return issues;
}

async function sendSlack(message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text: message });
    const url = new URL(SLACK_WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, resolve);
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('공고 목록 수집 중...');
  const listHtml = await fetch(`${BASE_URL}/ko/careers`);
  const jobUrls = extractJobUrls(listHtml);
  console.log(`총 ${jobUrls.length}개 공고 발견`);

  const problemJobs = [];

  for (const url of jobUrls) {
    try {
      const html = await fetch(url);
      const title = extractTitle(html);
      const text = stripHtml(html);
      const issues = checkText(text, url);
      if (issues.length > 0) {
        problemJobs.push({ title, url, issues });
      }
      await new Promise(r => setTimeout(r, 500)); // 서버 부하 방지
    } catch (e) {
      console.error(`오류: ${url}`, e.message);
    }
  }

  if (problemJobs.length === 0) {
    await sendSlack('✅ 오늘 공고 자동 검사 완료! 모든 공고에 문제가 없어요 🎉');
  } else {
    let msg = `📋 *공고 자동 검사 결과* - 문제 있는 공고 ${problemJobs.length}개\n\n`;
    for (const job of problemJobs) {
      msg += `*${job.title}*\n`;
      msg += `${job.url}\n`;
      msg += job.issues.map(i => `  ${i}`).join('\n');
      msg += '\n\n';
    }
    await sendSlack(msg);
  }

  console.log('완료!');
}

main().catch(console.error);
