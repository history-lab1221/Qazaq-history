// ===== Qazaq History: расширения. Подключать ПОСЛЕ script.js =====

// --- 1. Убираем дубли вопросов и карточек ---
const uniq = (a, k) => { const s = new Set(); return a.filter(x => { const t = k(x).trim().toLowerCase(); return s.has(t) ? false : (s.add(t), true); }); };
questions.splice(0, questions.length, ...uniq(questions, q => q.question));
flashcardsData.splice(0, flashcardsData.length, ...uniq(flashcardsData, c => c.front));

// --- 2. Прогресс (хранится в браузере) ---
const LS = 'qh_v1', DAYS = [0, 1, 3, 7, 16];
const store = (() => { let d; try { d = JSON.parse(localStorage.getItem(LS)); } catch (e) {} return Object.assign({ hist: [], miss: {}, cards: {}, days: [] }, d || {}); })();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} };
const ymd = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
function touch() { const t = ymd(new Date()); if (!store.days.includes(t)) store.days = store.days.concat(t).slice(-120); }
function streak() {
    const set = new Set(store.days), d = new Date(); let s = 0;
    if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
    while (set.has(ymd(d))) { s++; d.setDate(d.getDate() - 1); }
    return s;
}
const pool = () => uniq(questions.concat(...Object.values(topicsData).map(t => t.quiz)), q => q.question);

// Ошибка = 2 «жизни»; чтобы вопрос ушёл из банка ошибок, нужно ответить верно дважды
function record(q, ok) {
    const m = store.miss;
    if (!ok) m[q.question] = 2;
    else if (m[q.question] && --m[q.question] <= 0) delete m[q.question];
}

// --- 3. Тесты: перемешивание ответов, режимы, таймер ---
// В исходных данных почти везде верный ответ стоит на 2-м месте — перемешиваем при показе
function prep(q) {
    const o = shuffle(q.answers.map((_, i) => i));
    return { ...q, answers: o.map(i => q.answers[i]), correct: o.indexOf(q.correct) };
}
const B = { mode: 'practice', t: null, left: 0, log: [] };

function startTest(custom = null, opts = {}) {
    clearInterval(B.t);
    B.mode = opts.mode || 'practice';
    const src = custom || shuffle(questions).slice(0, opts.n || 20);
    testQuestions = src.map(prep);
    currentQuestion = 0; score = 0; wrongQuestions = []; B.log = [];
    if (B.mode === 'exam') { B.left = (opts.minutes || 30) * 60; B.t = setInterval(tick, 1000); }
    showQuestion();
    window.scrollTo(0, 0);
}

function tick(init) {
    if (B.mode !== 'exam') return;
    if (init !== true) B.left--;
    const el = document.getElementById('timer');
    if (el) { el.textContent = '⏱ ' + Math.floor(B.left / 60) + ':' + String(B.left % 60).padStart(2, '0'); el.classList.toggle('low', B.left < 60); }
    if (B.left <= 0) finishExam();
}

function finishExam() {
    clearInterval(B.t);
    for (let i = currentQuestion; i < testQuestions.length; i++) {
        const q = testQuestions[i];
        B.log.push({ q, sel: -1, ok: false }); record(q, false); wrongQuestions.push(q);
    }
    showResult();
}

function exitTest() { clearInterval(B.t); location.reload(); }

function showQuestion() {
    const q = testQuestions[currentQuestion], n = testQuestions.length, ex = B.mode === 'exam';
    document.querySelector('main').innerHTML = `
        <section class="quiz">
            <button class="ghost" onclick="exitTest()">← Выйти</button>
            ${ex ? '<span class="timer" id="timer"></span>' : ''}
            <h2>${ex ? 'Экзамен' : B.mode === 'mist' ? 'Работа над ошибками' : 'Тест по истории Казахстана'}</h2>
            <div class="progress-container"><div class="progress-fill" style="width:${currentQuestion / n * 100}%"></div></div>
            <p class="progress">Вопрос ${currentQuestion + 1} из ${n}. Выбирай ответ клавишами 1–4.</p>
            <h3>${q.question}</h3>
            <div class="answers">
                ${q.answers.map((a, i) => `<button class="answer" onclick="checkAnswer(${i}, this)">${i + 1}. ${a}</button>`).join('')}
            </div>
            <p id="feedback"></p>
            <button id="nextButton" onclick="nextQuestion()" hidden>${currentQuestion === n - 1 ? 'Завершить тест' : 'Следующий вопрос →'}</button>
        </section>`;
    tick(true);
}

function checkAnswer(sel, btn) {
    const q = testQuestions[currentQuestion], ok = sel === q.correct;
    B.log.push({ q, sel, ok }); record(q, ok);
    if (ok) score++; else wrongQuestions.push(q);
    if (B.mode === 'exam') return nextQuestion();   // в экзамене подсказок нет

    document.querySelectorAll('.answer').forEach((b, i) => { b.disabled = true; if (i === q.correct) b.classList.add('btn-correct'); });
    if (!ok) btn.classList.add('btn-wrong');
    document.getElementById('feedback').innerHTML = ok
        ? `<span class="correct">✅ Правильно!</span><p>${q.explanation}</p>`
        : `<span class="incorrect">❌ Неправильно!</span><p>Правильный ответ: <strong>${q.answers[q.correct]}</strong></p><p>${q.explanation}</p>`;
    document.getElementById('nextButton').hidden = false;
}

function nextQuestion() {
    if (++currentQuestion < testQuestions.length) showQuestion();
    else { clearInterval(B.t); showResult(); }
}

function showResult() {
    const n = testQuestions.length, pct = Math.round(score / n * 100), bad = B.log.filter(x => !x.ok);
    store.hist = store.hist.concat({ d: Date.now(), s: score, n, m: B.mode }).slice(-50);
    touch(); save();
    document.querySelector('main').innerHTML = `
        <section class="quiz result">
            <h2>Тест завершён</h2>
            <p>Твой результат (${pct}%):</p>
            <h1>${score} из ${n}</h1>
            <p>${pct === 100 ? '🔥 Идеально!' : pct >= 70 ? '👍 Хороший результат. Разбери ошибки ниже, и будет идеал.' : '📚 Повтори тему и пройди работу над ошибками.'}</p>
            <div class="main-buttons">
                ${bad.length ? `<button class="retry-btn" onclick="retryMistakes()">🔄 Работа над ошибками (${bad.length})</button>` : ''}
                <button onclick="startTest(null, {mode: B.mode === 'exam' ? 'exam' : 'practice'})">Пройти заново</button>
                <button onclick="location.reload()">На главную</button>
            </div>
            ${bad.length ? '<h2>Разбор ошибок</h2>' : ''}
            ${bad.map(x => `<div class="review"><b>${x.q.question}</b>
                <p>Твой ответ: ${x.sel < 0 ? 'нет ответа' : x.q.answers[x.sel]}</p>
                <p class="correct">Верно: ${x.q.answers[x.q.correct]}</p>
                <p>${x.q.explanation}</p></div>`).join('')}
        </section>`;
    window.scrollTo(0, 0);
}

function retryMistakes() { startTest(wrongQuestions.slice(), { mode: 'mist' }); }

// --- 4. Флеш-карточки с интервальным повторением ---
const box = c => (store.cards[c.front] || { b: 0 }).b;

function openFlashcards() {
    const now = Date.now();
    let due = flashcardsData.filter(c => { const s = store.cards[c.front]; return !s || s.due <= now; });
    if (!due.length) due = flashcardsData.slice();
    flashcardsSession = shuffle(due).sort((a, b) => box(a) - box(b)).slice(0, 30);  // слабые карточки — первыми
    flashcardsSession.forEach(c => delete c._r);
    currentCardIndex = 0; isCardFlipped = false;
    renderFlashcard();
}

function renderFlashcard() {
    const c = flashcardsSession[currentCardIndex], n = flashcardsSession.length;
    document.querySelector('main').innerHTML = `
        <section class="quiz">
            <button class="ghost" onclick="location.reload()">← На главную</button>
            <h2>Флеш-карточки (${currentCardIndex + 1} из ${n})</h2>
            <div class="progress-container"><div class="progress-fill" style="width:${currentCardIndex / n * 100}%"></div></div>
            <div class="flashcard" onclick="flipCard()">
                <h2>${isCardFlipped ? c.back : c.front}</h2>
                <span class="flashcard-hint">${isCardFlipped ? '' : '(Нажми или Пробел, чтобы увидеть ответ)'}</span>
            </div>
            <div class="main-buttons">
                ${isCardFlipped
                    ? '<button class="bad" onclick="grade(false)">❌ Не знаю (1)</button><button class="good" onclick="grade(true)">✅ Знаю (2)</button>'
                    : '<button onclick="flipCard()">Показать ответ</button>'}
            </div>
        </section>`;
}

function grade(ok) {
    const c = flashcardsSession[currentCardIndex], s = store.cards[c.front] || { b: 0 };
    s.b = ok ? Math.min(s.b + 1, 4) : 0;
    s.due = Date.now() + (ok ? DAYS[s.b] : 0) * 864e5;   // знаешь лучше — карточка появляется реже
    store.cards[c.front] = s;
    if (!ok && !c._r) { c._r = 1; flashcardsSession.push(c); }  // незнакомая карточка вернётся в конце сессии
    touch(); save();
    if (++currentCardIndex >= flashcardsSession.length) {
        document.querySelector('main').innerHTML = `
            <section class="quiz result"><h2>Сессия завершена 🎉</h2>
            <p>Карточки вернутся по графику: чем лучше знаешь, тем реже.</p>
            <div class="main-buttons"><button onclick="openFlashcards()">Ещё сессия</button><button onclick="location.reload()">На главную</button></div></section>`;
    } else { isCardFlipped = false; renderFlashcard(); }
}

// --- 5. Поиск по датам, терминам, личностям и теории ---
function search(v) {
    v = v.trim().toLowerCase();
    const out = document.getElementById('sr');
    if (v.length < 2) { out.innerHTML = ''; return; }
    const all = flashcardsData.concat(...Object.values(topicsData).map(t => t.theory.map(x => ({ front: x.title, back: x.text }))));
    const hits = all.filter(c => (c.front + ' ' + c.back).toLowerCase().includes(v)).slice(0, 25);
    out.innerHTML = hits.map(c => `<div class="topic"><h3>${c.front}</h3><p>${c.back}</p></div>`).join('') || '<p>Ничего не найдено. Попробуй другое слово.</p>';
}

// --- 6. Главная: статистика и режимы ---
function dash() {
    const h = store.hist, avg = h.length ? Math.round(h.reduce((a, x) => a + x.s / x.n, 0) / h.length * 100) : 0;
    const best = h.length ? Math.max(...h.map(x => Math.round(x.s / x.n * 100))) : 0;
    const mist = pool().filter(q => store.miss[q.question]).length;
    const known = Object.values(store.cards).filter(c => c.b >= 3).length;
    const st = (n, l) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`;
    document.getElementById('dash').innerHTML = `
        <div class="stats">
            ${st(streak(), 'дней подряд')}${st(h.length, 'тестов пройдено')}${st(avg + '%', 'средний результат')}
            ${st(best + '%', 'лучший результат')}${st(mist, 'вопросов в ошибках')}${st(known + ' / ' + flashcardsData.length, 'карточек выучено')}
        </div>
        <div class="main-buttons">
            <button onclick="startTest(null, {n: 10})">Тест 10</button>
            <button onclick="startTest(null, {n: 20})">Тест 20</button>
            <button onclick="startTest(null, {n: 40})">Тест 40</button>
            <button onclick="startTest(null, {mode: 'exam', minutes: 30})">⏱ Экзамен: 20 вопросов, 30 минут</button>
            ${mist ? `<button class="retry-btn" onclick="startTest(shuffle(pool().filter(q => store.miss[q.question])), {mode: 'mist'})">🎯 Мои ошибки (${mist})</button>` : ''}
        </div>
        <input class="search" placeholder="🔎 Поиск по датам, терминам и личностям" oninput="search(this.value)">
        <div id="sr"></div>
        <button class="ghost reset" onclick="if (confirm('Удалить всю статистику и прогресс?')) { localStorage.removeItem(LS); location.reload(); }">Сбросить прогресс</button>`;
}

// --- 7. Клавиатура ---
document.addEventListener('keydown', e => {
    const ans = document.querySelectorAll('.answer');
    if (ans.length && /^[1-4]$/.test(e.key)) { const b = ans[+e.key - 1]; if (b && !b.disabled) b.click(); return; }
    if (document.querySelector('.flashcard') && isCardFlipped && (e.key === '1' || e.key === '2')) { grade(e.key === '2'); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'BUTTON') {
        const n = document.getElementById('nextButton');
        if (n && !n.hidden) { e.preventDefault(); n.click(); }
        else if (document.querySelector('.flashcard')) { e.preventDefault(); flipCard(); }
    }
});

dash();
