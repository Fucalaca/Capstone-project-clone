// Конфигурация
const CONFIG = {
    SAMPLE_RATE: 22050,
    N_MFCC: 13,
    MAX_LENGTH: 200,
    EMOTIONS: ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise'],
    EMOTION_LABELS_RU: {
        'angry': 'Злость',
        'disgust': 'Отвращение',
        'fear': 'Страх',
        'happy': 'Радость',
        'neutral': 'Нейтрально',
        'sad': 'Грусть',
        'surprise': 'Удивление'
    },
    STRESS_LEVELS: {
        'angry': 'high',
        'disgust': 'medium',
        'fear': 'high',
        'happy': 'low',
        'neutral': 'low',
        'sad': 'medium',
        'surprise': 'medium'
    },
    EMOTION_EMOJIS: {
        'angry': '😠',
        'disgust': '🤢',
        'fear': '😨',
        'happy': '😊',
        'neutral': '😐',
        'sad': '😢',
        'surprise': '😲'
    }
};

// Глобальные переменные
let model = null;
let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTime = 0;
let timerInterval = null;
let currentAudioBuffer = null;
let isModelLoaded = false;

// Элементы DOM
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const playBtn = document.getElementById('playBtn');
const fileUpload = document.getElementById('fileUpload');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const waveformCanvas = document.getElementById('waveform');
const audioStatus = document.getElementById('audioStatus');
const volumeLevel = document.getElementById('volumeLevel');
const duration = document.getElementById('duration');
const stressText = document.getElementById('stressText');
const stressEmoji = document.getElementById('stressEmoji');
const primaryEmotion = document.getElementById('primaryEmotion');
const primaryEmotionIcon = document.getElementById('primaryEmotionIcon');
const confidence = document.getElementById('confidence');
const emotionBars = document.getElementById('emotionBars');
const gaugeFill = document.getElementById('gaugeFill');
const modelAccuracy = document.getElementById('modelAccuracy');
const modelProgress = document.getElementById('modelProgress');
const modelProgressFill = document.getElementById('modelProgressFill');

// Советы для разных эмоций
const WELLNESS_TIPS = {
    'angry': {
        title: 'Управление гневом',
        tips: [
            'Сделайте 5 глубоких вдохов и выдохов',
            'Попробуйте техники mindfulness на 5 минут',
            'Прогуляйтесь на свежем воздухе',
            'Выпейте стакан воды'
        ],
        supervisor: 'Рекомендуется дать сотруднику возможность короткого перерыва'
    },
    'disgust': {
        title: 'Преодоление отвращения',
        tips: [
            'Сосредоточьтесь на позитивных аспектах ситуации',
            'Поговорите с коллегой о своих чувствах',
            'Смените обстановку на 10-15 минут'
        ],
        supervisor: 'Рассмотрите возможность изменения рабочих условий'
    },
    'fear': {
        title: 'Снижение тревожности',
        tips: [
            'Разбейте большие задачи на маленькие шаги',
            'Практикуйте техники заземления',
            'Обсудите свои опасения с руководителем'
        ],
        supervisor: 'Обеспечьте четкие инструкции и поддержку'
    },
    'happy': {
        title: 'Поддержка позитивного настроения',
        tips: [
            'Поделитесь позитивом с коллегами',
            'Воспользуйтесь энергией для сложных задач',
            'Запланируйте что-то приятное после работы'
        ],
        supervisor: 'Используйте позитивный настрой для мотивации команды'
    },
    'neutral': {
        title: 'Поддержание баланса',
        tips: [
            'Спланируйте день для максимальной продуктивности',
            'Сделайте короткую разминку',
            'Поддерживайте водный баланс'
        ],
        supervisor: 'Стабильное состояние оптимально для рабочих задач'
    },
    'sad': {
        title: 'Повышение настроения',
        tips: [
            'Позвоните близкому человеку',
            'Послушайте любимую музыку',
            'Сделайте что-то приятное для себя',
            'Вспомните свои последние успехи'
        ],
        supervisor: 'Проявите эмпатию и предложите поддержку'
    },
    'surprise': {
        title: 'Адаптация к неожиданностям',
        tips: [
            'Возьмите паузу для осмысления',
            'Составьте план действий',
            'Обратитесь за разъяснениями при необходимости'
        ],
        supervisor: 'Обеспечьте ясность и дополнительную информацию'
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    initializeUI();
    await loadModel();
    setupEventListeners();
    initializeAudioVisualization();
});

// Инициализация UI
function initializeUI() {
    // Создаем бары для эмоций
    CONFIG.EMOTIONS.forEach(emotion => {
        const bar = document.createElement('div');
        bar.className = 'emotion-bar';
        bar.innerHTML = `
            <span class="emotion-label">${CONFIG.EMOTION_LABELS_RU[emotion]}</span>
            <div class="bar-container">
                <div class="bar-fill" data-emotion="${emotion}" 
                     style="width: 0%; background: ${getEmotionColor(emotion)};">
                    0%
                </div>
            </div>
        `;
        emotionBars.appendChild(bar);
    });
}

// Загрузка модели TensorFlow.js
async function loadModel() {
    try {
        showStatus('Загрузка модели...', 'info');
        
        // Для демонстрации используем фиктивную модель
        // В реальности нужно конвертировать PyTorch модель в TF.js
        model = await tf.loadLayersModel('./model/model.json', {
            onProgress: (progress) => {
                const percent = Math.round(progress * 100);
                modelProgress.textContent = `${percent}%`;
                modelProgressFill.style.width = `${percent}%`;
            }
        });
        
        isModelLoaded = true;
        showStatus('Модель загружена', 'success');
        modelAccuracy.textContent = '62% (демо)';
        
        console.log('Модель успешно загружена');
        console.log('Архитектура модели:', model.summary());
        
    } catch (error) {
        console.error('Ошибка загрузки модели:', error);
        showStatus('Ошибка загрузки модели', 'error');
        
        // Создаем демо-модель для тестирования
        createDemoModel();
    }
}

// Создание демо-модели для тестирования
function createDemoModel() {
    showStatus('Используется демо-режим', 'warning');
    isModelLoaded = true;
    modelAccuracy.textContent = '62% (демо)';
    
    // Простая модель для демонстрации
    model = {
        predict: async (input) => {
            // Генерация случайных предсказаний для демо
            const predictions = tf.tidy(() => {
                const random = tf.randomUniform([1, 7]);
                return tf.softmax(random);
            });
            return predictions;
        }
    };
}

// Настройка обработчиков событий
function setupEventListeners() {
    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    playBtn.addEventListener('click', playAudio);
    fileUpload.addEventListener('change', handleFileUpload);
    
    // Инициализация аудио контекста при первом взаимодействии
    document.addEventListener('click', initializeAudioContext, { once: true });
}

// Инициализация аудио контекста
function initializeAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Начало записи
async function startRecording() {
    try {
        await initializeAudioContext();
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: CONFIG.SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await processAudioBlob(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start(100);
        isRecording = true;
        startTimer();
        
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        playBtn.disabled = true;
        
        showStatus('Идет запись...', 'recording');
        recordBtn.classList.add('recording');
        
        updateAudioStatus('Запись...');
        
    } catch (error) {
        console.error('Ошибка записи:', error);
        showStatus('Ошибка доступа к микрофону', 'error');
    }
}

// Остановка записи
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        stopTimer();
        
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        playBtn.disabled = false;
        
        showStatus('Запись завершена', 'success');
        recordBtn.classList.remove('recording');
    }
}

// Воспроизведение аудио
function playAudio() {
    if (currentAudioBuffer) {
        const source = audioContext.createBufferSource();
        source.buffer = currentAudioBuffer;
        source.connect(audioContext.destination);
        source.start();
        
        showStatus('Воспроизведение...', 'info');
        
        source.onended = () => {
            showStatus('Воспроизведение завершено', 'success');
        };
    }
}

// Обработка загруженного файла
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.includes('audio')) {
        showStatus('Пожалуйста, загрузите аудио файл', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showStatus('Файл слишком большой (макс. 10MB)', 'error');
        return;
    }
    
    showStatus('Обработка аудио...', 'info');
    await processAudioBlob(file);
}

// Обработка аудио Blob
async function processAudioBlob(blob) {
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Обновляем визуализацию
        visualizeAudio(audioBuffer);
        currentAudioBuffer = audioBuffer;
        
        // Извлекаем признаки и делаем предсказание
        const mfccFeatures = extractMFCCFeatures(audioBuffer);
        await predictEmotion(mfccFeatures);
        
        playBtn.disabled = false;
        updateAudioStatus('Аудио загружено');
        
    } catch (error) {
        console.error('Ошибка обработки аудио:', error);
        showStatus('Ошибка обработки аудио', 'error');
    }
}

// Извлечение MFCC признаков
function extractMFCCFeatures(audioBuffer) {
    // В реальном приложении используйте библиотеку для вычисления MFCC
    // Например, https://github.com/dhchoi/mfcc.js
    // Здесь упрощенная версия для демонстрации
    
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Нормализация длительности до 10 секунд
    const targetSamples = 10 * sampleRate;
    let processedData;
    
    if (audioData.length > targetSamples) {
        processedData = audioData.slice(0, targetSamples);
    } else {
        processedData = new Float32Array(targetSamples);
        processedData.set(audioData);
    }
    
    // Для демо генерируем случайные MFCC
    // В реальности используйте библиотеку MFCC
    const mfcc = [];
    for (let i = 0; i < CONFIG.N_MFCC; i++) {
        const frame = [];
        for (let j = 0; j < CONFIG.MAX_LENGTH; j++) {
            frame.push(Math.random() * 2 - 1); // Случайные значения для демо
        }
        mfcc.push(frame);
    }
    
    return tf.tensor([mfcc]);
}

// Предсказание эмоции
async function predictEmotion(features) {
    if (!isModelLoaded) {
        showStatus('Модель не загружена', 'error');
        return;
    }
    
    try {
        showStatus('Анализ эмоций...', 'info');
        
        const predictions = await model.predict(features);
        const predictionArray = await predictions.data();
        predictions.dispose();
        
        // Находим наиболее вероятную эмоцию
        let maxIndex = 0;
        let maxValue = 0;
        
        const emotionProbabilities = {};
        CONFIG.EMOTIONS.forEach((emotion, index) => {
            const probability = predictionArray[index] * 100;
            emotionProbabilities[emotion] = probability;
            
            if (probability > maxValue) {
                maxValue = probability;
                maxIndex = index;
            }
        });
        
        const primaryEmotionKey = CONFIG.EMOTIONS[maxIndex];
        updateResults(primaryEmotionKey, maxValue, emotionProbabilities);
        showStatus('Анализ завершен', 'success');
        
    } catch (error) {
        console.error('Ошибка предсказания:', error);
        showStatus('Ошибка анализа', 'error');
    }
}

// Обновление результатов
function updateResults(emotion, confidenceValue, probabilities) {
    // Основная эмоция
    primaryEmotion.textContent = CONFIG.EMOTION_LABELS_RU[emotion];
    primaryEmotionIcon.textContent = CONFIG.EMOTION_EMOJIS[emotion];
    confidence.textContent = `Вероятность: ${confidenceValue.toFixed(1)}%`;
    
    // Уровень стресса
    const stressLevel = CONFIG.STRESS_LEVELS[emotion];
    stressText.textContent = `Уровень стресса: ${getStressLabel(stressLevel)}`;
    stressEmoji.textContent = getStressEmoji(stressLevel);
    
    // Обновляем шкалу стресса
    updateStressGauge(stressLevel);
    
    // Обновляем бары вероятностей
    updateProbabilityBars(probabilities);
    
    // Обновляем рекомендации
    updateWellnessTips(emotion);
}

// Обновление шкалы стресса
function updateStressGauge(stressLevel) {
    let height;
    switch(stressLevel) {
        case 'low': height = '25%'; break;
        case 'medium': height = '50%'; break;
        case 'high': height = '75%'; break;
        default: height = '25%';
    }
    gaugeFill.style.height = height;
}

// Обновление баров вероятностей
function updateProbabilityBars(probabilities) {
    CONFIG.EMOTIONS.forEach(emotion => {
        const probability = probabilities[emotion] || 0;
        const barFill = document.querySelector(`.bar-fill[data-emotion="${emotion}"]`);
        if (barFill) {
            barFill.style.width = `${probability}%`;
            barFill.textContent = `${probability.toFixed(1)}%`;
            barFill.style.background = getEmotionColor(emotion);
        }
    });
}

// Обновление рекомендаций
function updateWellnessTips(emotion) {
    const tips = WELLNESS_TIPS[emotion];
    
    // Обновляем советы по управлению стрессом
    const stressTip = document.getElementById('stressTip');
    stressTip.innerHTML = `
        <h3><i class="fas fa-lightbulb"></i> ${tips.title}</h3>
        <p>${tips.tips.slice(0, 2).join('<br>')}</p>
    `;
    
    // Обновляем рекомендуемые действия
    const actionList = document.getElementById('actionList');
    actionList.innerHTML = tips.tips
        .map(tip => `<li>${tip}</li>`)
        .join('');
    
    // Обновляем рекомендации для руководителя
    const supervisorTip = document.querySelector('#supervisorTip p');
    supervisorTip.textContent = tips.supervisor;
}

// Получение цвета для эмоции
function getEmotionColor(emotion) {
    const colors = {
        'angry': '#FF6B6B',
        'disgust': '#4ECDC4',
        'fear': '#95E1D3',
        'happy': '#FFD166',
        'neutral': '#888888',
        'sad': '#118AB2',
        'surprise': '#9D4EDD'
    };
    return colors[emotion] || '#888888';
}

// Получение текста уровня стресса
function getStressLabel(level) {
    const labels = {
        'low': 'Низкий',
        'medium': 'Средний',
        'high': 'Высокий'
    };
    return labels[level] || 'Низкий';
}

// Получение эмодзи для уровня стресса
function getStressEmoji(level) {
    const emojis = {
        'low': '😊',
        'medium': '😐',
        'high': '😨'
    };
    return emojis[level] || '😐';
}

// Инициализация визуализации аудио
function initializeAudioVisualization() {
    const ctx = waveformCanvas.getContext('2d');
    waveformCanvas.width = waveformCanvas.offsetWidth;
    waveformCanvas.height = waveformCanvas.offsetHeight;
}

// Визуализация аудио
function visualizeAudio(audioBuffer) {
    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    // Очищаем канвас
    ctx.clearRect(0, 0, width, height);
    
    // Получаем данные аудио
    const audioData = audioBuffer.getChannelData(0);
    const step = Math.ceil(audioData.length / width);
    
    // Рисуем волну
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    
    for (let i = 0; i < width; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
            sum += Math.abs(audioData[(i * step) + j] || 0);
        }
        const avg = sum / step;
        const y = (avg * height) / 2;
        
        ctx.lineTo(i, height / 2 - y);
        ctx.lineTo(i, height / 2 + y);
    }
    
    // Градиент для волны
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#4361ee');
    gradient.addColorStop(1, '#7209b7');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Обновляем информацию об аудио
    updateAudioInfo(audioBuffer);
}

// Обновление информации об аудио
function updateAudioInfo(audioBuffer) {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Вычисляем среднюю громкость
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        sum += Math.abs(audioData[i]);
    }
    const avgVolume = (sum / audioData.length) * 100;
    
    volumeLevel.textContent = `${avgVolume.toFixed(1)}%`;
    duration.textContent = (audioBuffer.duration).toFixed(1);
}

// Обновление статуса аудио
function updateAudioStatus(text) {
    audioStatus.textContent = text;
}

// Таймер записи
function startTimer() {
    recordingTime = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        recordingTime++;
        updateTimerDisplay();
        
        // Автоматическая остановка через 10 секунд
        if (recordingTime >= 10) {
            stopRecording();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(recordingTime / 60).toString().padStart(2, '0');
    const seconds = (recordingTime % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
}

// Показать статус
function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = 'status';
    
    switch(type) {
        case 'success':
            statusEl.style.background = '#4CAF50';
            break;
        case 'error':
            statusEl.style.background = '#F44336';
            break;
        case 'warning':
            statusEl.style.background = '#FF9800';
            break;
        case 'recording':
            statusEl.style.background = '#F44336';
            statusEl.classList.add('recording');
            break;
        default:
            statusEl.style.background = '#2196F3';
    }
}

// Обработка ошибок
window.addEventListener('error', (error) => {
    console.error('Глобальная ошибка:', error);
    showStatus('Произошла ошибка приложения', 'error');
});

// Адаптация к изменению размера окна
window.addEventListener('resize', () => {
    waveformCanvas.width = waveformCanvas.offsetWidth;
    waveformCanvas.height = waveformCanvas.offsetHeight;
    if (currentAudioBuffer) {
        visualizeAudio(currentAudioBuffer);
    }
});

// Инструкция по использованию
console.log(`
=== Voice Emotion Detector ===
Инструкция:
1. Нажмите "Начать запись" для записи голоса (макс. 10 сек)
2. Или загрузите аудио файл (макс. 10MB)
3. Модель проанализирует эмоции
4. Просмотрите результаты и рекомендации

Для работы с реальной моделью:
1. Конвертируйте PyTorch модель в TensorFlow.js
2. Сохраните model.json и weights.bin в папку model/
3. Обновите loadModel() для загрузки реальной модели
`);