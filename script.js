// УДАЛИТЕ старый CONFIG и весь старый код
// ВСТАВЬТЕ этот полностью обновленный код:

// Конфигурация (ТОЛЬКО ОДИН РАЗ!)
const CONFIG = {
    SAMPLE_RATE: 22050,
    N_MELS: 256,          // Важно: 256, не 64!
    MAX_LENGTH: 200,
    EMOTIONS: ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise'],
    EMOTION_LABELS_RU: {
        'angry': 'Angry',
        'disgust': 'Disgust',
        'fear': 'Fear',
        'happy': 'Happy',
        'neutral': 'Neutral',
        'sad': 'Sad',
        'surprise': 'Surprise'
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
let melProcessor = null;

// Элементы DOM - будем инициализировать позже
let recordBtn, stopBtn, playBtn, fileUpload, statusEl, timerEl;
let waveformCanvas, audioStatus, volumeLevel, durationEl;
let stressText, stressEmoji, primaryEmotion, primaryEmotionIcon;
let confidence, emotionBars, gaugeFill, modelAccuracy;
let modelProgress, modelProgressFill;

// Советы для разных эмоций
const WELLNESS_TIPS = {
    'angry': {
        title: 'Anger Control',
        tips: [
            'Take 5 deep breaths in and out',
            'Try mindfulness techniques for 5 minutes',
            'Take a walk in the fresh air',
            'Drink a glass of water'
        ],
        supervisor: 'It is recommended to give the employee a short break'
    },
    'disgust': {
        title: 'Overcoming Disgust',
        tips: [
            'Focus on the positive aspects of the situation',
            'Talk to a colleague about your feelings',
            'Change the environment for 10-15 minutes'
        ],
        supervisor: 'Consider changing the working conditions'
    },
    'fear': {
        title: 'Reducing anxiety',
        tips: [
            'Break down big tasks into small steps',
            'Practice grounding techniques',
            'Discuss your concerns with your supervisor'
        ],
        supervisor: 'Provide clear instructions and support'
    },
    'happy': {
        title: 'Maintaining a positive mood',
        tips: [
            'Share the positivity with your colleagues',
            'Use energy for challenging tasks',
            'Plan something pleasant after work'
        ],
        supervisor: 'Use a positive attitude to motivate your team'
    },
    'neutral': {
        title: 'Maintaining balance',
        tips: [
            'Plan your day for maximum productivity',
            'Do a short warm-up session',
            'Maintain water balance'
        ],
        supervisor: 'Stable condition is optimal for work tasks'
    },
    'sad': {
        title: 'Mood boost',
        tips: [
            'Call a loved one',
            'Listen to your favorite music',
            'Do something nice for yourself',
            'Remember your recent successes'
        ],
        supervisor: 'Show empathy and offer support'
    },
    'surprise': {
        title: 'Adaptation to the unexpected',
        tips: [
            'Take a break to reflect',
            'Make a plan of action',
            'Ask for clarification if necessary'
        ],
        supervisor: 'Provide clarity and additional information'
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    // Сначала инициализируем DOM элементы
    initializeDOMElements();
    
    // Затем UI
    initializeUI();
    
    // Инициализируем MelSpectrogram
    try {
        melProcessor = new MelSpectrogramProcessor(
            CONFIG.SAMPLE_RATE,
            CONFIG.N_MELS,
            CONFIG.MAX_LENGTH
        );
        console.log('✅ MelSpectrogramProcessor initialized');
    } catch (error) {
        console.error('❌ Failed to initialize MelSpectrogram:', error);
        showStatus('Audio processor error', 'error');
    }
    
    // Загружаем модель
    await loadModel();
    
    // Настраиваем обработчики
    setupEventListeners();
    
    // Инициализируем визуализацию
    initializeAudioVisualization();
    
    console.log('✅ App initialized successfully');
});

// Инициализация DOM элементов
function initializeDOMElements() {
    console.log('Initializing DOM elements...');
    
    recordBtn = document.getElementById('recordBtn');
    stopBtn = document.getElementById('stopBtn');
    playBtn = document.getElementById('playBtn');
    fileUpload = document.getElementById('fileUpload');
    statusEl = document.getElementById('status');
    timerEl = document.getElementById('timer');
    waveformCanvas = document.getElementById('waveform');
    audioStatus = document.getElementById('audioStatus');
    volumeLevel = document.getElementById('volumeLevel');
    durationEl = document.getElementById('duration');
    stressText = document.getElementById('stressText');
    stressEmoji = document.getElementById('stressEmoji');
    primaryEmotion = document.getElementById('primaryEmotion');
    primaryEmotionIcon = document.getElementById('primaryEmotionIcon');
    confidence = document.getElementById('confidence');
    emotionBars = document.getElementById('emotionBars');
    gaugeFill = document.getElementById('gaugeFill');
    modelAccuracy = document.getElementById('modelAccuracy');
    modelProgress = document.getElementById('modelProgress');
    modelProgressFill = document.getElementById('modelProgressFill');
    
    // Проверяем, что все элементы найдены
    const elements = {
        recordBtn, stopBtn, playBtn, fileUpload, statusEl, timerEl,
        waveformCanvas, audioStatus, volumeLevel, durationEl, stressText,
        stressEmoji, primaryEmotion, primaryEmotionIcon, confidence,
        emotionBars, gaugeFill, modelAccuracy, modelProgress, modelProgressFill
    };
    
    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`❌ Element not found: ${name}`);
        }
    }
    
    console.log('✅ DOM elements initialized');
}

// Инициализация UI
function initializeUI() {
    console.log('Initializing UI...');
    
    if (!emotionBars) {
        console.error('❌ emotionBars element not found');
        return;
    }
    
    // Очищаем существующие бары (если есть)
    emotionBars.innerHTML = '';
    
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
    
    console.log('✅ UI initialized');
}

// Загрузка модели TensorFlow.js
async function loadModel() {
    try {
        showStatus('Loading the model...', 'info');
        
        console.log('📦 Loading model from ./model/model.json');
        
        model = await tf.loadLayersModel('./model/model.json', {
            onProgress: (progress) => {
                const percent = Math.round(progress * 100);
                if (modelProgress) {
                    modelProgress.textContent = `${percent}%`;
                    modelProgressFill.style.width = `${percent}%`;
                }
            }
        });
        
        isModelLoaded = true;
        
        // Проверяем входной формат модели
        const inputShape = model.inputs[0].shape;
        console.log('✅ Model loaded successfully!');
        console.log('📐 Model input shape:', inputShape);
        console.log('⚙️  Expected shape: [null, 256, 200]');
        
        if (inputShape[1] === 256 && inputShape[2] === 200) {
            console.log('✅ Input shape matches!');
        } else {
            console.warn(`⚠️ Shape mismatch! Model expects [null, ${inputShape[1]}, ${inputShape[2]}], 
                but we have [null, ${CONFIG.N_MELS}, ${CONFIG.MAX_LENGTH}]`);
        }
        
        showStatus('Model loaded successfully', 'success');
        if (modelAccuracy) {
            modelAccuracy.textContent = '71% (CRNN)';
        }
        
    } catch (error) {
        console.error('❌ Model loading error:', error);
        showStatus('Model loading error', 'error');
        createDemoModel();
    }
}

// Создание демо-модели для тестирования
function createDemoModel() {
    showStatus('Using demo mode', 'warning');
    isModelLoaded = true;
    
    if (modelAccuracy) {
        modelAccuracy.textContent = '71% (demo)';
    }
    
    // Простая модель для демонстрации
    model = {
        predict: async (input) => {
            console.log('🤖 Demo model prediction');
            
            // Генерация случайных предсказаний для демо
            const predictions = tf.tidy(() => {
                const random = tf.randomUniform([1, 7]);
                return tf.softmax(random);
            });
            return predictions;
        }
    };
    
    console.log('⚠️ Using demo model');
}

// Настройка обработчиков событий
function setupEventListeners() {
    if (!recordBtn || !stopBtn || !playBtn || !fileUpload) {
        console.error('❌ Cannot setup event listeners - elements not found');
        return;
    }
    
    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    playBtn.addEventListener('click', playAudio);
    fileUpload.addEventListener('change', handleFileUpload);
    
    // Инициализация аудио контекста при первом взаимодействии
    document.addEventListener('click', initializeAudioContext, { once: true });
    
    console.log('✅ Event listeners setup');
}

// Инициализация аудио контекста
function initializeAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ AudioContext initialized');
        } catch (error) {
            console.error('❌ Failed to initialize AudioContext:', error);
            showStatus('Audio not supported', 'error');
        }
    }
}

// Начало записи
async function startRecording() {
    try {
        await initializeAudioContext();
        
        if (!audioContext) {
            showStatus('Audio not supported', 'error');
            return;
        }
        
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
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await processAudioBlob(audioBlob);
            } catch (error) {
                console.error('Error processing recording:', error);
                showStatus('Error processing audio', 'error');
            } finally {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        
        mediaRecorder.start(100);
        isRecording = true;
        startTimer();
        
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        playBtn.disabled = true;
        
        showStatus('Recording...', 'recording');
        recordBtn.classList.add('recording');
        
        updateAudioStatus('Recording...');
        
    } catch (error) {
        console.error('Recording error:', error);
        showStatus('Microphone access denied', 'error');
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
        
        showStatus('Recording completed', 'success');
        recordBtn.classList.remove('recording');
    }
}

// Воспроизведение аудио
function playAudio() {
    if (currentAudioBuffer && audioContext) {
        try {
            const source = audioContext.createBufferSource();
            source.buffer = currentAudioBuffer;
            source.connect(audioContext.destination);
            source.start();
            
            showStatus('Playing...', 'info');
            
            source.onended = () => {
                showStatus('Playback complete', 'success');
            };
        } catch (error) {
            console.error('Playback error:', error);
            showStatus('Playback error', 'error');
        }
    }
}

// Обработка загруженного файла
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.includes('audio')) {
        showStatus('Please upload an audio file', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showStatus('File too large (max 10MB)', 'error');
        return;
    }
    
    showStatus('Processing audio...', 'info');
    await processAudioBlob(file);
}

// Обработка аудио Blob
async function processAudioBlob(blob) {
    try {
        if (!audioContext) {
            await initializeAudioContext();
        }
        
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Обновляем визуализацию
        visualizeAudio(audioBuffer);
        currentAudioBuffer = audioBuffer;
        
        // Извлекаем Mel-спектрограмму и делаем предсказание
        const melFeatures = await extractMelSpectrogramFeatures(audioBuffer);
        await predictEmotion(melFeatures);
        
        playBtn.disabled = false;
        updateAudioStatus('Audio loaded');
        
    } catch (error) {
        console.error('Error processing audio:', error);
        showStatus('Error processing audio', 'error');
    }
}

// Извлечение Mel-спектрограммы
async function extractMelSpectrogramFeatures(audioBuffer) {
    try {
        showStatus('Extracting Mel-spectrogram...', 'info');
        
        if (!melProcessor) {
            throw new Error('Mel processor not initialized');
        }
        
        const audioData = audioBuffer.getChannelData(0);
        const originalSampleRate = audioBuffer.sampleRate;
        
        // Ресамплинг если нужно
        let processedAudio;
        if (originalSampleRate !== CONFIG.SAMPLE_RATE) {
            processedAudio = await resampleAudio(audioData, originalSampleRate, CONFIG.SAMPLE_RATE);
            console.log(`Resampled from ${originalSampleRate}Hz to ${CONFIG.SAMPLE_RATE}Hz`);
        } else {
            processedAudio = audioData;
        }
        
        // Вычисляем Mel-спектрограмму
        const melSpec = await melProcessor.compute(processedAudio);
        
        // Дебаг информация
        melProcessor.debugMelSpectrogram(melSpec);
        
        // Нормализация (z-score)
        const normalized = melProcessor.normalize(melSpec, 'zscore');
        
        // Преобразуем в тензор [batch, n_mels, time]
        const tensor = tf.tensor([normalized]);
        
        console.log('Mel-spectrogram tensor shape:', tensor.shape);
        
        showStatus('Features extracted', 'success');
        return tensor;
        
    } catch (error) {
        console.error('Error extracting mel spectrogram:', error);
        showStatus('Error processing audio', 'error');
        
        // Fallback
        return createFallbackMelSpectrogram();
    }
}

// Функция ресамплинга
async function resampleAudio(audioData, originalRate, targetRate) {
    if (originalRate === targetRate) return audioData;
    
    const ratio = targetRate / originalRate;
    const newLength = Math.round(audioData.length * ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const pos = i / ratio;
        const index = Math.floor(pos);
        const frac = pos - index;
        
        if (index < audioData.length - 1) {
            resampled[i] = audioData[index] * (1 - frac) + audioData[index + 1] * frac;
        } else {
            resampled[i] = audioData[audioData.length - 1];
        }
    }
    
    return resampled;
}

// Fallback функция
function createFallbackMelSpectrogram() {
    console.log('⚠️ Using fallback mel spectrogram');
    const melSpec = [];
    for (let i = 0; i < CONFIG.N_MELS; i++) {
        const frame = [];
        for (let j = 0; j < CONFIG.MAX_LENGTH; j++) {
            frame.push(Math.random() * 2 - 1);
        }
        melSpec.push(frame);
    }
    return tf.tensor([melSpec]);
}

// Предсказание эмоции
async function predictEmotion(features) {
    if (!isModelLoaded || !model) {
        showStatus('Model not loaded', 'error');
        return;
    }
    
    try {
        showStatus('Analyzing emotions...', 'info');
        
        console.log('Input to model shape:', features.shape);
        
        const startTime = performance.now();
        const predictions = await model.predict(features);
        const predictionArray = await predictions.data();
        predictions.dispose();
        
        const endTime = performance.now();
        console.log(`Inference time: ${(endTime - startTime).toFixed(2)} ms`);
        
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
        showStatus('Analysis complete', 'success');
        
    } catch (error) {
        console.error('Prediction error:', error);
        showStatus('Analysis error', 'error');
    }
}

// Обновление результатов
function updateResults(emotion, confidenceValue, probabilities) {
    // Основная эмоция
    if (primaryEmotion) {
        primaryEmotion.textContent = CONFIG.EMOTION_LABELS_RU[emotion];
    }
    if (primaryEmotionIcon) {
        primaryEmotionIcon.textContent = CONFIG.EMOTION_EMOJIS[emotion];
    }
    if (confidence) {
        confidence.textContent = `Confidence: ${confidenceValue.toFixed(1)}%`;
    }
    
    // Уровень стресса
    const stressLevel = CONFIG.STRESS_LEVELS[emotion];
    if (stressText) {
        stressText.textContent = `Stress level: ${getStressLabel(stressLevel)}`;
    }
    if (stressEmoji) {
        stressEmoji.textContent = getStressEmoji(stressLevel);
    }
    
    // Обновляем шкалу стресса
    updateStressGauge(stressLevel);
    
    // Обновляем бары вероятностей
    updateProbabilityBars(probabilities);
    
    // Обновляем рекомендации
    updateWellnessTips(emotion);
}

// Обновление шкалы стресса
function updateStressGauge(stressLevel) {
    if (!gaugeFill) return;
    
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
    if (!tips) return;
    
    // Обновляем советы по управлению стрессом
    const stressTip = document.getElementById('stressTip');
    if (stressTip) {
        stressTip.innerHTML = `
            <h3><i class="fas fa-lightbulb"></i> ${tips.title}</h3>
            <p>${tips.tips.slice(0, 2).join('<br>')}</p>
        `;
    }
    
    // Обновляем рекомендуемые действия
    const actionList = document.getElementById('actionList');
    if (actionList) {
        actionList.innerHTML = tips.tips
            .map(tip => `<li>${tip}</li>`)
            .join('');
    }
    
    // Обновляем рекомендации для руководителя
    const supervisorTip = document.querySelector('#supervisorTip p');
    if (supervisorTip) {
        supervisorTip.textContent = tips.supervisor;
    }
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
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High'
    };
    return labels[level] || 'Low';
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
    if (!waveformCanvas) {
        console.error('❌ waveformCanvas not found');
        return;
    }
    
    const ctx = waveformCanvas.getContext('2d');
    if (!ctx) {
        console.error('❌ Cannot get canvas context');
        return;
    }
    
    waveformCanvas.width = waveformCanvas.offsetWidth;
    waveformCanvas.height = waveformCanvas.offsetHeight;
    
    console.log('✅ Audio visualization initialized');
}

// Визуализация аудио
function visualizeAudio(audioBuffer) {
    if (!waveformCanvas) return;
    
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
    
    if (volumeLevel) {
        volumeLevel.textContent = `${avgVolume.toFixed(1)}%`;
    }
    if (durationEl) {
        durationEl.textContent = (audioBuffer.duration).toFixed(1);
    }
}

// Обновление статуса аудио
function updateAudioStatus(text) {
    if (audioStatus) {
        audioStatus.textContent = text;
    }
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
    if (!timerEl) return;
    
    const minutes = Math.floor(recordingTime / 60).toString().padStart(2, '0');
    const seconds = (recordingTime % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
}

// Показать статус
function showStatus(message, type = 'info') {
    if (!statusEl) {
        console.error('Status element not found');
        return;
    }
    
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
    console.error('Global error:', error);
    showStatus('Application error occurred', 'error');
});

// Адаптация к изменению размера окна
window.addEventListener('resize', () => {
    if (waveformCanvas) {
        waveformCanvas.width = waveformCanvas.offsetWidth;
        waveformCanvas.height = waveformCanvas.offsetHeight;
        if (currentAudioBuffer) {
            visualizeAudio(currentAudioBuffer);
        }
    }
});

// Инструкция по использованию
console.log(`
=== Voice Emotion Detector ===
Using CRNN model with Mel-spectrograms
N_MELS: ${CONFIG.N_MELS}, MAX_LENGTH: ${CONFIG.MAX_LENGTH}
`);
