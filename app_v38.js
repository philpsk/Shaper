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
let selectedAno = null;   // 현재 선택된 유저 (페이지 이동 후에도 하이라이트 유지)
let sortActive = false;  // 헤더 정렬을 한 번이라도 눌렀는지 (검색 후에도 정렬 유지용)
let userIndex = new Map(); // 정규화 ANO → 유저 객체 (행 클릭 시 전체 탐색 방지)
let recordCtl = null;    // 진행 중인 온디맨드 전적 요청 (다른 유저를 열면 취소)
let indexReady = false;  // prepareData() 완료 여부 (첫 화면을 먼저 그리고 나머지는 유휴 시간에 계산)
let searchQuery = '';    // 현재 검색어 (소문자)
let sortedAll = null;    // 현재 정렬 기준으로 정렬된 전체 목록 (검색 시 재정렬 없이 필터만 하기 위한 캐시)
const collator = new Intl.Collator();   // localeCompare 대비 정렬이 훨씬 빠르고 결과는 동일

const NOP_IMG = 'img_hero/nop.png';
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]); }
// 메모는 <br>만 허용하고 나머지는 모두 이스케이프
function sanitizeMemo(v) { return esc(v).replace(/&lt;br\s*\/?&gt;/gi, '<br>'); }
function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
// 캐시 무효화용 쿼리스트링 대신 재검증(ETag/304)을 사용
async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
}

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

// 사이드 패널용 전적 요약 (3곳에서 같은 마크업을 쓰던 것을 통합)
function spRecHtml(games, w, l, wr) {
    return `<span style="white-space:nowrap !important">${games}전 <span class="win-text">${w}승</span> <span class="loss-text">${l}패</span></span><br><div class="sp-win-rate" style="display:inline-block">(${wr}%)</div>`;
}

// 승/패/무 숫자 + 라벨 (RECORDS 블록과 파티 전적이 같은 형식)
function fmtWLD(w, l, d, threeDigitLoss) {
    const part = (n, cls, label, numW, margin) =>
        `<span class="${cls}" style="display:inline-block;min-width:${numW};text-align:right">${n}</span>` +
        `<span class="${cls}" style="${margin ? `margin-right:${margin};` : ''}">${label}</span>`;
    return part(w, 'win-text', '승', '2.0em', threeDigitLoss ? '3px' : '0px') +
           part(l, 'loss-text', '패', '2.0em', '4px') +
           part(d, '', '무', '0.8em', '');
}

// 영웅 미니 아이콘 <img> (속성값은 항상 이스케이프)
function heroIcon(c, style) {
    const cno = c.characterNo || c;
    const src = (cno && cno !== '[object Object]') ? `img_hero/${cno}.png` : NOP_IMG;
    return `<img src="${esc(src)}" class="hero-mini-icon" alt="" loading="lazy" decoding="async"${style ? ` style="${style}"` : ''}>`;
}

// winLoseTendency 응답 → 숫자 요약
function parseTendency(j) {
    const t = j.winLoseTendency;
    const w = Number(t?.totalWinCount || 0);
    const l = Number(t?.totalLoseCount || 0);
    const games = w + l;
    return { w, l, games, wr: Math.round(w / (games || 1) * 100), cons: Number(t?.consecutiveWinLose || 0) };
}

// 필드 추출기
function findVal(obj, keys) {
    if (!obj) return null;
    for (let k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
    }
    return null;
}

// 로딩 직후 한 번만 계산해 두는 값들.
// 검색·정렬은 키 입력/클릭마다 수만 건을 훑으므로, 문자열 가공과 파싱을 여기서 끝내 둔다.
function prepareData() {
    userIndex = new Map();
    for (const u of allData) {
        const ano = u.userANO || u.ano;
        const norm = normalizeAno(ano);
        const nick = (u.nick || u.nickname || '').toLowerCase();
        const hist = (userDetails[norm]?.nickHistory || []).map(n => String(n).trim().toLowerCase());
        const rk = parseInt(u.RTRank || u.rank, 10);
        const w = parseInt(findVal(u, ['WinCount', 'winCount', 'win']) || 0, 10);
        const l = parseInt(findVal(u, ['LoseCount', 'loseCount', 'lose']) || 0, 10);
        u._k = {
            norm,
            nick,
            unr: u.RTRank === '-' || u.rank === '-' || Number.isNaN(rk),        // 순위 없는 유저
            rk: Number.isNaN(rk) ? 99999 : rk,                 // 순위 정렬용
            rk2: Number.isNaN(rk) ? 99999 : rk,               // 전적 정렬(하위 등급)용
            gw: getGradeWeight(u.gradeName || u.grade),
            wr: (w + l) > 0 ? w / (w + l) : 0,
            ano: Number(norm) || 0,
            // 닉네임 / ANO / 전닉을 한 덩어리로: includes() 한 번으로 세 가지를 모두 검사
            find: [nick, (ano || '').toString(), ...hist].join('\n'),
        };
        if (norm && !userIndex.has(norm)) userIndex.set(norm, u);
    }
    indexReady = true;
}
function ensureIndex() { if (!indexReady) prepareData(); }

async function init() {
    try {
        const [rank, details, premList, updateInfo] = await Promise.all([
            fetchJson('V88_FINAL_RANK_DEEP.json').catch(e => { console.error(e); return []; }),
            fetchJson('DB.json').catch(() => null),
            fetchJson('V82_FINAL_RANK_PREMIUM.json').catch(() => null),
            fetchJson('last_update.json').catch(() => null)
        ]);
        allData = rank;
        if (details) userDetails = details;
        if (premList) {
            // account.ano 또는 account.userANO로 ANO 매핑
            premList.forEach(entry => {
                const acc = entry.account || {};
                const ano = normalizeAno(acc.ano || acc.userANO || '');
                if (ano) premiumMap[ano] = entry;
            });
        }
        if (updateInfo) updateText('last-update-time', updateInfo.last_update || '---');
        filteredData = [...allData];
        renderTable();
        (window.requestIdleCallback || setTimeout)(() => ensureIndex());   // 첫 화면 이후 유휴 시간에
        setupSearchClear();
        setupInteractions();
        document.getElementById('search-input')?.addEventListener('input', debounce(handleSearch, 150));
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.tabIndex = 0;
            th.addEventListener('click', () => sortData(th.dataset.sort));
            th.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortData(th.dataset.sort); }
            });
        });
        document.querySelectorAll('th[data-hero-sort]').forEach(th => {
            th.tabIndex = 0;
            th.addEventListener('click', () => sortHeroData(th.dataset.heroSort));
            th.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortHeroData(th.dataset.heroSort); }
            });
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

    ensureIndex();
    searchQuery = v;
    refreshFiltered();   // 정렬한 뒤 검색해도 정렬 상태가 유지된다
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
    sortActive = true;

    // Update header icons
    document.querySelectorAll('th[data-sort]').forEach(th => {
        const k = th.dataset.sort;
        let txt = th.innerText.replace(/[↕↑↓]/g, '').trim();
        if (k === sortKey) txt += (sortAsc ? ' ↑' : ' ↓');
        else txt += ' ↕';
        th.innerText = txt;
        th.setAttribute('aria-sort', k === sortKey ? (sortAsc ? 'ascending' : 'descending') : 'none');
    });

    ensureIndex();
    sortedAll = [...allData].sort(makeComparator(sortKey, sortAsc));   // 동률은 기본(순위) 순서 유지
    refreshFiltered();
    currentPage = 1; renderTable();
}

// 현재 검색어 + 정렬 상태로 filteredData 를 다시 만든다. (정렬은 sortedAll 캐시에서 이미 끝나 있음)
function refreshFiltered() {
    const base = sortActive ? sortedAll : allData;
    filteredData = searchQuery ? base.filter(u => u._k.find.includes(searchQuery)) : [...base];
}

// 비교 함수는 prepareData() 가 만들어 둔 u._k 만 읽는다. (비교마다 parseInt/문자열 가공을 반복하지 않음)
function makeComparator(key, asc) {
    switch (key) {
        case 'nick':
            return (a, b) => asc ? collator.compare(a._k.nick, b._k.nick) : collator.compare(b._k.nick, a._k.nick);

        case 'grade':
            return (a, b) => {
                const ka = a._k, kb = b._k;
                if (ka.unr !== kb.unr) return ka.unr ? 1 : -1;   // 순위 없는 유저는 항상 맨 아래
                return asc ? kb.gw - ka.gw : ka.gw - kb.gw;       // 높은 등급이 기본 위로
            };

        case 'wr':
            return (a, b) => {
                const ka = a._k, kb = b._k;
                // 사파이어 이상은 항상 정렬 포함, 에메랄드 이하는 하단 고정
                const aMain = ka.gw >= 3000, bMain = kb.gw >= 3000;
                if (aMain !== bMain) return aMain ? -1 : 1;
                if (!aMain) {   // 둘 다 정렬 제외: 순위 오름차순
                    if (ka.unr !== kb.unr) return ka.unr ? 1 : -1;
                    return ka.rk2 - kb.rk2;
                }
                if (ka.wr === kb.wr) return 0;
                return asc ? (ka.wr > kb.wr ? 1 : -1) : (ka.wr < kb.wr ? 1 : -1);
            };

        case 'ano':   // 정규화한 숫자로 비교 (예전에는 a.ano 만 읽어서 userANO 만 있는 데이터는 정렬이 안 됐음)
            return (a, b) => asc ? a._k.ano - b._k.ano : b._k.ano - a._k.ano;

        default:      // 'rank'
            return (a, b) => {
                const ka = a._k, kb = b._k;
                if (ka.unr !== kb.unr) return ka.unr ? 1 : -1;   // 순위 없는 유저는 항상 맨 아래
                return asc ? ka.rk - kb.rk : kb.rk - ka.rk;
            };
    }
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
    const isMobile = window.innerWidth <= 900;   // 행마다 읽을 필요 없음
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
        const wrNum = Math.min(100, Math.max(0, Number.parseFloat(wr) || 0));
        const heroes = getUserHeroes(ano, u, userDetails[norm] || {});

        let displayGrade = grade;
        if (isMobile && grade !== "---") {
            displayGrade = grade.replace('다이아몬드', '다이아')
                .replace('사파이어', '사파')
                .replace('에메랄드', '에메')
                .replace('자수정', '자수');
        }

        const icons = heroes.slice(0, 7).map(c => heroIcon(c)).join('');   // 한 줄에 항상 7개
        return `<tr data-ano="${esc(ano)}" tabindex="0"${norm === selectedAno ? ' class="is-selected"' : ''}>
            <td>${esc(rank)}</td>
            <td style="text-align:center; overflow:hidden; text-overflow:ellipsis;">${esc(nick)}</td>
            <td class="hide-on-panel hide-on-mobile"><div class="hero-icons-container">${icons}</div></td>
            <td class="hide-on-panel" style="color:${getGradeColor(grade)}; text-align:center;">${esc(displayGrade)}</td>
            <td class="hide-on-panel">
                <div class="record-cell" style="justify-content: center;">
                  <div class="wl-bar-container" style="width: 120px;">
                    <div class="wl-bar-win" style="width: ${wrNum}%">
                      ${win}<span class="wl-label">W</span>
                    </div>
                    <div class="wl-bar-loss">
                      ${loss}<span class="wl-label">L</span>
                    </div>
                  </div>
                </div>
            </td>
            <td class="hide-on-panel" style="text-align:center;">${wrNum}%</td>
            <td class="hide-on-mobile" style="color:#58A6FF; text-align:center;">${esc(ano)}</td>
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

    let h = `<div class="pagination-area" role="navigation" aria-label="페이지 이동">`;

    // 처음/이전 버튼
    h += `<button data-page="1" class="pg-btn" ${currentPage === 1 ? 'disabled' : ''} title="처음으로">«</button>`;
    h += `<button data-page="${currentPage - 1}" class="pg-btn" ${currentPage === 1 ? 'disabled' : ''} title="이전">‹</button>`;

    // 숫자 버튼
    for (let i = startPage; i <= endPage; i++) {
        h += `<button data-page="${i}" class="pg-btn ${i === currentPage ? 'active' : ''}"${i === currentPage ? ' aria-current="page"' : ''} aria-label="${i}페이지">${i}</button>`;
    }

    // 다음/끝 버튼
    h += `<button data-page="${currentPage + 1}" class="pg-btn" ${currentPage === totalPages ? 'disabled' : ''} title="다음">›</button>`;
    h += `<button data-page="${totalPages}" class="pg-btn" ${currentPage === totalPages ? 'disabled' : ''} title="맨 끝으로">»</button>`;

    // 페이지 입력
    h += `
        <div class="pg-input-wrapper">
            <input type="number" class="pg-input" value="${currentPage}" min="1" max="${totalPages}" 
                data-page-input aria-label="페이지 번호 입력">
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
        elRec.innerHTML = fmtWLD(w, l, d, l >= 100 || Number(rec.partyLoseCnt || 0) >= 100);
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
            <td>${esc(name)}</td>
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
    ensureIndex();
    const user = userIndex.get(norm);
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
    selectedAno = norm;
    document.querySelectorAll('#ranking-body tr.is-selected').forEach(tr => tr.classList.remove('is-selected'));
    if (trElement) trElement.classList.add('is-selected');

    try {
        const curNick = user.nick || user.nickname || 'Unknown';
        const nHistory = [...new Set((detail.nickHistory || []).map(n => String(n).trim()).filter(n => n && n !== 'Unknown' && n !== curNick))];
        const prevText = nHistory.length > 0 ? ` (전: ${nHistory.join(', ')})` : '';

        // ── 헤더 및 프로필 업데이트
        const gradeName = user.gradeName || user.grade || '---';
        const gradeColor = getGradeColor(gradeName);
        const gradeBase = `${esc(gradeName)}${user.gradeLevel ? ' ' + esc(user.gradeLevel) : ''}`;

        // 프리미엄 데이터에서 점수(gradePoint) 추출 (다이아몬드 제외)
        const gPoint = prem?.account?.gradePoint;
        const scoreSpan = (gPoint !== undefined && gPoint !== null && gPoint !== "" && !gradeName.includes('다이아몬드')) ? `&nbsp;&nbsp;<span style="color:#fff">${esc(gPoint)}점</span>` : "";

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
                updateHtml('sp-memo', sanitizeMemo(memo)); // <br />가 텍스트로 보이지 않게 처리
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
        const recentP = (recentW + recentL) > 0 ? (recentW + recentL) : Number(findVal(user, ['playCount', 'PlayCount']) || swl.playCount || 0);
        let recentWrRaw = findVal(user, ['WinRate_InclDisc', 'winRate']) || swl.totalWinRate;
        let recentWr = recentWrRaw ? parseInt(String(recentWrRaw).replace('%', ''), 10) : (recentP > 0 ? Math.round((recentW / recentP) * 100) : 0);

        // UI 문자열 공통 포맷 구성
        const seasonTxt = fmtDetailedRec(recentP, recentW, recentL, recentWr);
        const spSeasonTxt = spRecHtml(recentP, recentW, recentL, recentWr);
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
                el.innerHTML = fmtWLD(pw, pl, pd, mainL >= 100 || pl >= 100);
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

        const toNum = (v, def = 0) => {
            const n = Number(String(v).replace(/,/g, '').trim());
            return Number.isFinite(n) ? n : def;
        };

        // 왼쪽 사이드바(stat-*)와 프로필 패널(sp-stat-*)에 같은 값을 채운다
        const stats = {
            'total-cont': toNum(tc).toLocaleString(),
            'combat-cont': toNum(cc).toLocaleString(),
            'combat-rate': `${cr}%`,
            'avg-lv': `Lv.${lv || 0}`,
            'kda': toNum(kda).toFixed(2),
            'avg-dispell': `${dispell || 0}회`,
            'avg-potion': `${potion || 0}회`,
            'avg-gold': toNum(gold).toLocaleString(),
        };
        for (const [k, v] of Object.entries(stats)) {
            updateText(`stat-${k}`, v);
            updateText(`sp-stat-${k}`, v);
        }
    } catch (e) { console.error(e); }

    // ── 전체 랭대 전적 (온디맨드 API)
    try {
        // 이전 유저의 요청이 아직 진행 중이면 끊는다 (화면 뒤섞임 방지 + 불필요한 재시도 제거)
        recordCtl?.abort();
        recordCtl = new AbortController();
        const { signal } = recordCtl;

        // 로딩 상태를 즉시 UI에 반영
        updateHtml('stat-overall-rec', '<span style="color:#888">확인 중...</span>');
        updateHtml('stat-total-rec', '<span style="color:#888">확인 중...</span>');
        updateHtml('sp-stat-overall-rec', '<span style="color:#888">확인 중...</span>');
        updateHtml('sp-stat-total-rec', '<span style="color:#888">확인 중...</span>');
        updateText('stat-consecutive', '---');
        updateText('sp-stat-consecutive', '---');

        const worker = 'https://script.google.com/macros/s/AKfycbzO9f8GKZPvfyQIl4zpX7KLx5yiy0dRmxpV6CilJKY7BFrVs7hPzGrXnRgzx_0A5QnOoA/exec';

        const handleErr = (type, retriesLeft, callback) => {
            if (signal.aborted) return;
            if (retriesLeft > 0) {
                setTimeout(() => fetchRecord(type, retriesLeft - 1, callback), 1500);
                return;
            }
            const errHtml = '<span style="color:#f87171">조회 실패</span>';
            if (type === 1) {
                updateHtml('stat-total-rec', errHtml); updateHtml('sp-stat-total-rec', errHtml);
                updateText('stat-consecutive', '---'); updateText('sp-stat-consecutive', '---');
            } else {
                updateHtml('stat-overall-rec', errHtml); updateHtml('sp-stat-overall-rec', errHtml);
            }
        };

        // 공통 데이터 페치 함수
        const fetchRecord = (type, retriesLeft, callback) => {
            fetch(`${worker}?ano=${norm}&recordType=${type}&tabType=A`, { signal })
                .then(r => r.text())
                .then(t => {
                    if (signal.aborted) return;
                    const f = t.indexOf('{'), lx = t.lastIndexOf('}');
                    if (f === -1 || lx === -1) return handleErr(type, retriesLeft, callback);
                    let j;
                    try {
                        j = JSON.parse(t.substring(f, lx + 1)
                            .replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                            .replace(/:\s*'([^']*)'/g, ':"$1"')
                            .replace(/,\s*([\]\}])/g, '$1'));
                    } catch (e) { return handleErr(type, retriesLeft, callback); }
                    // 화면 갱신 중 오류가 나도 서버 재요청으로 이어지지 않게 분리
                    try { callback(j); } catch (e) { console.error(e); }
                })
                .catch(e => { if (e.name !== 'AbortError') handleErr(type, retriesLeft, callback); });
        };

        // 1. 랭대 전적 페치 (recordType=1)
        fetchRecord(1, 5, (j) => {
            const { w, l, games, wr, cons } = parseTendency(j);
            const consHtml = cons > 0 ? `<span style="color:#3FB950">${cons}연승</span>` : (cons < 0 ? `<span style="color:#FF4D4D">${Math.abs(cons)}연패</span>` : '---');

            updateHtml('stat-total-rec', fmtDetailedRec(games, w, l, wr));
            updateHtml('stat-consecutive', consHtml);
            updateHtml('sp-stat-total-rec', spRecHtml(games, w, l, wr));
            updateHtml('sp-stat-consecutive', consHtml);
        });

        // 2. 전체 전적 페치 (recordType=0)
        fetchRecord(0, 5, (j) => {
            const { w, l, games, wr } = parseTendency(j);

            updateHtml('stat-overall-rec', fmtDetailedRec(games, w, l, wr));
            updateHtml('sp-stat-overall-rec', spRecHtml(games, w, l, wr));

            if (!premEntry) fillRecordBlock('sp-all', j.winLoseTendency || {});
        });
    } catch (e) { console.error(e); }

    // ── HEROES 섹션
    try {
        const heroes = getUserHeroes(norm, user, detail);
        currentHeroList = heroes;

        // 왼쪽 헤더 영웅 미니 아이콘 (모바일 14개 / PC 7개)
        const iconSlice = window.innerWidth <= 900 ? 14 : 7;
        updateHtml('hero-list', `<div style="display:inline-grid; grid-template-columns: repeat(7, 34px); gap:8px;">${heroes.slice(0, iconSlice).map(c => heroIcon(c, 'width:34px;height:34px;')).join('')}</div>`);

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

    selectedAno = null;
    document.querySelectorAll('#ranking-body tr.is-selected').forEach(tr => tr.classList.remove('is-selected'));
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



// ===========================
// 이벤트 위임 / 키보드 / 이미지 폴백
// ===========================
function setupInteractions() {
    const body = document.getElementById('ranking-body');
    body?.addEventListener('click', e => {
        const tr = e.target.closest('tr[data-ano]');
        if (tr) selectUser(tr.dataset.ano, tr);
    });
    body?.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const tr = e.target.closest('tr[data-ano]');
        if (!tr || e.target !== tr) return;
        e.preventDefault();
        selectUser(tr.dataset.ano, tr);
    });

    ['pagination', 'pagination-top'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', e => {
            const btn = e.target.closest('[data-page]');
            if (btn && !btn.disabled) goToPage(btn.dataset.page);
        });
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.target.matches('[data-page-input]')) goToPage(e.target.value);
        });
        el.addEventListener('focusin', e => {
            if (e.target.matches('[data-page-input]')) e.target.select();
        });
    });

    document.querySelector('.close-panel-btn')?.addEventListener('click', () => closeProfilePanel());
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeProfilePanel();
    });

    // error 이벤트는 버블링되지 않으므로 캡처 단계에서 한 번만 처리 (무한 루프 방지)
    document.addEventListener('error', e => {
        const t = e.target;
        if (t.tagName === 'IMG' && !t.dataset.fallback) {
            t.dataset.fallback = '1';
            t.src = NOP_IMG;
        }
    }, true);
}

init();

