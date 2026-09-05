const HERO_MAP = {
    "111117": "가토가챠", "111106": "갈리토스", "311104": "구르르", "112212": "노엘", "112202": "다래",
    "111103": "두발카인", "111119": "드레이번", "113214": "디지", "312102": "레오닉", "113205": "레이나",
    "312203": "레이든", "311102": "렉터", "113203": "로칸", "312207": "리키안", "111101": "마르쿠스",
    "112101": "마젠다", "113209": "메이릴", "113212": "멜쉬드", "311201": "브로켄", "112213": "브리짓",
    "113215": "비글랭", "113210": "샤아라", "112103": "샤카-잔", "112209": "샤피나", "312201": "세레나",
    "112105": "셰릴", "111105": "스톤콜드", "112208": "스푸키", "112204": "실크", "112203": "아그네스",
    "112201": "에델린", "113207": "이레아", "112206": "제르딘", "112108": "진", "111107": "챈",
    "313205": "카쟈드", "311108": "칸젤", "111114": "코포리", "111118": "쿠아다", "111113": "쿤카",
    "311103": "킹죠", "111104": "탈론", "112207": "티리아", "113201": "프로드", "113211": "호른달",
    "413208": "나즈", "213210": "나카챠", "211106": "네파-툼", "213202": "니바스", "411111": "니피",
    "211202": "닐스", "211114": "듀라한", "211115": "라그나", "211112": "라데스", "211117": "라우부",
    "213212": "레이첼", "212101": "레퍼드", "213211": "로로키둘", "212208": "로자미어", "213207": "루시퍼",
    "211111": "멀머던", "213206": "메두사", "211101": "뮤턴트", "212204": "바이퍼", "211113": "베헤모스",
    "212103": "벨제뷔트", "411112": "세드릭", "211105": "세티어", "211116": "솔 배드가이", "211110": "솔-벤-하임",
    "212205": "아그니 형제", "212202": "아카샤", "213208": "아키로", "213201": "악동", "412102": "알카라스",
    "413204": "엘딘", "411102": "엘시드", "213204": "오블리", "413202": "자이로스", "212107": "자카리어스",
    "212106": "잼", "412104": "적혈귀", "212210": "칼리", "211109": "코르포스", "412205": "테르시아",
    "212105": "트리키", "211203": "파고", "413206": "페르다", "213209": "플루토", "213203": "헤르쥬나"
};

let allData = [];
let userDetails = {};
let premiumMap = {};   // ANO → premium entry (preferHero 포함)
let filteredData = [];
let currentPage = 1;
const pageSize = 50;
let sortKey = 'rank';
let sortAsc = true;

// 영웅 테이블 정렬 전역 변수
let currentHeroSortKey = 'playCnt';
let currentHeroSortAsc = false;
let currentHeroList = [];

// 유틸리티 함수
function getGradeColor(grade) {
    if (!grade) return '#8b949e';
    const g = String(grade);
    if (g.includes('루비')) return '#FF4D4D';
    if (g.includes('다이아')) return '#D1D5DA';
    if (g.includes('자수정')) return '#A371F7';
    if (g.includes('사파이어')) return '#58A6FF';
    if (g.includes('에메랄드')) return '#3FB950';
    if (g.includes('토파즈')) return '#D29922';
    return '#8b949e';
}

function normalizeAno(val) {
    if (!val) return "";
    return val.toString().trim().replace(/^0+/, "") || "0";
}

function getGradeWeight(grade) {
    if (!grade) return 0;
    const g = String(grade);
    let weight = 0;
    if (g.includes('다이아')) weight = 6000;
    else if (g.includes('루비')) weight = 5000;
    else if (g.includes('자수정')) weight = 4000;
    else if (g.includes('사파이어')) weight = 3000;
    else if (g.includes('에메랄드')) weight = 2000;
    else if (g.includes('토파즈')) weight = 1000;

    const m = g.match(/\d+/);
    if (m) {
        // 단계가 낮을수록(1단계) 더 높은 순위이므로 가중치를 뺌
        // 5단계: +100, 4단계: +200, ... 1단계: +500
        const step = parseInt(m[0], 10);
        weight += (6 - step) * 100;
    }
    return weight;
}

function updateText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}
function updateHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}
function updateColor(id, color) {
    const el = document.getElementById(id);
    if (el) el.style.color = color;
}
function fmtDetailedRec(games, w, l, wr) {
    return `<span style="display:inline-block;min-width:2.5em;text-align:right">${games}</span>` +
           `<span style="margin-right:4px;">전</span>` +
           `<span class="win-text" style="display:inline-block;min-width:2.5em;text-align:right">${w}</span>` +
           `<span class="win-text" style="margin-right:4px;">승</span>` +
           `<span class="loss-text" style="display:inline-block;min-width:2.5em;text-align:right">${l}</span>` +
           `<span class="loss-text" style="margin-right:4px;">패</span>` +
           `<span style="display:inline-block;min-width:2.8em;text-align:right">(${wr}%)</span>`;
}

// 필드 추출기
function findVal(obj, keys) {
    if (!obj) return null;
    for (let k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
    }
    return null;
}

async function init() {
    try {
        const [r1, r2, r3, r4] = await Promise.all([
            fetch(`V88_FINAL_RANK_DEEP.json?v=${Date.now()}`),
            fetch(`DB.json?v=${Date.now()}`).catch(() => ({ ok: false })),
            fetch(`V82_FINAL_RANK_PREMIUM.json?v=${Date.now()}`).catch(() => ({ ok: false })),
            fetch(`last_update.json?v=${Date.now()}`).catch(() => ({ ok: false }))
        ]);
        if (r1.ok) allData = await r1.json();
        if (r2.ok) userDetails = await r2.json();
        if (r3.ok) {
            const premList = await r3.json();
            // account.ano 또는 account.nickname으로 ANO 매핑
            premList.forEach(entry => {
                const acc = entry.account || {};
                const ano = normalizeAno(acc.ano || acc.userANO || '');
                if (ano) premiumMap[ano] = entry;
            });
        }
        if (r4 && r4.ok) {
            const updateInfo = await r4.json();
            updateText('last-update-time', updateInfo.last_update || '---');
        }
        filteredData = [...allData];
        renderTable();
        setupSearchClear();
        document.getElementById('search-input')?.addEventListener('input', handleSearch);
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => sortData(th.dataset.sort));
        });
        document.querySelectorAll('th[data-hero-sort]').forEach(th => {
            th.addEventListener('click', () => sortHeroData(th.dataset.heroSort));
        });
    } catch (e) { console.error("Init failed", e); }
}

// 유효 영웅 리스트 추출 (Premium > PlayRecord > Fallback)
function getUserHeroes(ano, userObj, detailObj) {
    const norm = normalizeAno(ano);
    const prem = premiumMap[norm];
    let raw = [];

    // 1순위: V82_FINAL_RANK_PREMIUM.json (premiumMap) 데이터
    if (prem && prem.preferHero && prem.preferHero.length > 0) {
        raw = prem.preferHero;
    } else {
        // 2순위: DB.json (detailObj) 또는 메인 데이터의 영웅 리스트
        const list = detailObj?.characterList || userObj?.characterList ||
            detailObj?.recordCharacter || userObj?.recordCharacter || [];

        // 실제 플레이 기록이 있는 것들만 필터링
        raw = list.filter(h => {
            const pc = Number(h.playCnt || h.playCount || 0);
            const exist = h.bExistRecord === "1" || h.bExistRank === "1";
            return pc > 0 || exist;
        });

        // 플레이 횟수순 정렬
        raw.sort((a, b) => Number(b.playCnt || b.playCount || 0) - Number(a.playCnt || a.playCount || 0));
    }

    return raw.map(c => {
        if (typeof c === 'string') return { characterNo: c };
        const obj = Object.assign({}, c);
        // 필드명 별칭 처리 (characterNo, heroNo, heroID 등 프리미엄/일반 데이터 혼용 대응)
        if (!obj.characterNo) {
            obj.characterNo = obj.heroNo || obj.heroID || obj.characterNo;
        }
        return obj;
    });
}

function handleSearch() {
    const input = document.getElementById('search-input');
    const v = input?.value.toLowerCase() || "";
    const clearBtn = document.getElementById('search-clear');

    // Sync clear button visibility
    if (clearBtn) clearBtn.style.display = v.length > 0 ? 'block' : 'none';

    filteredData = allData.filter(u => {
        const nick = (u.nick || u.nickname || "").toLowerCase();
        const ano = (u.userANO || u.ano || "").toString();
        const norm = normalizeAno(ano);
        const detail = userDetails[norm] || {};
        const history = (detail.nickHistory || []).map(n => String(n).trim().toLowerCase());
        return nick.includes(v) || ano.includes(v) || history.some(h => h.includes(v));
    });
    currentPage = 1; renderTable();
}

function setupSearchClear() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    if (!input || !clearBtn) return;

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        input.focus();
        handleSearch();
    });
}

function sortData(key) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = (key === 'rank'); }

    // Update header icons
    document.querySelectorAll('th[data-sort]').forEach(th => {
        const k = th.dataset.sort;
        let txt = th.innerText.replace(/[↕↑↓]/g, '').trim();
        if (k === sortKey) txt += (sortAsc ? ' ↑' : ' ↓');
        else txt += ' ↕';
        th.innerText = txt;
    });

    filteredData.sort((a, b) => {
        if (key === 'wr') {
            const aWeight = getGradeWeight(a.gradeName || a.grade);
            const bWeight = getGradeWeight(b.gradeName || b.grade);
            // 사파이어 이상은 항상 정렬 포함, 에메랄드 이하는 하단 고정
            const aMain = aWeight >= 3000;
            const bMain = bWeight >= 3000;

            if (aMain && !bMain) return -1; // 정렬 포함이 위로
            if (!aMain && bMain) return 1;  // 정렬 제외가 아래로

            if (!aMain && !bMain) {
                // 둘 다 정렬 제외인 경우 순위 오름차순 정렬
                const aUnranked = (a.RTRank === '-' || a.rank === '-');
                const bUnranked = (b.RTRank === '-' || b.rank === '-');
                if (aUnranked && !bUnranked) return 1;
                if (!aUnranked && bUnranked) return -1;
                const ra = parseInt(a.RTRank || a.rank || 9999, 10);
                const rb = parseInt(b.RTRank || b.rank || 9999, 10);
                return ra - rb;
            }
        }

        let va, vb;
        if (key === 'rank') {
            // 순위 없는 유저('-')는 항상 맨 아래로
            const aUnranked = (a.RTRank === '-' || a.rank === '-');
            const bUnranked = (b.RTRank === '-' || b.rank === '-');
            if (aUnranked && !bUnranked) return 1;
            if (!aUnranked && bUnranked) return -1;
            va = parseInt(a.RTRank || a.rank || 999, 10);
            vb = parseInt(b.RTRank || b.rank || 999, 10);
        }
        else if (key === 'nick') { va = (a.nick || a.nickname || "").toLowerCase(); vb = (b.nick || b.nickname || "").toLowerCase(); return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va); }
        else if (key === 'wr') {
            const wA = parseInt(findVal(a, ['WinCount', 'winCount', 'win']) || 0, 10);
            const lA = parseInt(findVal(a, ['LoseCount', 'loseCount', 'lose']) || 0, 10);
            const wB = parseInt(findVal(b, ['WinCount', 'winCount', 'win']) || 0, 10);
            const lB = parseInt(findVal(b, ['LoseCount', 'loseCount', 'lose']) || 0, 10);
            va = (wA + lA) > 0 ? (wA / (wA + lA)) : 0;
            vb = (wB + lB) > 0 ? (wB / (wB + lB)) : 0;
        } else if (key === 'grade') {
            // 순위 없는 유저('-')는 항상 맨 아래로
            const aUnranked = (a.RTRank === '-' || a.rank === '-');
            const bUnranked = (b.RTRank === '-' || b.rank === '-');
            if (aUnranked && !bUnranked) return 1;
            if (!aUnranked && bUnranked) return -1;
            va = getGradeWeight(a.gradeName || a.grade);
            vb = getGradeWeight(b.gradeName || b.grade);
            // 등급은 기본적으로 높은 등급이 위로 오도록 (내림차순 가중치)
            return sortAsc ? vb - va : va - vb;
        } else { va = a[key] || 0; vb = b[key] || 0; }

        if (va === vb) return 0;
        return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    currentPage = 1; renderTable();
}

function sortHeroData(key) {
    if (currentHeroSortKey === key) {
        currentHeroSortAsc = !currentHeroSortAsc;
    } else {
        currentHeroSortKey = key;
        currentHeroSortAsc = false; // Default to descending when changing sort column
    }
    fillHeroTable('sp-hero-list', 'sp-hero-title', currentHeroList);
}

function renderTable() {
    const start = (currentPage - 1) * pageSize;
    const pageData = filteredData.slice(start, start + pageSize);
    const body = document.getElementById('ranking-body');
    if (!body) return;
    body.innerHTML = pageData.map(u => {
        const ano = u.userANO || u.ano;
        const norm = normalizeAno(ano);
        const nick = u.nick || u.nickname || "Unknown";
        const grade = u.gradeName || u.grade || "---";
        const win = parseInt(findVal(u, ['WinCount', 'winCount', 'win']) || 0, 10);
        const loss = parseInt(findVal(u, ['LoseCount', 'loseCount', 'lose']) || 0, 10);
        let wrRaw = findVal(u, ['WinRate_InclDisc', 'winRate']);
        let wr = 0;
        if (wrRaw) wr = String(wrRaw).replace('%', '');
        else wr = (win + loss) > 0 ? ((win / (win + loss)) * 100).toFixed(1) : 0;
        const rank = u.RTRank || u.rank || "---";
        const detail = userDetails[norm] || {};
        const heroes = getUserHeroes(ano, u, detail);

        // Show only 7 icons on mobile, 14 on desktop in table
        const isMobile = window.innerWidth <= 900;

        let displayGrade = grade;
        if (isMobile && grade !== "---") {
            displayGrade = grade.replace('다이아몬드', '다이아')
                .replace('사파이어', '사파')
                .replace('에메랄드', '에메')
                .replace('자수정', '자수');
        }

        const iconCount = 7; // Always 7 icons per row as requested
        const icons = heroes.slice(0, iconCount).map(c => {
            const cno = c.characterNo || c;
            const src = (cno && cno !== '[object Object]') ? `img_hero/${cno}.png` : 'img_hero/nop.png';
            return `<img src="${src}" class="hero-mini-icon" onerror="this.src='img_hero/nop.png'">`;
        }).join('');
        return `<tr onclick="selectUser('${ano}', this)">
            <td>${rank}</td>
            <td style="text-align:center; overflow:hidden; text-overflow:ellipsis;">${nick}</td>
            <td class="hide-on-panel hide-on-mobile"><div class="hero-icons-container">${icons}</div></td>
            <td class="hide-on-panel" style="color:${getGradeColor(grade)}; text-align:center;">${displayGrade}</td>
            <td class="hide-on-panel">
                <div class="record-cell" style="justify-content: center;">
                  <div class="wl-bar-container" style="width: 120px;">
                    <div class="wl-bar-win" style="width: ${wr}%">
                      ${win}<span class="wl-label">W</span>
                    </div>
                    <div class="wl-bar-loss">
                      ${loss}<span class="wl-label">L</span>
                    </div>
                  </div>
                </div>
            </td>
            <td class="hide-on-panel" style="text-align:center;">${wr}%</td>
            <td class="hide-on-mobile" style="color:#58A6FF; text-align:center;">${ano}</td>
        </tr>`;
    }).join('');
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (totalPages <= 1) {
        updateHtml('pagination', '');
        updateHtml('pagination-top', '');
        return;
    }

    const isMobile = window.innerWidth <= 900;
    const maxVisibleButtons = isMobile ? 5 : 10;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    // Ensure 1-indexed rank logic consistency: Page 1 (1-50), Page 2 (51-100)...
    // goToPage handles index as (currentPage-1)*pageSize to start slicing.

    let h = `<div class="pagination-area">`;

    // 처음/이전 버튼
    h += `<button onclick="goToPage(1)" class="pg-btn" ${currentPage === 1 ? 'disabled' : ''} title="처음으로">«</button>`;
    h += `<button onclick="goToPage(${currentPage - 1})" class="pg-btn" ${currentPage === 1 ? 'disabled' : ''} title="이전">‹</button>`;

    // 숫자 버튼
    for (let i = startPage; i <= endPage; i++) {
        h += `<button onclick="goToPage(${i})" class="pg-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
    }

    // 다음/끝 버튼
    h += `<button onclick="goToPage(${currentPage + 1})" class="pg-btn" ${currentPage === totalPages ? 'disabled' : ''} title="다음">›</button>`;
    h += `<button onclick="goToPage(${totalPages})" class="pg-btn" ${currentPage === totalPages ? 'disabled' : ''} title="맨 끝으로">»</button>`;

    // 페이지 입력
    h += `
        <div class="pg-input-wrapper">
            <input type="number" class="pg-input" value="${currentPage}" min="1" max="${totalPages}" 
                onkeydown="if(event.key==='Enter') goToPage(this.value)"
                onfocus="this.select()">
            <span class="total-pg-label">/ ${totalPages}</span>
        </div>
    `;
    h += `</div>`;

    updateHtml('pagination', h);
    updateHtml('pagination-top', h);
}

window.goToPage = (p) => {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    let page = parseInt(p, 10);
    if (isNaN(page)) return;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;
    renderTable();

    // PC 환경 독립 스크롤 최상단화
    const rPanel = document.querySelector('.right-panel');
    if (rPanel) rPanel.scrollTop = 0;
    const tContainer = document.getElementById('table-container');
    if (tContainer) tContainer.scrollTop = 0;

    // 모바일/공통: window + document 전체 최상단으로 강제 스크롤
    try {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // iOS Safari 등 비동기 렌더링 대응: 약간의 딜레이 후 한 번 더
        setTimeout(() => {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        }, 80);
    } catch (e) {
        window.scrollTo(0, 0);
    }
};


// ===========================
// 승률 색상 (Python r_color 과 동일)
// ===========================
function getRateColor(r) {
    r = Number(r);
    if (r >= 70) return '#4ade80';
    if (r >= 55) return '#fbbf24';
    if (r >= 45) return '#f0a050';
    return '#f87171';
}

// ===========================
// RECORDS 블록 채우기 헬퍼
// ===========================
function fillRecordBlock(prefix, rec) {
    rec = rec || {};
    const w = Number(rec.winCnt || rec.WinCount || rec.totalWinCount || 0);
    const l = Number(rec.loseCnt || rec.LoseCount || rec.totalLoseCount || 0);
    const d = Number(rec.drawCnt || rec.DrawCount || 0);
    const total = w + l + d;

    // 승률: seasonWinningRate → WinRate_InclDisc → 계산
    let swr = 0;
    const swrRaw = rec.seasonWinningRate ?? rec.WinRate_InclDisc;
    if (swrRaw !== undefined && swrRaw !== null)
        swr = parseInt(String(swrRaw).replace('%', ''), 10) || 0;
    else
        swr = total > 0 ? Math.round((w / total) * 100) : 0;

    const spwr = parseInt(String(rec.seasonPartyWinningRate || 0).replace('%', ''), 10) || 0;
    const twr = parseInt(String(rec.thisWeekWinningRate || 0).replace('%', ''), 10) || 0;
    const tpwr = parseInt(String(rec.thisWeekPartyWinningRate || 0).replace('%', ''), 10) || 0;
    const dc = Number(rec.disconnectCnt || rec.disConnectCount || 0);

    const elRec = document.getElementById(`${prefix}-rec`);
    const elSwr = document.getElementById(`${prefix}-swr`);
    const elBar = document.getElementById(`${prefix}-bar`);
    const elExtra = document.getElementById(`${prefix}-extra`);

    if (elRec) {
        const hasThreeDigitLoss = (l >= 100 || Number(rec.partyLoseCnt || 0) >= 100);
        const winMargin = hasThreeDigitLoss ? '3px' : '0px';
        const fmt = (n, cls, label, numW, labelMargin) => {
            const marginStyle = labelMargin ? `margin-right:${labelMargin};` : '';
            return `<span class="${cls}" style="display:inline-block;min-width:${numW};text-align:right">${n}</span>` +
                   `<span class="${cls}" style="${marginStyle}">${label}</span>`;
        };
        elRec.innerHTML = fmt(w,'win-text','승','2.0em',winMargin) + 
                          fmt(l,'loss-text','패','2.0em','4px') + 
                          fmt(d,'','무','0.8em','');
    }
    if (elSwr) {
        elSwr.textContent = `시즌 ${swr}%`;
        elSwr.style.color = getRateColor(swr);
    }
    if (elBar) elBar.style.width = `${Math.min(swr, 100)}%`;

    if (elExtra) {
        let html = '';
        html += `<div class="extra-row"><span class="extra-label">이번주 승률</span><span class="extra-val" style="color:${getRateColor(twr)}">${twr}%</span></div>`;
        html += `<div class="extra-row"><span class="extra-label">시즌 파티 승률</span><span class="extra-val" style="color:${getRateColor(spwr)}">${spwr}%</span></div>`;
        html += `<div class="extra-row"><span class="extra-label">이번주 파티 승률</span><span class="extra-val" style="color:${getRateColor(tpwr)}">${tpwr}%</span></div>`;
        if (dc > 0)
            html += `<div class="extra-row"><span class="extra-label">이탈</span><span class="extra-val" style="color:#f87171">${dc}회</span></div>`;
        elExtra.innerHTML = html;
    }
}

// ===========================
// HEROES 테이블 채우기 헬퍼
// ===========================
function fillHeroTable(tbodyId, titleId, heroList) {
    const tbody = document.getElementById(tbodyId);
    const title = document.getElementById(titleId);
    if (!tbody) return;

    // 현재 테이블에 렌더링 중인 전체 영웅 리스트 저장 (정렬에 사용)
    currentHeroList = heroList || [];

    if (title) {
        title.innerText = `선호 영웅 (이번 시즌) (${currentHeroList.length}개)`;
    }

    // 헤더 정렬 텍스트/화살표 업데이트
    document.querySelectorAll('th[data-hero-sort]').forEach(th => {
        const k = th.dataset.heroSort;
        let txt = th.innerText.replace(/[↕↑↓▼▲]/g, '').trim();
        if (k === currentHeroSortKey) {
            txt += (currentHeroSortAsc ? ' ↑' : ' ↓');
        } else {
            txt += ' ↕';
        }
        th.innerText = txt;
    });

    const getVal = (h, key) => {
        if (key === 'playCnt') return Number(h.playCnt || h.playCount || 0);
        if (key === 'winningRate') return parseInt(String(h.winningRate || h.winRate || 0).replace('%', ''), 10) || 0;
        if (key === 'partyWinningRate') return parseInt(String(h.partyWinningRate || h.partyWinRate || 0).replace('%', ''), 10) || 0;
        return 0;
    };

    // 정렬 로직 적용
    const sorted = [...currentHeroList].sort((a, b) => {
        const isWinRateSort = (currentHeroSortKey === 'winningRate' || currentHeroSortKey === 'partyWinningRate');
        if (isWinRateSort) {
            const playA = Number(a.playCnt || a.playCount || 0);
            const playB = Number(b.playCnt || b.playCount || 0);
            const isMainA = playA > 8;
            const isMainB = playB > 8;

            if (isMainA && !isMainB) return -1; // 8판 초과가 위로
            if (!isMainA && isMainB) return 1;  // 8판 이하가 아래로

            if (!isMainA && !isMainB) {
                // 둘 다 8판 이하인 경우 판수 내림차순 정렬
                if (playA !== playB) return playB - playA;
                const na = a.name || a.characterName || '';
                const nb = b.name || b.characterName || '';
                return na.localeCompare(nb);
            }
        }

        let va = getVal(a, currentHeroSortKey);
        let vb = getVal(b, currentHeroSortKey);

        if (va < vb) return currentHeroSortAsc ? -1 : 1;
        if (va > vb) return currentHeroSortAsc ? 1 : -1;

        // 동률일 경우 영웅 이름순 정렬
        const na = a.name || a.characterName || '';
        const nb = b.name || b.characterName || '';
        return na.localeCompare(nb);
    });

    // Show all heroes on mobile
    const displayList = sorted;

    tbody.innerHTML = displayList.map((h, i) => {
        const cno = String(h.characterNo || '');
        const name = h.name || h.characterName || HERO_MAP[cno] || `Unknown(${cno})`;
        const pc = Number(h.playCnt || h.playCount || 0);
        const pcDisplay = pc > 0 ? `${pc}판` : "-";

        let wr = parseInt(String(h.winningRate || h.winRate || 0).replace('%', ''), 10) || 0;
        let pwr = parseInt(String(h.partyWinningRate || h.partyWinRate || 0).replace('%', ''), 10) || 0;

        return `<tr>
            <td class="sp-hero-col-rank">${i + 1}</td>
            <td>${name}</td>
            <td class="sp-hero-col-play">${pcDisplay}</td>
            <td class="sp-percent-val" style="color:${getRateColor(wr)}">${wr}%</td>
            <td class="sp-percent-val" style="color:${getRateColor(pwr)}">${pwr}%</td>
        </tr>`;
    }).join('');
}

// ===========================
// 유저 클릭 → 패널 열기
async function selectUser(ano, trElement) {
    const norm = normalizeAno(ano);
    const user = allData.find(u => normalizeAno(u.userANO || u.ano) === norm);
    const detail = userDetails[norm] || {};
    const prem = premiumMap[norm];
    const swl = detail.rank_season_wl || {};
    const allWl = detail.rank_all_wl || {};

    if (!user) return;

    // 패널 열기
    const panel = document.getElementById('sliding-profile');
    if (panel) {
        panel.classList.add('open');
        panel.scrollTop = 0;
    }

    // 메인 그리드 레이아웃 조정
    const grid = document.querySelector('.dashboard-grid');
    if (grid) grid.classList.add('panel-open');
    const tableCont = document.getElementById('table-container');
    if (tableCont) tableCont.classList.add('panel-open');

    // 행 하이라이트
    document.querySelectorAll('#ranking-body tr').forEach(tr => {
        tr.style.backgroundColor = '';
        tr.style.outline = '';
    });
    if (trElement) {
        trElement.style.backgroundColor = 'rgba(88, 166, 255, 0.15)';
        trElement.style.outline = '1px solid var(--accent-blue)';
    }

    try {
        const curNick = user.nick || user.nickname || 'Unknown';
        const nHistory = (detail.nickHistory || []).map(n => String(n).trim()).filter(n => n && n !== 'Unknown' && n !== curNick);
        const prevText = nHistory.length > 0 ? ` (전: ${nHistory.join(', ')})` : '';

        // ── 헤더 및 프로필 업데이트
        const gradeName = user.gradeName || user.grade || '---';
        const gradeColor = getGradeColor(gradeName);
        const gradeBase = `${gradeName}${user.gradeLevel ? ' ' + user.gradeLevel : ''}`;

        // 프리미엄 데이터에서 점수(gradePoint) 추출 (다이아몬드 제외)
        const gPoint = prem?.account?.gradePoint;
        const scoreSpan = (gPoint !== undefined && gPoint !== null && gPoint !== "" && !gradeName.includes('다이아몬드')) ? `&nbsp;&nbsp;<span style="color:#fff">${gPoint}점</span>` : "";

        updateText('user-nickname', `닉네임: ${curNick}${prevText}`);
        updateText('user-ano', `ANO: ${user.userANO || user.ano || ano}`);
        updateHtml('user-grade', `등급: <span style="color:${gradeColor}">${gradeBase}</span>${scoreSpan}`);
        updateText('user-rank', `${user.RTRank || user.rank || '---'}위`);

        updateText('stat-nick', curNick);
        updateText('stat-prev-nicks', nHistory.join(', ') || '---');
        updateText('stat-ano-val', user.userANO || user.ano || ano);

        // ── PROFILE 섹션
        updateText('sp-nick', curNick);
        updateHtml('sp-grade', `<span style="color:${gradeColor}">${gradeBase}</span>${scoreSpan}`);
        updateText('sp-rank', `${user.RTRank || user.rank || '---'}위`);

        // 전닉 표시
        const spPrevCont = document.getElementById('sp-prev-nick-container');
        if (spPrevCont) {
            if (nHistory.length > 0) {
                updateText('sp-prev-nick', nHistory.join(', '));
                spPrevCont.style.display = 'block';
            } else {
                spPrevCont.style.display = 'none';
            }
        }

        updateText('sp-ano', `ANO ${user.userANO || user.ano || ano}`);

        // 메모(어검술 킬러 등) 처리
        const memo = prem?.account?.memo || "";
        const memoCont = document.getElementById('sp-memo-container');
        if (memoCont) {
            if (memo) {
                updateHtml('sp-memo', memo); // <br />가 텍스트로 보이지 않게 처리
                memoCont.style.display = 'block';
            } else {
                memoCont.style.display = 'none';
            }
        }

    } catch (e) { console.error(e); }

    // ── RECORDS 섹션 (Premium 우선 적용하되 최신 승패는 user 객체 기준)
    const premEntry = prem;
    try {
        // 공통: 메인 데이터 기준 최신 전적 및 수치 추출
        const recentW = Number(findVal(user, ['WinCount', 'winCount', 'win']) || swl.totalWinCount || 0);
        const recentL = Number(findVal(user, ['LoseCount', 'loseCount', 'lose']) || swl.totalLoseCount || 0);
        const recentP = (recentW + recentL) || Number(findVal(user, ['playCount', 'PlayCount']) || swl.playCount || 1);
        let recentWrRaw = findVal(user, ['WinRate_InclDisc', 'winRate']) || swl.totalWinRate;
        let recentWr = recentWrRaw ? parseInt(String(recentWrRaw).replace('%', ''), 10) : Math.round((recentW / recentP) * 100);

        // UI 문자열 공통 포맷 구성
        const seasonTxt = fmtDetailedRec(recentP, recentW, recentL, recentWr);
        const spSeasonTxt = `<span style="white-space:nowrap !important">${recentP}전 <span class="win-text">${recentW}승</span> <span class="loss-text">${recentL}패</span></span><br><div class="sp-win-rate" style="display:inline-block">(${recentWr}%)</div>`;
        const rcData = {
            winCnt: recentW,
            loseCnt: recentL,
            seasonWinningRate: recentWrRaw || recentWr
        };

        if (premEntry) {
            // Premium 유저라도 승무패 수치는 최신 메인 데이터 덮어쓰기
            const prData = Object.assign({}, premEntry.rankingRecord, rcData);
            fillRecordBlock('sp-rk', prData);
            fillRecordBlock('sp-all', premEntry.totalRecord || null);

            // 사이드바 전적 업데이트 사항 동기화 적용
            updateHtml('stat-season-rec', seasonTxt);
            updateText('user-season-wr', `${recentWr}%`);
            updateHtml('sp-stat-season-rec', spSeasonTxt);

            // ── 파티 전적 표시 (전체 / 랭킹)
            const fillPartyRec = (rowId, recId, rec) => {
                const row = document.getElementById(rowId);
                const el = document.getElementById(recId);
                if (!row || !el || !rec) { if (row) row.style.display = 'none'; return; }
                const pw = Number(rec.partyWinCnt || 0);
                const pl = Number(rec.partyLoseCnt || 0);
                const pd = Number(rec.partyDrawCnt || 0);
                if (pw + pl + pd === 0) { row.style.display = 'none'; return; }
                row.style.display = '';
                const mainL = Number(rec.loseCnt || rec.LoseCount || rec.totalLoseCount || 0);
                const hasThreeDigitLoss = (mainL >= 100 || pl >= 100);
                const winMargin = hasThreeDigitLoss ? '3px' : '0px';
                const pfmt = (n, cls, label, numW, labelMargin) => {
                    const marginStyle = labelMargin ? `margin-right:${labelMargin};` : '';
                    return `<span class="${cls}" style="display:inline-block;min-width:${numW};text-align:right">${n}</span>` +
                           `<span class="${cls}" style="${marginStyle}">${label}</span>`;
                };
                el.innerHTML = pfmt(pw,'win-text','승','2.0em',winMargin) + 
                               pfmt(pl,'loss-text','패','2.0em','4px') + 
                               pfmt(pd,'','무','0.8em','');
            };
            fillPartyRec('sp-all-party-row', 'sp-all-party-rec', premEntry.totalRecord);
            fillPartyRec('sp-rk-party-row', 'sp-rk-party-rec', premEntry.rankingRecord);
        } else {
            // 일반 유저: 기존 데이터 세팅 + 파티 승률 포함
            updateHtml('stat-season-rec', seasonTxt);
            updateText('user-season-wr', `${recentWr}%`);
            updateHtml('sp-stat-season-rec', spSeasonTxt);

            fillRecordBlock('sp-rk', {
                winCnt: recentW, loseCnt: recentL,
                seasonWinningRate: recentWrRaw || recentWr,
                thisWeekWinningRate: swl.thisWeekWinningRate || 0,
                seasonPartyWinningRate: swl.seasonPartyWinningRate || 0,
                thisWeekPartyWinningRate: swl.thisWeekPartyWinningRate || 0,
                disconnectCnt: swl.disconnectCnt || 0,
            });
            fillRecordBlock('sp-all', allWl);

            // 일반 유저는 파티전적 숨김
            const hideParty = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
            hideParty('sp-all-party-row');
            hideParty('sp-rk-party-row');
        }

    } catch (e) { console.error(e); }


    // ── 상세 통계 (왼쪽 패널)
    try {
        const tc = [findVal(user, ['totalContribute']), findVal(detail, ['totalContribute', 'avgContribute']), findVal(user, ['avgContribute', 'totalContribution'])].find(v => v !== undefined && v !== null && v !== "0" && v !== 0) || 0;
        const cc = [findVal(user, ['combatContributeAvg']), findVal(detail, ['combatContributeAvg']), findVal(user, ['combatContributionAvg'])].find(v => v !== undefined && v !== null && v !== "0" && v !== 0) || 0;
        const crRaw = findVal(user, ['combatRateAvg', 'battleJoinRate', 'combatRate']) || findVal(detail, ['combatRateAvg']) || 0;
        const crNum = Number(String(crRaw).replace('%', ''));
        const cr = isNaN(crNum) ? crRaw : crNum.toFixed(4);
        const lv = [findVal(user, ['lastLevelAvg', 'averageCharacterLevel', 'avgLevel']), findVal(detail, ['lastLevelAvg'])].find(v => v !== undefined && v !== null && v !== "0" && v !== 0) || 0;
        const kda = findVal(user, ['killDieAssistRate', 'kda', 'killDieAssistAvg']) || findVal(detail, ['killDieAssistRate']) || 0;
        const dispell = findVal(user, ['dispellCntAvg', 'avgDispell', 'dispellAvg']) || findVal(detail, ['dispellCntAvg']) || 0;
        const potion = findVal(user, ['potionCntAvg', 'avgPotion', 'potionAvg']) || findVal(detail, ['potionCntAvg']) || 0;
        const gold = [findVal(user, ['totalGoldAvg', 'averageGetGold', 'avgGold']), findVal(detail, ['totalGoldAvg'])].find(v => v !== undefined && v !== null && v !== "0" && v !== 0) || 0;

        updateText('stat-total-cont', Number(tc).toLocaleString());
        updateText('stat-combat-cont', Number(cc).toLocaleString());
        updateText('stat-combat-rate', `${cr}%`);
        updateText('stat-avg-lv', `Lv.${lv}`);
        updateText('stat-kda', Number(kda).toFixed(2));
        updateText('stat-avg-dispell', `${dispell}회`);
        updateText('stat-avg-potion', `${potion}회`);
        updateText('stat-avg-gold', Number(gold).toLocaleString());


        // Sync to Profile Panel (Mobile optimized section)
        updateText('sp-stat-total-cont', Number(tc).toLocaleString());
        updateText('sp-stat-combat-cont', Number(cc).toLocaleString());
        updateText('sp-stat-combat-rate', `${cr}%`);
        updateText('sp-stat-avg-lv', `Lv.${lv}`);
        updateText('sp-stat-kda', Number(kda).toFixed(2));
        updateText('sp-stat-avg-dispell', `${dispell}회`);
        updateText('sp-stat-avg-potion', `${potion}회`);
        updateText('sp-stat-avg-gold', Number(gold).toLocaleString());
    } catch (e) { console.error(e); }

    // ── 전체 랭대 전적 (온디맨드 API)
    try {
        window.currentFetchAno = norm; // 현재 클릭된 유저 식별자 저장 (Race Condition 방지)

        // 로딩 상태를 즉시 UI에 반영
        updateHtml('stat-overall-rec', '<span style="color:#888">확인 중...</span>');
        updateHtml('stat-total-rec', '<span style="color:#888">확인 중...</span>');
        updateHtml('sp-stat-overall-rec', '<span style="color:#888">확인 중...</span>');
        updateHtml('sp-stat-total-rec', '<span style="color:#888">확인 중...</span>');
        updateText('stat-consecutive', '---');
        updateText('sp-stat-consecutive', '---');

        const worker = 'https://script.google.com/macros/s/AKfycbzO9f8GKZPvfyQIl4zpX7KLx5yiy0dRmxpV6CilJKY7BFrVs7hPzGrXnRgzx_0A5QnOoA/exec';

        // 공통 데이터 페치 함수
        const fetchRecord = (targetAno, type, retriesLeft, callback) => {
            fetch(`${worker}?ano=${targetAno}&recordType=${type}&tabType=A`)
                .then(r => r.text())
                .then(t => {
                    if (window.currentFetchAno !== targetAno) return;
                    const f = t.indexOf('{'), lx = t.lastIndexOf('}');
                    if (f !== -1 && lx !== -1) {
                        try {
                            const j = JSON.parse(t.substring(f, lx + 1)
                                .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                                .replace(/:\s*'([^']*)'/g, ':"$1"')
                                .replace(/,\s*([\]\}])/g, '$1'));
                            callback(j);
                        } catch (e) { handleErr(targetAno, type, retriesLeft, callback); }
                    } else { handleErr(targetAno, type, retriesLeft, callback); }
                })
                .catch(() => handleErr(targetAno, type, retriesLeft, callback));
        };

        const handleErr = (targetAno, type, retriesLeft, callback) => {
            if (window.currentFetchAno !== targetAno) return;
            if (retriesLeft > 0) setTimeout(() => fetchRecord(targetAno, type, retriesLeft - 1, callback), 1500);
            else {
                const errHtml = '<span style="color:#f87171">조회 실패</span>';
                if (type === 1) {
                    updateHtml('stat-total-rec', errHtml); updateHtml('sp-stat-total-rec', errHtml);
                    updateText('stat-consecutive', '---'); updateText('sp-stat-consecutive', '---');
                } else {
                    updateHtml('stat-overall-rec', errHtml); updateHtml('sp-stat-overall-rec', errHtml);
                }
            }
        };

        // 1. 랭대 전적 페치 (recordType=1)
        fetchRecord(norm, 1, 5, (j) => {
            const tw = Number(j.winLoseTendency?.totalWinCount || 0);
            const tl = Number(j.winLoseTendency?.totalLoseCount || 0);
            const tc = Number(j.winLoseTendency?.consecutiveWinLose || 0);
            const tGames = tw + tl;
            const wr = Math.round(tw / (tGames || 1) * 100);
            const recHtml = fmtDetailedRec(tGames, tw, tl, wr);
            const spRecHtml = `<span style="white-space:nowrap !important">${tGames}전 <span class="win-text">${tw}승</span> <span class="loss-text">${tl}패</span></span><br><div class="sp-win-rate" style="display:inline-block">(${wr}%)</div>`;
            const consHtml = tc > 0 ? `<span style="color:#3FB950">${tc}연승</span>` : (tc < 0 ? `<span style="color:#FF4D4D">${Math.abs(tc)}연패</span>` : '---');

            updateHtml('stat-total-rec', recHtml);
            updateHtml('stat-consecutive', consHtml);
            updateHtml('sp-stat-total-rec', spRecHtml);
            updateHtml('sp-stat-consecutive', consHtml);
        });

        // 2. 전체 전적 페치 (recordType=0)
        fetchRecord(norm, 0, 5, (j) => {
            const tw = Number(j.winLoseTendency?.totalWinCount || 0);
            const tl = Number(j.winLoseTendency?.totalLoseCount || 0);
            const tGames = tw + tl;
            const wr = Math.round(tw / (tGames || 1) * 100);
            const recHtml = fmtDetailedRec(tGames, tw, tl, wr);
            const spRecHtml = `<span style="white-space:nowrap !important">${tGames}전 <span class="win-text">${tw}승</span> <span class="loss-text">${tl}패</span></span><br><div class="sp-win-rate" style="display:inline-block">(${wr}%)</div>`;

            updateHtml('stat-overall-rec', recHtml);
            updateHtml('sp-stat-overall-rec', spRecHtml);

            if (!premEntry) fillRecordBlock('sp-all', j.winLoseTendency || {});
        });
    } catch (e) { }

    // ── HEROES 섹션
    try {
        const heroes = getUserHeroes(norm, user, detail);
        currentHeroList = heroes;

        // 왼쪽 헤더 영웅 미니 아이콘
        const isMobile = window.innerWidth <= 900;
        const iconSlice = isMobile ? 14 : 7;
        const gridCols = isMobile ? 7 : 7;

        updateHtml('hero-list', `<div style="display:inline-grid; grid-template-columns: repeat(${gridCols}, 34px); gap:8px;">${heroes.slice(0, iconSlice).map(c =>
            `<img src="img_hero/${c.characterNo || c}.png" class="hero-mini-icon" style="width:34px;height:34px;" onerror="this.src='img_hero/nop.png'">`
        ).join('')}</div>`);

        // 다른 유저 열었을 때 항상 판수(내림차순) 기준으로 초기화
        currentHeroSortKey = 'playCnt';
        currentHeroSortAsc = false;

        // 선호 영웅 테이블 (판수/승률/파티승률)
        fillHeroTable('sp-hero-list', 'sp-hero-title', heroes);

    } catch (e) { console.error('Hero list render failed', e); }

    // Final scroll reset to top (Robust version)
    if (panel) {
        panel.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(() => { panel.scrollTop = 0; }, 100);
    }
}

window.closeProfilePanel = () => {
    const panel = document.getElementById('sliding-profile');
    if (panel) panel.classList.remove('open');

    // 메인 그리드 레이아웃 복원
    const grid = document.querySelector('.dashboard-grid');
    if (grid) grid.classList.remove('panel-open');
    const tableCont = document.getElementById('table-container');
    if (tableCont) tableCont.classList.remove('panel-open');

    document.querySelectorAll('#ranking-body tr').forEach(tr => {
        tr.style.backgroundColor = '';
        tr.style.outline = '';
    });
};

// 패널 외부 클릭 시 닫기 (mousedown이 더 확실함)
document.addEventListener('mousedown', (e) => {
    const panel = document.getElementById('sliding-profile');
    if (panel && panel.classList.contains('open')) {
        // 클릭된 요소가 패널 내부가 아니고, 랭킹 행도 아니며, 닫기 버튼도 아니며, 검색창 영역도 아닌 경우
        if (!panel.contains(e.target) && !e.target.closest('#ranking-body tr') &&
            !e.target.closest('.close-panel-btn') && !e.target.closest('.search-container-v2')) {
            closeProfilePanel();
        }
    }
});



init();

