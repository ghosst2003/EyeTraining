// ===== Global State =====
const state = {
    sentences: [],
    currentIndex: 0,
    correctCount: 0,
    totalCount: 0,
    fontSize: 73,
    duration: 1200,
    language: 'en',
    timerInterval: null,
    elapsed: 0,
    isPaused: false,
    isTraining: false,
    chars: [],          // DOM elements for characters
    baselineY: 0,       // first character's Y position (reference)
    checked: false,     // whether check has been performed on current sentence
    allCorrect: false,  // whether all chars are correctly aligned
};

// ===== DOM References =====
const $ = (sel) => document.querySelector(sel);
const configScreen = $('#config-screen');
const trainingScreen = $('#training-screen');
const resultScreen = $('#result-screen');
const fontSizeSelect = $('#font-size');
const durationSelect = $('#duration');
const languageSelect = $('#language');
const btnStart = $('#btn-start');
const btnCheck = $('#btn-check');
const btnPause = $('#btn-pause');
const btnEnd = $('#btn-end');
const btnBack = $('#btn-back');
const btnBackConfig = $('#btn-back-config');
const textContainer = $('#text-container');
const timerDisplay = $('#timer-display');
const correctCountEl = $('#correct-count');
const totalCountEl = $('#total-count');
const resultTime = $('#result-time');
const resultCorrect = $('#result-correct');
const resultAccuracy = $('#result-accuracy');
const resultLang = $('#result-lang');
const hintArea = $('.hint-area');

// ===== Sentence Loading =====
async function loadSentences(lang) {
    const file = lang === 'zh' ? 'sentences.txt' : 'sentences-en.txt';
    try {
        const response = await fetch(file);
        const text = await response.text();
        state.sentences = text
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    } catch (e) {
        // Fallback sentences
        state.sentences = lang === 'zh'
            ? ['今天天气很好，阳光明媚。', '春天来了，万物复苏。', '千里之行，始于足下。']
            : ['The quick brown fox jumps over the lazy dog.', 'Pack my box with five dozen liquor jugs.', 'How vexingly quick daft zebras jump.'];
        console.warn(`Failed to load ${file}, using fallback.`, e);
    }
}

// ===== Screen Management =====
function showScreen(screen) {
    configScreen.classList.remove('active');
    trainingScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    screen.classList.add('active');
}

// ===== Timer =====
function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function startTimer() {
    state.elapsed = 0;
    timerDisplay.textContent = formatTime(state.duration);
    state.timerInterval = setInterval(() => {
        if (!state.isPaused) {
            state.elapsed++;
            const remaining = state.duration - state.elapsed;
            timerDisplay.textContent = formatTime(remaining);
            if (remaining <= 0) {
                endTraining();
            }
        }
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// ===== Character Positioning =====
/**
 * Divide the text line height into 6 equal parts.
 * The first character's Y position is fixed (baseline).
 * Other characters randomly shift up or down by 0-4 divisions.
 */
function generateOffsets(numChars) {
    const offsets = [0]; // First character has offset 0 (reference)
    for (let i = 1; i < numChars; i++) {
        // 随机整数 -8 到 +8（难度翻倍）
        const offset = Math.floor(Math.random() * 17) - 8;
        offsets.push(offset);
    }
    return offsets;
}

function renderSentence() {
    if (state.sentences.length === 0) return;

    // Pick a random sentence
    const idx = Math.floor(Math.random() * state.sentences.length);
    const sentence = state.sentences[idx];

    // 都按单个字符拆分
    const items = sentence.split('');

    state.currentIndex = idx;

    // Calculate spacing and offsets
    const offsets = generateOffsets(items.length);
    const unit = state.fontSize / 8;
    // 每次移动距离 = 字体高度的 1/8（难度翻倍）
    // 偏移范围 -8 到 +8，最大移动 ±8 * fontSize/8 = ±fontSize
    // 最终位置：文字底部不超中轴线（向上），文字顶部不超中轴线（向下）
    const firstCharY = 0; // Reference: first character at Y=0

    // Clear container
    textContainer.innerHTML = '';
    textContainer.style.fontSize = state.fontSize + 'px';
    textContainer.style.lineHeight = '1';

    state.chars = [];
    state.checked = false;
    state.allCorrect = false;

    items.forEach((item, i) => {
        const span = document.createElement('span');
        span.className = 'char';
        // 空格用不换行空格防止被 CSS 折叠
        span.textContent = item === ' ' ? ' ' : item;
        span.dataset.index = i;
        span.dataset.offset = offsets[i];
        span.style.position = 'relative';
        // 使用 CSS 自定义属性控制位移
        span.style.setProperty('--offset-y', `${offsets[i] * unit}px`);

        // 空格占位，不可点击
        if (item === ' ') {
            span.style.cursor = 'default';
            span.style.pointerEvents = 'none';
            span.style.userSelect = 'none';
        } else if (i === 0) {
            span.style.cursor = 'default';
            span.style.pointerEvents = 'none';
        } else {
            // 其他字点击后随机跳动
            span.addEventListener('click', () => handleClick(span, unit));
        }

        textContainer.appendChild(span);
        state.chars.push(span);
    });

    // Update top bar
    correctCountEl.textContent = state.correctCount;
    totalCountEl.textContent = state.totalCount;

    // Reset buttons
    btnCheck.textContent = '检查';
    btnCheck.classList.remove('check-done');
    btnCheck.disabled = false;

    // 重置滚动位置到最左边
    requestAnimationFrame(() => {
        const area = $('.training-area');
        if (area) area.scrollLeft = 0;
    });
}

function handleClick(span, unit) {
    if (state.checked) return;
    if (parseInt(span.dataset.index) === 0) return; // 第一个字不能点

    // 调整时清除之前的检查标记
    span.classList.remove('correct', 'incorrect');

    // 点击循环切换位置：0 → -2 → -1 → +1 → +2 → 0（难度翻倍，最多4次回到中轴线）
    const currentOffset = parseInt(span.dataset.offset) || 0;
    let newOffset;
    if (currentOffset === 0) {
        newOffset = -2;
    } else if (currentOffset === -2) {
        newOffset = -1;
    } else if (currentOffset === -1) {
        newOffset = 1;
    } else if (currentOffset === 1) {
        newOffset = 2;
    } else {
        newOffset = 0;
    }

    span.dataset.offset = newOffset;
    span.style.setProperty('--offset-y', `${newOffset * unit}px`);
}

// ===== Check Logic =====
function checkAnswer() {
    if (state.checked) {
        // Already checked - move to next question
        state.totalCount++;
        state.correctCount++;
        correctCountEl.textContent = state.correctCount;
        totalCountEl.textContent = state.totalCount;
        renderSentence();
        return;
    }

    state.checked = true;

    let allCorrect = true;
    const unit = state.fontSize;

    state.chars.forEach((span, i) => {
        const offset = parseInt(span.dataset.offset);
        console.log(`Char ${i}: offset=${offset}`);
        // 空格不参与判断
        if (span.textContent === ' ') return;
        if (offset === 0) {
            span.classList.add('correct');
        } else {
            span.classList.add('incorrect');
            allCorrect = false;
        }
    });
    console.log('All correct:', allCorrect);

    if (allCorrect) {
        // 全部正确 — 记录成绩，按钮变为下一个
        state.totalCount++;
        state.correctCount++;
        correctCountEl.textContent = state.correctCount;
        totalCountEl.textContent = state.totalCount;
        btnCheck.textContent = '下一个';
        btnCheck.classList.add('check-done');
    } else {
        // 有错误 — 保持检查状态，允许重新检查
        state.checked = false;
        // 不清除标记，让用户看到错误，下次检查时重新判断
    }
}

// ===== Training Control =====
function startTraining() {
    state.fontSize = parseInt(fontSizeSelect.value);
    state.duration = parseInt(durationSelect.value);
    state.language = languageSelect.value;
    state.correctCount = 0;
    state.totalCount = 0;
    state.elapsed = 0;
    state.isPaused = false;
    state.isTraining = true;

    // 根据语言重新加载句子
    loadSentences(state.language).then(() => {
        showScreen(trainingScreen);
        // Update hint based on language
        const hintEl = document.querySelector('.hint');
        hintEl.innerHTML = state.language === 'zh'
            ? '文字随机跳动<br>第一个字为参考标准'
            : 'Words jump randomly<br>First word is the reference';
        hintArea.style.display = '';
        renderSentence();
        startTimer();
    });
}

function togglePause() {
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
        btnPause.textContent = '继续';
        hintArea.style.display = 'none';
    } else {
        btnPause.textContent = '暂停';
        hintArea.style.display = '';
    }
}

function endTraining() {
    stopTimer();
    state.isTraining = false;

    // Calculate stats
    resultTime.textContent = formatTime(state.elapsed);
    resultCorrect.textContent = state.correctCount;
    const accuracy = state.totalCount > 0
        ? Math.round((state.correctCount / state.totalCount) * 100)
        : 0;
    resultAccuracy.textContent = accuracy + '%';
    resultLang.textContent = state.language === 'zh' ? '中文' : 'English';

    showScreen(resultScreen);
}

// ===== Event Bindings =====
btnStart.addEventListener('click', () => {
    startTraining();
});

btnCheck.addEventListener('click', () => {
    checkAnswer();
});

btnPause.addEventListener('click', () => {
    togglePause();
});

btnEnd.addEventListener('click', () => {
    endTraining();
});

btnBack.addEventListener('click', () => {
    showScreen(configScreen);
});

btnBackConfig.addEventListener('click', () => {
    stopTimer();
    state.isTraining = false;
    showScreen(configScreen);
});

// Keyboard shortcut: Space for pause
document.addEventListener('keydown', (e) => {
    if (!state.isTraining) return;
    if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
    }
});

// ===== Drag to Scroll =====
(function initDragScroll() {
    const area = $('.training-area');
    let isDown = false;
    let startX;
    let scrollLeft;

    area.addEventListener('mousedown', (e) => {
        // 如果点击的是字符，不触发滚动
        if (e.target.closest('.char')) return;
        isDown = true;
        area.classList.add('dragging');
        startX = e.pageX - area.offsetLeft;
        scrollLeft = area.scrollLeft;
    });

    area.addEventListener('mouseleave', () => {
        isDown = false;
        area.classList.remove('dragging');
    });

    area.addEventListener('mouseup', () => {
        isDown = false;
        area.classList.remove('dragging');
    });

    area.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - area.offsetLeft;
        const walk = (x - startX) * 1.5; // 滚动速度
        area.scrollLeft = scrollLeft - walk;
    });

    // 鼠标滚轮/触控板横向滚动
    area.addEventListener('wheel', (e) => {
        // 将垂直滚动转换为水平滚动
        area.scrollLeft += e.deltaY || e.deltaX;
    }, { passive: true });

    // 触控板双指滑动
    let lastTouchX = 0;
    area.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            lastTouchX = e.touches[0].clientX;
        }
    }, { passive: true });

    area.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const currentX = e.touches[0].clientX;
            const diff = lastTouchX - currentX;
            area.scrollLeft += diff;
            lastTouchX = currentX;
        }
    }, { passive: true });
})();

// ===== Initialize =====
(async function init() {
    await loadSentences('en');
    showScreen(configScreen);
})();
